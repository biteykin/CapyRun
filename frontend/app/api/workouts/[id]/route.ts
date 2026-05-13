//frontend/app/api/workouts/[id]/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const WORKOUT_SELECT = `
  id,user_id,start_time,local_date,uploaded_at,created_at,updated_at,
  sport,sub_sport,duration_sec,moving_time_sec,distance_m,avg_hr,max_hr,
  calories_kcal,name,description,visibility,weekday_iso,source,filename,
  size_bytes,timezone_at_start,elev_gain_m,elev_loss_m,avg_power_w,max_power_w,
  np_power_w,avg_cadence_spm,avg_cadence_rpm,avg_pace_s_per_km,trimp,ef,
  pa_hr_pct,intensity_factor,training_load_score,laps_count,has_gps,
  avg_swim_pace_s_per_100m,swim_pool_length_m,swim_stroke_primary,
  swim_swolf_avg,weather,hr_zone_time,perceived_exertion,strava_activity_url
`;

const WORKOUT_PATCH_FIELDS = [
  "name",
  "description",
  "sport",
  "sub_sport",
  "start_time",
  "local_date",
  "distance_m",
  "duration_sec",
  "moving_time_sec",
  "calories_kcal",
  "visibility",
] as const;

async function getUser() {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user, error };
}

function mapWorkoutWeather(row: any) {
  if (!row) return null;

  const windMs =
    typeof row.wind_ms === "number" && Number.isFinite(row.wind_ms)
      ? row.wind_ms
      : null;

  return {
    temp_c: row.temperature_c ?? null,
    feelslike_c: row.feels_like_c ?? null,
    wind_kph: windMs == null ? null : windMs * 3.6,
    precip_mm: row.precipitation_mm ?? null,
    conditions: row.condition ?? null,
    uv: row.uv_index ?? null,
    uv_level: row.uv_level ?? null,
    source: row.source ?? null,
    fetched_at: row.fetched_at ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { supabase, user, error: userError } = await getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: weatherRow, error: weatherError } = await supabase
    .from("workout_weather")
    .select(
      [
        "workout_id",
        "lat",
        "lng",
        "temperature_c",
        "feels_like_c",
        "wind_ms",
        "precipitation_mm",
        "condition",
        "uv_index",
        "uv_level",
        "source",
        "fetched_at",
      ].join(",")
    )
    .eq("workout_id", id)
    .maybeSingle();

  if (weatherError) console.warn("[api/workouts/:id] workout_weather error", weatherError);

  return NextResponse.json({
    workout: { ...data, weather: mapWorkoutWeather(weatherRow) ?? data.weather },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { supabase, user, error: userError } = await getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  for (const field of WORKOUT_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body ?? {}, field)) {
      patch[field] = (body as Record<string, unknown>)[field];
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No supported workout fields provided" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("workouts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select(WORKOUT_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ workout: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { supabase, user, error: userError } = await getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("workouts")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
