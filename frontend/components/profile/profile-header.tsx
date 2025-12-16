import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail } from "lucide-react";

type Props = {
  avatarUrl?: string | null;
  displayName: string;
  email: string | null;
  stats?: {
    workoutsCount: number | null;
    totalKm: number | null;
    totalHours: number | null;
    lastWorkoutAt: Date | null;
    primarySport: string | null;
    updatedAt: Date | null;
  };
};

export default function ProfileHeader({ avatarUrl, displayName, email, stats }: Props) {
  // как просил: не меняю путь
  const fallbackAvatar = "/avatars/default-1.svg";
  const src = avatarUrl || fallbackAvatar;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={src} alt="Profile" />
            <AvatarFallback className="text-2xl">
              {(displayName?.[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold">
              {displayName || "Резвая Капибара"}
            </h1>

            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-4" />
                  {email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Статистика — в той же карточке (как просил) */}
        {stats && (
          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Тренировок</div>
                <div className="text-lg font-semibold">{stats.workoutsCount ?? "—"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Дистанция</div>
                <div className="text-lg font-semibold">
                  {stats.totalKm != null ? `${stats.totalKm.toFixed(1)} км` : "—"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Время</div>
                <div className="text-lg font-semibold">
                  {stats.totalHours != null ? `${stats.totalHours.toFixed(1)} ч` : "—"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Последняя</div>
                <div className="text-sm font-medium">
                  {stats.lastWorkoutAt
                    ? stats.lastWorkoutAt.toLocaleString(undefined, {
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

            {(stats.primarySport || stats.updatedAt) && (
              <div className="mt-3 text-xs text-muted-foreground">
                {stats.primarySport ? (
                  <>Основной спорт: <span className="font-medium">{stats.primarySport}</span></>
                ) : null}
                {stats.primarySport && stats.updatedAt ? <> · </> : null}
                {stats.updatedAt ? (
                  <>Обновлено: <span className="font-medium">
                    {stats.updatedAt.toLocaleString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span></>
                ) : null}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}