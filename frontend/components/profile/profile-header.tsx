import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, Clock3, Mail, MapPin, Route } from "lucide-react";
import { humanSport, sportColor } from "@/components/ui/sport-theme";

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
  const fallbackAvatar = "/avatars/default-1.svg";
  const src = avatarUrl || fallbackAvatar;
  const primarySportLabel = stats?.primarySport ? humanSport(stats.primarySport) : null;
  const primarySportDot = stats?.primarySport ? sportColor(stats.primarySport) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-sm">
            <AvatarImage src={src} alt="Profile" />
            <AvatarFallback className="text-2xl">
              {(displayName?.[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="truncate text-2xl font-bold">
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

            <div className="flex flex-wrap gap-2">
              {primarySportLabel ? (
                <span className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1.5 text-sm font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: primarySportDot ?? "currentColor" }}
                    aria-hidden
                  />
                  {primarySportLabel}
                </span>
              ) : null}
              {stats?.updatedAt ? (
                <span className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground">
                  <Clock3 className="size-4" />
                  Обновлено{" "}
                  {stats.updatedAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-4 md:grid-cols-4">
            <StatTile
              label="Тренировок"
              value={stats.workoutsCount ?? "—"}
              icon={<Activity className="size-4" />}
            />
            <StatTile
              label="Дистанция"
              value={stats.totalKm != null ? `${stats.totalKm.toFixed(1)} км` : "—"}
              icon={<Route className="size-4" />}
            />
            <StatTile
              label="Время"
              value={stats.totalHours != null ? `${stats.totalHours.toFixed(1)} ч` : "—"}
              icon={<Clock3 className="size-4" />}
            />
            <StatTile
              label="Последняя тренировка"
              value={
                stats.lastWorkoutAt
                  ? stats.lastWorkoutAt.toLocaleString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
              small
              icon={<MapPin className="size-4" />}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  icon,
  small = false,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-muted/15 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={small ? "mt-2 text-sm font-semibold" : "mt-2 text-lg font-semibold"}>
        {value}
      </div>
    </div>
  );
}
