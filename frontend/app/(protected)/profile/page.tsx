export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import ProfileHeader from "@/components/profile/profile-header";
import ProfileContent from "@/components/profile/profile-content";
import { differenceInYears } from "date-fns";
import { Button } from "@/components/ui/button";

// ВАЖНО: для server action нужны эти импорты
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // тянем профиль текущего пользователя
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, sex, birth_date, weight_kg, height_cm, hr_max, hr_zones")
    .eq("user_id", user.id)
    .maybeSingle();

  // тянем кэш-статистику профиля (лёгкий запрос)
  const { data: stats, error: statsErr } = await supabase
    .from("profile_stats_cache")
    .select("workouts_count,total_hours,total_distance_km,last_workout_at,primary_sport,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (statsErr) {
    console.error("profile_stats_cache fetch error", statsErr);
  }

  const displayName =
    (prof?.display_name && String(prof.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Спортивная Капибара";

  const avatarUrl =
    (prof?.avatar_url && String(prof.avatar_url)) ||
    (user.user_metadata?.avatar_url && String(user.user_metadata.avatar_url)) ||
    "/avatars/default-1.svg";

  const age = prof?.birth_date ? differenceInYears(new Date(), new Date(prof.birth_date)) : null;
  const profileData = {
    age,
    gender: prof?.sex ?? null,
    weight: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
    height: prof?.height_cm != null ? Number(prof.height_cm) : null,
    max_hr: prof?.hr_max ?? null,
    hr_zones: prof?.hr_zones ?? null,
  };

  const workoutsCount = stats?.workouts_count ?? null;
  const totalHours = stats?.total_hours != null ? Number(stats.total_hours) : null;
  const totalKm = stats?.total_distance_km != null ? Number(stats.total_distance_km) : null;
  const lastWorkoutAt = stats?.last_workout_at ? new Date(stats.last_workout_at) : null;
  const primarySport = stats?.primary_sport ? String(stats.primary_sport) : null;

  return (
    <main className="space-y-3">
      {/* Действия: кнопка должна быть НАД плашкой профиля, справа */}
      <div className="flex justify-end">
        <Link href="/profile/edit" className="inline-flex">
          <Button variant="secondary" size="sm" type="button">Редактировать профиль</Button>
        </Link>
      </div>

      <ProfileHeader
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={user.email ?? null}
        stats={{
          workoutsCount,
          totalKm,
          totalHours,
          lastWorkoutAt,
          primarySport,
          updatedAt: stats?.updated_at ? new Date(stats.updated_at) : null,
        }}
      />

      <ProfileContent profile={profileData} />
    </main>
  );
}