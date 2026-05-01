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
  "swim_pool_length_m",
  "gym_exercises_count",
  "gym_sets_count",
  "gym_reps_total",
  "gym_volume_kg",
] as const;

export async function GET(req: Request) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 1000);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 1000;

  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("start_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    user_id: user.id,
  };

  for (const field of WORKOUT_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      patch[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from("workouts")
    .insert(patch)
    .select(WORKOUT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workout: data }, { status: 201 });
}
