import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const WORKOUT_SELECT = `
  id,user_id,start_time,local_date,uploaded_at,sport,sub_sport,
  duration_sec,moving_time_sec,distance_m,avg_hr,calories_kcal,
  name,description,visibility,weekday_iso,created_at,updated_at
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
  "swim_pool_length_m",
  "gym_exercises_count",
  "gym_sets_count",
  "gym_reps_total",
  "gym_volume_kg",
  "visibility",
] as const;

function pickWorkoutPatch(body: any) {
  const patch: Record<string, unknown> = {};
  for (const field of WORKOUT_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      patch[field] = body[field];
    }
  }
  return patch;
}

export async function GET(req: NextRequest) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 1000), 1), 1000);

  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("start_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patch = pickWorkoutPatch(body);

  if (!patch.start_time && !patch.local_date) {
    return NextResponse.json({ error: "start_time or local_date is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workouts")
    .insert({
      ...patch,
      user_id: user.id,
      source: body?.source ?? "manual",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ workout: data }, { status: 201 });
}
