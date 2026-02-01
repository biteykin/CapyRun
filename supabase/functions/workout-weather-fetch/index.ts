// supabase/functions/workout-weather-fetch/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uvLevel(uv: number | null): string | null {
  if (uv == null || Number.isNaN(uv)) return null;
  if (uv <= 2) return "low";
  if (uv <= 5) return "moderate";
  if (uv <= 7) return "high";
  if (uv <= 10) return "very_high";
  return "extreme";
}

function weatherCodeToCondition(code: number | null): string | null {
  if (code == null || Number.isNaN(code)) return null;
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "clouds";
  if (code >= 45 && code <= 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95 && code <= 99) return "storm";
  return "clouds";
}

function pickClosestHourIndex(times: string[], target: Date): number {
  const t = target.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i] + "Z").getTime();
    const diff = Math.abs(dt - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function isValidGeoPoint(lat: number | null, lng: number | null): boolean {
  // ваше подтверждённое правило:
  // abs(lat) >= 0.1 AND abs(lon) >= 0.1
  return lat != null && lng != null && Math.abs(lat) >= 0.1 && Math.abs(lng) >= 0.1;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        {
          ok: false,
          error: "missing_env",
          hint: "Set SUPABASE_URL and SERVICE_ROLE_KEY as function secrets",
        },
        500,
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json().catch(() => ({}))) as { workout_id?: string };
    const workoutId = body?.workout_id;

    if (!workoutId) {
      return json({ ok: false, error: "missing_workout_id" }, 400);
    }

    // 1) берём стартовое время тренировки
    const { data: w, error: wErr } = await supabase
      .from("workouts")
      .select("id, start_time, created_at")
      .eq("id", workoutId)
      .maybeSingle();

    if (wErr) return json({ ok: false, error: "db_workouts_error", details: wErr.message }, 500);
    if (!w) return json({ ok: false, error: "workout_not_found", workout_id: workoutId }, 404);

    const startedAt = new Date((w.start_time ?? w.created_at) as string);
    if (Number.isNaN(startedAt.getTime())) {
      return json({ ok: false, error: "bad_start_time" }, 500);
    }

    // 2) берём координаты из workout_weather
    const { data: ww, error: wwErr } = await supabase
      .from("workout_weather")
      .select("workout_id, lat, lng, season, source")
      .eq("workout_id", workoutId)
      .maybeSingle();

    if (wwErr) return json({ ok: false, error: "db_workout_weather_error", details: wwErr.message }, 500);
    if (!ww) return json({ ok: false, error: "workout_weather_row_missing" }, 409);

    const lat = (ww.lat as number | null) ?? null;
    const lng = (ww.lng as number | null) ?? null;

    if (!isValidGeoPoint(lat, lng)) {
      return json(
        {
          ok: false,
          error: "no_valid_coords",
          dbg: { workout_id: workoutId, lat, lng, season: ww.season, source: ww.source },
        },
        200,
      );
    }

    const dateStr = toISODateUTC(startedAt);
    const url =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${encodeURIComponent(String(lat))}` +
      `&longitude=${encodeURIComponent(String(lng))}` +
      `&start_date=${dateStr}` +
      `&end_date=${dateStr}` +
      `&hourly=temperature_2m,apparent_temperature,precipitation,weathercode,windspeed_10m,uv_index` +
      `&timezone=UTC`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return json({ ok: false, error: "open_meteo_http_failed", status: resp.status, url }, 200);
    }

    const data = (await resp.json()) as any;

    const times: string[] = data?.hourly?.time ?? [];
    const t2m: Array<number | null> = data?.hourly?.temperature_2m ?? [];
    const app: Array<number | null> = data?.hourly?.apparent_temperature ?? [];
    const pr: Array<number | null> = data?.hourly?.precipitation ?? [];
    const wc: Array<number | null> = data?.hourly?.weathercode ?? [];
    const wind: Array<number | null> = data?.hourly?.windspeed_10m ?? [];
    const uv: Array<number | null> = data?.hourly?.uv_index ?? [];

    if (!times.length) {
      return json({ ok: false, error: "open_meteo_no_hourly_time", url }, 200);
    }

    const idx = pickClosestHourIndex(times, startedAt);

    const temperature_c = t2m[idx] ?? null;
    const feels_like_c = app[idx] ?? null;
    const precipitation_mm = pr[idx] ?? null;
    const wind_ms = wind[idx] == null ? null : wind[idx] / 3.6; // km/h -> m/s
    const uv_index = uv[idx] ?? null;
    const uv_level = uvLevel(uv_index);
    const condition = weatherCodeToCondition(wc[idx] ?? null);

    const nowIso = new Date().toISOString();

    const { error: upErr } = await supabase
      .from("workout_weather")
      .update({
        temperature_c,
        feels_like_c,
        wind_ms,
        precipitation_mm,
        uv_index,
        uv_level,
        condition,
        source: "open-meteo",
        fetched_at: nowIso,
        updated_at: nowIso,
      })
      .eq("workout_id", workoutId);

    if (upErr) {
      return json({ ok: false, error: "db_update_failed", details: upErr.message }, 500);
    }

    return json({
      ok: true,
      workout_id: workoutId,
      url,
      picked_hour_utc: times[idx],
      values: {
        temperature_c,
        feels_like_c,
        wind_ms,
        precipitation_mm,
        uv_index,
        uv_level,
        condition,
      },
    });
  } catch (e) {
    return json({ ok: false, error: "unhandled", details: String(e) }, 500);
  }
});