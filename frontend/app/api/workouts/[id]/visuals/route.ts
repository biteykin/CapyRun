import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: workout, error: workoutErr } = await supabase
    .from("workouts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (workoutErr) {
    return NextResponse.json({ error: workoutErr.message }, { status: 500 });
  }

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [streamsRes, gpsRes, profileRes] = await Promise.all([
    supabase
      .from("workout_streams_preview")
      .select("*")
      .eq("workout_id", id)
      .maybeSingle(),
    supabase
      .from("workout_gps_streams")
      .select("*")
      .eq("workout_id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("hr_max, hr_zones")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (streamsRes.error) {
    return NextResponse.json({ error: streamsRes.error.message }, { status: 500 });
  }
  if (gpsRes.error) {
    return NextResponse.json({ error: gpsRes.error.message }, { status: 500 });
  }
  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    streams: streamsRes.data ?? null,
    gps: gpsRes.data ?? null,
    profile: profileRes.data ?? null,
  });
}

