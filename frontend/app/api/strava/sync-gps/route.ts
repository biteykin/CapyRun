// frontend/app/api/strava/sync-gps/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
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

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Strava иногда отдаёт HTML/не-JSON при сетевых/прокси проблемах
    throw new Error(`strava_refresh_failed: non_json. Body: ${text.slice(0, 300)}`);
  }

  if (!resp.ok) {
    throw new Error(`strava_refresh_failed: ${json?.message || "unknown"}`);
  }

  return {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token),
    expires_at: Number(json.expires_at),
    token_type: json.token_type ? String(json.token_type) : null,
  };
}

async function fetchStravaStreams(activityId: string, accessToken: string) {
  // key_by_type=true => ответ объектом { latlng: {data: [...]}, time: {data:[...]} }
  const url = new URL(`https://www.strava.com/api/v3/activities/${activityId}/streams`);
  url.searchParams.set("keys", "latlng,time");
  url.searchParams.set("key_by_type", "true");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`strava_streams_non_json: ${resp.status}. Body: ${text.slice(0, 250)}`);
  }

  if (!resp.ok) {
    throw new Error(`strava_streams_failed: ${resp.status}. ${json?.message || text.slice(0, 250)}`);
  }

  // ожидаем json.latlng.data = [[lat,lng],...]
  const latlng = json?.latlng?.data;
  const time = json?.time?.data;

  const lat: number[] = [];
  const lng: number[] = [];
  if (Array.isArray(latlng)) {
    for (const p of latlng) {
      if (Array.isArray(p) && p.length >= 2) {
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          lat.push(a);
          lng.push(b);
        }
      }
    }
  }

  const time_s: number[] = Array.isArray(time)
    ? time.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x))
    : [];

  return { lat, lng, time_s };
}

export async function POST() {
  const redirectErrJson = (reason: string, detail?: string, status = 400) =>
    NextResponse.json({ ok: false, reason, detail }, { status });

  try {
    const jar = await cookies();
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

    // 2) external_accounts (strava)
    const { data: acc, error: accErr } = await supabase
      .from("external_accounts")
      .select("id,user_id,provider,status,access_token,refresh_token,expires_at,token_type")
      .eq("user_id", user.id)
      .eq("provider", "strava")
      .maybeSingle();

    if (accErr) return redirectErrJson("db_read_external_accounts", accErr.message, 500);
    if (!acc || acc.status !== "connected") return redirectErrJson("not_connected", "Strava not connected", 400);
    if (!acc.refresh_token) return redirectErrJson("missing_refresh_token", "No refresh_token in DB", 400);

    let accessToken: string | null = acc.access_token ?? null;
    let refreshToken: string = acc.refresh_token;
    let expiresAt: number | null = acc.expires_at ? Math.floor(new Date(acc.expires_at).getTime() / 1000) : null;
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

    if (!accessToken) return redirectErrJson("no_access_token", "Access token missing", 500);

    // 4) выбрать тренировки без GPS
    // ВАЖНО: подправь имя таблицы workout_gps_streams если у тебя другое.
    const { data: toProcess, error: wErr } = await supabase.rpc("workouts_missing_gps", {
      p_user_id: user.id,
      p_limit: 25,
    });

    // Если RPC нет — используем “план Б”: просто возьмем последние 50 и проверим в коде (хуже, но работает).
    if (wErr) {
      // fallback: берём последние и потом проверим через select в gps таблице
      const { data: ws, error: wsErr } = await supabase
        .from("workouts")
        .select("id,strava_activity_id")
        .eq("user_id", user.id)
        .eq("source", "strava")
        .not("strava_activity_id", "is", null)
        .order("start_time", { ascending: false })
        .limit(50);

      if (wsErr) return redirectErrJson("db_read_workouts", wsErr.message, 500);

      const candidates = (ws || []).filter((x: any) => x?.strava_activity_id);

      // проверим какие реально отсутствуют в gps таблице
      const ids = candidates.map((x: any) => x.id);
      const { data: existingGps, error: gpsErr } = await supabase
        .from("workout_gps_streams")
        .select("workout_id")
        .in("workout_id", ids);

      if (gpsErr) return redirectErrJson("db_read_gps", gpsErr.message, 500);

      const has = new Set((existingGps || []).map((x: any) => String(x.workout_id)));
      const missing = candidates.filter((x: any) => !has.has(String(x.id))).slice(0, 25);

      // обработаем missing
      let processed = 0;
      let skippedNoLatLng = 0;
      const errors: Array<{ workout_id: string; activity_id: string; error: string }> = [];

      for (const w of missing) {
        try {
          const workoutId = String(w.id);
          const activityId = String(w.strava_activity_id);

          const { lat, lng, time_s } = await fetchStravaStreams(activityId, accessToken);

          if (!lat.length || !lng.length) {
            skippedNoLatLng++;
            continue;
          }

          const points_count = Math.min(lat.length, lng.length, time_s.length ? time_s.length : Infinity);

          const s: any = {
            lat: lat.slice(0, points_count),
            lng: lng.slice(0, points_count),
          };
          if (time_s.length) s.time_s = time_s.slice(0, points_count);

          const nowIso = new Date().toISOString();
          const { error: upGpsErr } = await supabase
            .from("workout_gps_streams")
            .upsert(
              {
                workout_id: workoutId,
                user_id: user.id,
                points_count,
                s,
                updated_at: nowIso,
                created_at: nowIso,
              } as any,
              { onConflict: "workout_id" }
            );

          if (upGpsErr) throw upGpsErr;

          processed++;
        } catch (e: any) {
          errors.push({
            workout_id: String(w.id),
            activity_id: String(w.strava_activity_id),
            error: String(e?.message || e),
          });
        }
      }

      return NextResponse.json({
        ok: true,
        mode: "fallback",
        processed,
        skippedNoLatLng,
        errors,
      });
    }

    // 5) если RPC есть (лучший путь)
    const items: Array<{ workout_id: string; strava_activity_id: string }> = Array.isArray(toProcess)
      ? toProcess
      : [];

    let processed = 0;
    let skippedNoLatLng = 0;
    const errors: Array<{ workout_id: string; activity_id: string; error: string }> = [];

    for (const it of items) {
      try {
        const workoutId = String(it.workout_id);
        const activityId = String(it.strava_activity_id);

        const { lat, lng, time_s } = await fetchStravaStreams(activityId, accessToken);

        if (!lat.length || !lng.length) {
          skippedNoLatLng++;
          continue;
        }

        const points_count = Math.min(lat.length, lng.length, time_s.length ? time_s.length : Infinity);

        const s: any = {
          lat: lat.slice(0, points_count),
          lng: lng.slice(0, points_count),
        };
        if (time_s.length) s.time_s = time_s.slice(0, points_count);

        const nowIso = new Date().toISOString();
        const { error: upGpsErr } = await supabase
          .from("workout_gps_streams")
          .upsert(
            {
              workout_id: workoutId,
              user_id: user.id,
              points_count,
              s,
              updated_at: nowIso,
              created_at: nowIso,
            } as any,
            { onConflict: "workout_id" }
          );

        if (upGpsErr) throw upGpsErr;

        processed++;
      } catch (e: any) {
        errors.push({
          workout_id: String(it.workout_id),
          activity_id: String(it.strava_activity_id),
          error: String(e?.message || e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "rpc",
      processed,
      skippedNoLatLng,
      total_candidates: items.length,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: "sync_gps_fatal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

// (не обязательно)
export async function GET() {
  return NextResponse.json({ ok: false, reason: "method_not_allowed" }, { status: 405 });
}