export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import ProfileHeader from "@/components/profile/profile-header";
import ProfileContent from "@/components/profile/profile-content";
import { differenceInYears } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    .select(
      "display_name, avatar_url, sex, birth_date, weight_kg, height_cm, hr_max, hr_zones"
    )
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

  // заголовок (аватар/имя/email)
  const displayName =
    (prof?.display_name && String(prof.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Спортивная Капибара";

  const avatarUrl =
    (prof?.avatar_url && String(prof.avatar_url)) ||
    (user.user_metadata?.avatar_url && String(user.user_metadata.avatar_url)) ||
    "/avatars/default-1.svg";

  // маппинг под ProfileContent
  const age =
    prof?.birth_date ? differenceInYears(new Date(), new Date(prof.birth_date)) : null;
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
      {/* Действия — между шапкой (хлебные крошки) и плашкой профиля */}
      <div className="flex justify-end">
        <Link href="/profile/edit" className="inline-flex">
          <Button variant="secondary" size="sm" type="button">
            Редактировать профиль
          </Button>
        </Link>
      </div>

      <ProfileHeader
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={user.email ?? null}
      />

      {/* Статистика профиля (из profile_stats_cache) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Статистика</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Тренировок</div>
              <div className="text-lg font-semibold">{workoutsCount ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Дистанция</div>
              <div className="text-lg font-semibold">
                {totalKm != null ? `${totalKm.toFixed(1)} км` : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Время</div>
              <div className="text-lg font-semibold">
                {totalHours != null ? `${totalHours.toFixed(1)} ч` : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Последняя</div>
              <div className="text-sm font-medium">
                {lastWorkoutAt
                  ? lastWorkoutAt.toLocaleString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </div>
            </div>
          </div>

          {(primarySport || stats?.updated_at) && (
            <div className="mt-4 text-xs text-muted-foreground">
              {primarySport ? (
                <>
                  Основной спорт: <span className="font-medium">{primarySport}</span>
                </>
              ) : null}
              {primarySport && stats?.updated_at ? <> · </> : null}
              {stats?.updated_at ? (
                <>
                  Обновлено:{" "}
                  <span className="font-medium">
                    {new Date(stats.updated_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <ProfileContent profile={profileData} />
    </main>
  );
}