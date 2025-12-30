// frontend/app/api/strava/sync/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  start_date: string; // UTC ISO
  start_date_local: string; // local ISO
  timezone?: string;
  elapsed_time?: number; // seconds
  moving_time?: number; // seconds
  distance?: number; // meters
  total_elevation_gain?: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number; // m/s
  calories?: number;
  athlete?: { id: number };
};

function mapSport(stravaType: string): string {
  const t = (stravaType || "").toLowerCase();
  if (t === "run" || t === "trailrun" || t === "treadmill") return "run";
  if (t === "ride" || t === "virtualride" || t === "ebikeride") return "ride";
  if (t === "swim") return "swim";
  if (t === "walk" || t === "hike") return "walk";
  if (t === "workout" || t === "weighttraining") return "strength";
  return "other";
}

function toLocalDate(isoUtc: string) {
  return isoUtc?.slice(0, 10) ?? null;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function downsampleEvenly<T>(arr: T[], maxPoints: number) {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * Безопасное чтение ответа: сначала text(), потом пробуем JSON.parse
 * Это защищает от HTML-страниц (<!DOCTYPE ...>) и иных не-JSON ответов.
 */
async function readJsonOrText(resp: Response) {
  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { text, json };
}

async function refreshStravaToken(refresh_token: string) {
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  const { json, text } = await readJsonOrText(resp);

  if (!resp.ok) {
    const msg =
      (json && (json.message || json.error_description || json.error)) ||
      `strava_refresh_failed: http_${resp.status}`;
    const snippet = text?.slice(0, 220);
    throw new Error(`${msg}. Body: ${snippet}`);
  }

  return {
    access_token: String(json?.access_token),
    refresh_token: String(json?.refresh_token),
    expires_at: Number(json?.expires_at),
    token_type: json?.token_type ? String(json.token_type) : null,
  };
}

async function fetchStravaActivities(accessToken: string, after: number) {
  const perPage = 50;
  let page = 1;
  const all: StravaActivity[] = [];

  while (true) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    if (after > 0) url.searchParams.set("after", String(after));

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { json, text } = await readJsonOrText(resp);

    if (!resp.ok) {
      const msg =
        (json && (json.message || json.error)) || `strava_fetch_failed: http_${resp.status}`;
      const snippet = text?.slice(0, 220);
      throw new Error(`${msg}. Body: ${snippet}`);
    }

    const items: StravaActivity[] = Array.isArray(json) ? json : [];
    all.push(...items);

    if (items.length < perPage) break;
    page += 1;
    if (page > 40) break;
  }

  return all;
}

async function fetchStravaStreams(activityId: number, accessToken: string) {
  const url = new URL(`https://www.strava.com/api/v3/activities/${activityId}/streams`);

  // ✅ важно: добавили heartrate + velocity_smooth + distance (fallback)
  // time нужен, потому что preview у нас time_s от старта
  url.searchParams.set("keys", "latlng,time,altitude,heartrate,velocity_smooth,distance");
  url.searchParams.set("key_by_type", "true");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { json, text } = await readJsonOrText(resp);

  if (!resp.ok) {
    const msg =
      (json && (json.message || json.error)) || `strava_streams_failed: http_${resp.status}`;
    const snippet = text?.slice(0, 220);
    throw new Error(`${msg}. Body: ${snippet}`);
  }

  return json;
}

type GpsPayload = {
  time_s: number[];
  lat: number[];
  lon: number[];
  alt_m?: Array<number | null>;
};

function buildGpsPayloadFromStreams(streams: any): GpsPayload | null {
  const latlng = streams?.latlng?.data;
  const time = streams?.time?.data;
  const alt = streams?.altitude?.data;

  if (!Array.isArray(latlng) || !Array.isArray(time) || latlng.length < 2 || time.length < 2) return null;

  const n0 = Math.min(latlng.length, time.length);
  const time_s: number[] = [];
  const lat: number[] = [];
  const lon: number[] = [];
  const alt_m: Array<number | null> = [];

  for (let i = 0; i < n0; i++) {
    const t = time[i];
    const p = latlng[i];
    if (!isNum(t)) continue;
    if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) continue;

    time_s.push(t);
    lat.push(p[0]);
    lon.push(p[1]);

    if (Array.isArray(alt)) alt_m.push(isNum(alt[i]) ? alt[i] : null);
  }

  if (time_s.length < 2) return null;

  const payload: GpsPayload = { time_s, lat, lon };
  if (Array.isArray(alt) && alt_m.length === time_s.length) payload.alt_m = alt_m;

  return payload;
}

// ✅ Preview payload (time_s/hr/pace_s_per_km)
type PreviewPayload = {
  time_s: number[];
  hr: Array<number | null>;
  pace_s_per_km: Array<number | null>;
};

