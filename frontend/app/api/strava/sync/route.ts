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
  // берём YYYY-MM-DD из UTC start_date, это нормально для MVP
  return isoUtc?.slice(0, 10) ?? null;
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

  const json: any = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.message || "strava_refresh_failed");
  }

  return {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token),
    expires_at: Number(json.expires_at),
    token_type: json.token_type ? String(json.token_type) : null,
  };
}

export async function POST() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

    // 2) load external_accounts
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

      if (updTokErr) {
        return redirectErrJson("db_update_tokens", updTokErr.message, 500);
      }
    }

    if (!accessToken) return redirectErrJson("no_access_token", "Access token missing after refresh", 500);

    // 4) incremental cursor (after)
    // last_sync_cursor будем хранить как unix seconds
    const after = acc.last_sync_cursor ? Number(acc.last_sync_cursor) : 0;

    // 5) fetch activities (paging)
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

      const json: any = await resp.json();
      if (!resp.ok) {
        // сохраним ошибку синхры в external_accounts
        await supabase
          .from("external_accounts")
          .update({
            last_sync_status: "failed",
            last_sync_error: json?.message || "strava_fetch_failed",
            error_message: json?.message || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", acc.id);

        return redirectErrJson("strava_fetch", json?.message || JSON.stringify(json), 401);
      }

      const items: StravaActivity[] = Array.isArray(json) ? json : [];
      all.push(...items);

      if (items.length < perPage) break;
      page += 1;

      // предохранитель, чтобы случайно не улететь в бесконечность
      if (page > 40) break; // 2000 активностей за раз — более чем
    }

    // 6) pre-count new vs update
    const ids = all.map((a) => String(a.id));
    let added = 0;
    let updated = 0;

    if (ids.length === 0) {
      // обновим статус и last_synced_at
      await supabase
        .from("external_accounts")
        .update({
          last_sync_status: "success",
          last_synced_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        } as any)
        .eq("id", acc.id);

      return NextResponse.json({ ok: true, added: 0, updated: 0, last_synced_at: new Date().toISOString() });
    }

    const { data: existing } = await supabase
      .from("workouts")
      .select("strava_activity_id")
      .eq("user_id", user.id)
      .in("strava_activity_id", ids);

    const existingSet = new Set((existing || []).map((r: any) => String(r.strava_activity_id)));
    added = ids.filter((id) => !existingSet.has(id)).length;
    updated = ids.length - added;

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

        // strava-specific
        strava_activity_id: String(a.id),
        strava_activity_url: `https://www.strava.com/activities/${a.id}`,

        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // ВАЖНО:
    // Этот onConflict работает только если у тебя есть UNIQUE(user_id, strava_activity_id)
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

    // 8) update cursor = max(start_date) unix seconds
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

    if (updAccErr) {
      return redirectErrJson("db_update_external_accounts", updAccErr.message, 500);
    }

    return NextResponse.json({ ok: true, added, updated, last_synced_at: nowIso });
  } catch (e: any) {
    // если что-то упало до supabase update — хотя бы отдаём ответ
    return NextResponse.json({ ok: false, reason: "sync_fatal", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

// (не обязательно, но полезно для отладки)
export async function GET() {
  return NextResponse.json({ ok: false, reason: "method_not_allowed" }, { status: 405 });
}