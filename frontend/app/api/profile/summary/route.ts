//frontend/app/api/profile/summary/route.ts

import { NextResponse } from "next/server";
import { differenceInYears } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_url, sex, birth_date, weight_kg, height_cm, hr_max, hr_zones, country_code, city"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: stats, error: statsErr } = await supabase
    .from("profile_stats_cache")
    .select("workouts_count,total_hours,total_distance_km,last_workout_at,primary_sport,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (statsErr) console.error("profile_stats_cache fetch error", statsErr);

  const displayName =
    (prof?.display_name && String(prof.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Спортивная Капибара";

  const avatarUrl =
    (prof?.avatar_url && String(prof.avatar_url)) ||
    (user.user_metadata?.avatar_url && String(user.user_metadata.avatar_url)) ||
    "/avatars/default-1.svg";

  const age = prof?.birth_date
    ? differenceInYears(new Date(), new Date(prof.birth_date))
    : null;

  return NextResponse.json({
    displayName,
    avatarUrl,
    email: user.email ?? null,
    profileData: {
      userId: user.id,
      age,
      workoutsCount: stats?.workouts_count ?? null,
      gender: prof?.sex ?? null,
      weight: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
      height: prof?.height_cm != null ? Number(prof.height_cm) : null,
      max_hr: prof?.hr_max ?? null,
      hr_zones: prof?.hr_zones ?? null,
      country_code: prof?.country_code ?? null,
      city: prof?.city ?? null,
    },
    stats: {
      workoutsCount: stats?.workouts_count ?? null,
      totalHours: stats?.total_hours != null ? Number(stats.total_hours) : null,
      totalKm: stats?.total_distance_km != null ? Number(stats.total_distance_km) : null,
      lastWorkoutAt: stats?.last_workout_at ?? null,
      primarySport: stats?.primary_sport ? String(stats.primary_sport) : null,
      updatedAt: stats?.updated_at ?? null,
    },
  });
}