function buildPreviewPayloadFromStreams(streams: any): PreviewPayload | null {
  const time = streams?.time?.data;
  if (!Array.isArray(time) || time.length < 2) return null;

  const hrRaw = streams?.heartrate?.data;
  const velRaw = streams?.velocity_smooth?.data;
  const distRaw = streams?.distance?.data;

  const nCandidates = [
    time.length,
    Array.isArray(hrRaw) ? hrRaw.length : Infinity,
    Array.isArray(velRaw) ? velRaw.length : Infinity,
    Array.isArray(distRaw) ? distRaw.length : Infinity,
  ];
  const n0 = Math.min(...nCandidates);

  if (!Number.isFinite(n0) || n0 < 2) return null;

  const outTime: number[] = [];
  const outHr: Array<number | null> = [];
  const outPace: Array<number | null> = [];

  // если velocity_smooth нет, пробуем оценить скорость по distance/time
  const canUseVel = Array.isArray(velRaw);
  const canUseDist = Array.isArray(distRaw);

  for (let i = 0; i < n0; i++) {
    const t = time[i];
    if (!isNum(t)) continue;

    outTime.push(t);

    // hr
    const h = Array.isArray(hrRaw) ? hrRaw[i] : null;
    outHr.push(isNum(h) && h > 0 ? h : null);

    // speed -> pace
    let speedMs: number | null = null;

    if (canUseVel) {
      const v = velRaw[i];
      speedMs = isNum(v) && v > 0 ? v : null;
    } else if (canUseDist && i > 0) {
      const d0 = distRaw[i - 1];
      const d1 = distRaw[i];
      const t0 = time[i - 1];
      const t1 = time[i];
      if (isNum(d0) && isNum(d1) && isNum(t0) && isNum(t1)) {
        const dt = t1 - t0;
        const dd = d1 - d0;
        if (dt > 0 && dd >= 0) {
          const v = dd / dt;
          speedMs = v > 0 ? v : null;
        }
      }
    }

    if (speedMs && speedMs > 0) outPace.push(Math.round(1000 / speedMs));
    else outPace.push(null);
  }

  if (outTime.length < 2) return null;

  return {
    time_s: outTime,
    hr: outHr,
    pace_s_per_km: outPace,
  };
}

