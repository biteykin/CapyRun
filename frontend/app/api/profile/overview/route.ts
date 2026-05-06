import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { differenceInYears } from "date-fns";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_url, sex, birth_date, weight_kg, height_cm, hr_max, hr_zones, country_code, city"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const { data: stats, error: statsErr } = await supabase
    .from("profile_stats_cache")
    .select(
      "workouts_count,total_hours,total_distance_km,last_workout_at,primary_sport,updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 });

  const displayName =
    (prof?.display_name && String(prof.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Спортивная Капибара";

  const avatarUrl =
    (prof?.avatar_url && String(prof.avatar_url)) ||
    (user.user_metadata?.avatar_url && String(user.user_metadata.avatar_url)) ||
    "/avatars/default-1.svg";

  return NextResponse.json({
    user: { id: user.id, email: user.email ?? null },
    header: {
      displayName,
      avatarUrl,
      stats,
    },
    profileData: {
      userId: user.id,
      age: prof?.birth_date
        ? differenceInYears(new Date(), new Date(prof.birth_date))
        : null,
      workoutsCount: stats?.workouts_count ?? null,
      gender: prof?.sex ?? null,
      weight: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
      height: prof?.height_cm != null ? Number(prof.height_cm) : null,
      max_hr: prof?.hr_max ?? null,
      hr_zones: prof?.hr_zones ?? null,
      country_code: prof?.country_code ?? null,
      city: prof?.city ?? null,
    },
  });
}