export async function POST() {
  const redirectErrJson = (reason: string, detail?: string, status = 400) =>
    NextResponse.json({ ok: false, reason, detail }, { status });

  try {
    const jar = cookies(); // <-- без await
    const supabase = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options)),
      },
    });

    // 1) session
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return redirectErrJson("no_session", undefined, 401);

    // 2) external_accounts
    const { data: acc, error: accErr } = await supabase
      .from("external_accounts")
      .select(
        "id,user_id,provider,status,access_token,refresh_token,expires_at,token_type,scopes,last_sync_cursor,last_synced_at"
      )
      .eq("user_id", user.id)
      .eq("provider", "strava")
      .maybeSingle();

    if (accErr) return redirectErrJson("db_read_external_accounts", accErr.message, 500);
    if (!acc || acc.status !== "connected") return redirectErrJson("not_connected", "Strava not connected", 400);
    if (!acc.refresh_token) return redirectErrJson("missing_refresh_token", "No refresh_token in DB", 400);

    let accessToken: string | null = acc.access_token ?? null;
    let refreshToken: string = acc.refresh_token;
    let expiresAt: number | null = acc.expires_at ? Number(acc.expires_at) : null;
    let tokenType: string | null = acc.token_type ?? null;

    // 3) refresh token if needed
    const nowSec = Math.floor(Date.now() / 1000);
    const shouldRefresh = !accessToken || !expiresAt || expiresAt <= nowSec + 60;

    if (shouldRefresh) {
      const refreshed = await refreshStravaToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      expiresAt = refreshed.expires_at;
      tokenType = refreshed.token_type;

      const { error: updTokErr } = await supabase
        .from("external_accounts")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: new Date(expiresAt * 1000).toISOString(),
          token_type: tokenType,
          updated_at: new Date().toISOString(),
          error_message: null,
          last_sync_error: null,
          last_sync_error_code: null,
        } as any)
        .eq("id", acc.id);

      if (updTokErr) return redirectErrJson("db_update_tokens", updTokErr.message, 500);
    }

    if (!accessToken) return redirectErrJson("no_access_token", "Access token missing after refresh", 500);

    // 4) cursor
    const after = acc.last_sync_cursor ? Number(acc.last_sync_cursor) : 0;

    // 5) fetch activities
    let all: StravaActivity[] = [];
    try {
      all = await fetchStravaActivities(accessToken, after);
    } catch (e: any) {
      await supabase
        .from("external_accounts")
        .update({
          last_sync_status: "failed",
          last_sync_error: String(e?.message || e),
          error_message: String(e?.message || e),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", acc.id);

      return redirectErrJson("strava_fetch", String(e?.message || e), 401);
    }

    const ids = all.map((a) => String(a.id));
    if (ids.length === 0) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("external_accounts")
        .update({
          last_sync_status: "success",
          last_synced_at: nowIso,
          last_sync_at: nowIso,
          updated_at: nowIso,
          error_message: null,
        } as any)
        .eq("id", acc.id);

      return NextResponse.json({
        ok: true,
        added: 0,
        updated: 0,
        gps_saved: 0,
        gps_failed: 0,
        preview_saved: 0,
        preview_failed: 0,
        gps_fail_reasons: [],
        preview_fail_reasons: [],
        last_synced_at: nowIso,
      });
    }

    // 6) added/updated stats
    const { data: existing } = await supabase
      .from("workouts")
      .select("strava_activity_id")
      .eq("user_id", user.id)
      .in("strava_activity_id", ids);

    const existingSet = new Set((existing || []).map((r: any) => String(r.strava_activity_id)));
    const added = ids.filter((id) => !existingSet.has(id)).length;
    const updated = ids.length - added;

    // 7) upsert workouts
    const rows = all.map((a) => {
      const startTime = a.start_date || null;
      const localDate = startTime ? toLocalDate(startTime) : null;
      const avgSpeedKmh = typeof a.average_speed === "number" ? a.average_speed * 3.6 : null;

      return {
        user_id: user.id,
        source: "strava",
        sport: mapSport(a.type),
        name: a.name || null,
        start_time: startTime,
        local_date: localDate,
        timezone_at_start: a.timezone || null,

        duration_sec: typeof a.elapsed_time === "number" ? a.elapsed_time : null,
        moving_time_sec: typeof a.moving_time === "number" ? a.moving_time : null,
        distance_m: typeof a.distance === "number" ? Math.round(a.distance) : null,
        elev_gain_m: typeof a.total_elevation_gain === "number" ? Math.round(a.total_elevation_gain) : null,

        avg_hr: typeof a.average_heartrate === "number" ? Math.round(a.average_heartrate) : null,
        max_hr: typeof a.max_heartrate === "number" ? Math.round(a.max_heartrate) : null,

        avg_speed_kmh: typeof avgSpeedKmh === "number" ? Number(avgSpeedKmh.toFixed(2)) : null,
        calories_kcal: typeof a.calories === "number" ? Math.round(a.calories) : null,

        strava_activity_id: String(a.id),
        strava_activity_url: `https://www.strava.com/activities/${a.id}`,

        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upErr } = await supabase.from("workouts").upsert(rows as any, {
      onConflict: "user_id,strava_activity_id",
    });

    if (upErr) {
      await supabase
        .from("external_accounts")
        .update({
          last_sync_status: "failed",
          last_sync_error: upErr.message,
          error_message: upErr.message,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", acc.id);

      return redirectErrJson("db_upsert_workouts", upErr.message, 500);
    }

    // 7.1) Streams: GPS + Preview (не валит синхру)
    let gps_saved = 0;
    let gps_failed = 0;
    let preview_saved = 0;
    let preview_failed = 0;

    const gps_fail_reasons: Array<{ activity_id: string; reason: string }> = [];
    const preview_fail_reasons: Array<{ activity_id: string; reason: string }> = [];

    const { data: wmap, error: wmapErr } = await supabase
      .from("workouts")
      .select("id,strava_activity_id")
      .eq("user_id", user.id)
      .in("strava_activity_id", ids);

    if (!wmapErr && Array.isArray(wmap) && wmap.length) {
      const idByStrava = new Map<string, string>();
      for (const r of wmap as any[]) {
        if (r?.id && r?.strava_activity_id) idByStrava.set(String(r.strava_activity_id), String(r.id));
      }

      // лимит по API/скорости — можно поднять позже
      const MAX_STREAMS_FETCH = 60;

      for (let i = 0; i < all.length && i < MAX_STREAMS_FETCH; i++) {
        const a = all[i];
        const workoutId = idByStrava.get(String(a.id));
        if (!workoutId) continue;

        try {
          const streams = await fetchStravaStreams(a.id, accessToken);

          // ---- GPS ----
          try {
            const payload = buildGpsPayloadFromStreams(streams);
            if (payload) {
              const MAX_POINTS = 5000;
              const n = payload.time_s.length;

              let time_s = payload.time_s;
              let lat = payload.lat;
              let lon = payload.lon;
              let alt_m = payload.alt_m;

              if (n > MAX_POINTS) {
                const idx = downsampleEvenly(Array.from({ length: n }, (_, k) => k), MAX_POINTS);
                time_s = idx.map((k) => time_s[k]);
                lat = idx.map((k) => lat[k]);
                lon = idx.map((k) => lon[k]);
                if (alt_m) alt_m = idx.map((k) => alt_m![k] ?? null);
              }

              const s = {
                time_s,
                lat,
                lon,
                ...(alt_m ? { alt_m } : {}),
              };

              const upGps = await supabase.from("workout_gps_streams").upsert(
                [
                  {
                    workout_id: workoutId,
                    user_id: user.id,
                    points_count: time_s.length,
                    s,
                    updated_at: new Date().toISOString(),
                  },
                ] as any,
                { onConflict: "workout_id" }
              );

              if (upGps.error) {
                gps_failed += 1;
                const reason = `db_upsert_failed: ${upGps.error.message}`;
                gps_fail_reasons.push({ activity_id: String(a.id), reason });
                console.warn("[strava] gps upsert failed", a.id, upGps.error.message);
              } else {
                gps_saved += 1;
              }
            } else {
              gps_failed += 1;
              gps_fail_reasons.push({ activity_id: String(a.id), reason: "no_latlng_or_time" });
            }
          } catch (e: any) {
            gps_failed += 1;
            gps_fail_reasons.push({
              activity_id: String(a.id),
              reason: `gps_exception: ${String(e?.message ?? e)}`,
            });
            console.warn("[strava] gps exception", a.id, e?.message ?? e);
          }

          // ---- Preview (hr + pace) ----
          try {
            const preview = buildPreviewPayloadFromStreams(streams);
            if (preview) {
              const MAX_PREVIEW_POINTS = 1500;

              const n = preview.time_s.length;
              let idx = Array.from({ length: n }, (_, k) => k);
              if (n > MAX_PREVIEW_POINTS) idx = downsampleEvenly(idx, MAX_PREVIEW_POINTS);

              const time_s = idx.map((k) => preview.time_s[k]);
              const hr = idx.map((k) => (isNum(preview.hr[k] as any) ? (preview.hr[k] as number) : null));
              const pace_s_per_km = idx.map((k) =>
                isNum(preview.pace_s_per_km[k] as any) ? (preview.pace_s_per_km[k] as number) : null
              );

              const points_count = time_s.length;

              const upPrev = await supabase.from("workout_streams_preview").upsert(
                [
                  {
                    workout_id: workoutId,
                    user_id: user.id,
                    points_count,
                    s: { time_s, hr, pace_s_per_km },
                    updated_at: new Date().toISOString(),
                  },
                ] as any,
                { onConflict: "workout_id" }
              );

              if (upPrev.error) {
                preview_failed += 1;
                const reason = `db_upsert_failed: ${upPrev.error.message}`;
                preview_fail_reasons.push({ activity_id: String(a.id), reason });
                console.warn("[strava] preview upsert failed", a.id, upPrev.error.message);
              } else {
                preview_saved += 1;
              }
            } else {
              preview_failed += 1;
              preview_fail_reasons.push({
                activity_id: String(a.id),
                reason: "no_time_or_no_streams_for_preview",
              });
            }
          } catch (e: any) {
            preview_failed += 1;
            preview_fail_reasons.push({
              activity_id: String(a.id),
              reason: `preview_exception: ${String(e?.message ?? e)}`,
            });
            console.warn("[strava] preview exception", a.id, e?.message ?? e);
          }
        } catch (e: any) {
          // streams fetch fail
          gps_failed += 1;
          preview_failed += 1;
          const reason = `streams_fetch_failed: ${String(e?.message ?? e)}`;
          gps_fail_reasons.push({ activity_id: String(a.id), reason });
          preview_fail_reasons.push({ activity_id: String(a.id), reason });
          console.warn("[strava] streams fetch failed", a.id, e?.message ?? e);
        }
      }
    }

    // 8) update cursor
    let newCursor = after;
    for (const a of all) {
      const t = a.start_date ? Math.floor(new Date(a.start_date).getTime() / 1000) : 0;
      if (t > newCursor) newCursor = t;
    }

    const nowIso = new Date().toISOString();
    const { error: updAccErr } = await supabase
      .from("external_accounts")
      .update({
        last_sync_status: "success",
        last_sync_error: null,
        error_message: null,
        last_sync_at: nowIso,
        last_synced_at: nowIso,
        last_sync_cursor: String(newCursor),
        updated_at: nowIso,
      } as any)
      .eq("id", acc.id);

    if (updAccErr) return redirectErrJson("db_update_external_accounts", updAccErr.message, 500);

    return NextResponse.json({
      ok: true,
      added,
      updated,
      gps_saved,
      gps_failed,
      preview_saved,
      preview_failed,
      gps_fail_reasons: gps_fail_reasons.slice(0, 20),
      preview_fail_reasons: preview_fail_reasons.slice(0, 20),
      last_synced_at: nowIso,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: "sync_fatal", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, reason: "method_not_allowed" }, { status: 405 });
}