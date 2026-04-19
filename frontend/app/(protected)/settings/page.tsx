import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import StravaSyncButton, { StravaSyncGroup } from "@/components/settings/strava-sync-button";
import StravaDisconnectButton from "@/components/settings/strava-disconnect-button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Link2,
  ShieldAlert,
} from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: { searchParams?: Record<string, string | string[] | undefined> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: conn } = await supabase
    .from("external_accounts")
    .select("id, provider, status, created_at, updated_at, last_synced_at, error_message")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();

  const isConnected = !!conn && conn.status === "connected";
  const autosync = searchParams?.autosync === "1";

  return (
    <main className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Интеграции</CardTitle>
          <CardDescription>Подключения к спортивным сервисам и синхронизация данных</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-muted/20">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Strava</CardTitle>
                      <CardDescription>
                        Импорт тренировок и синхронизация активности
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isConnected ? (
                      <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                        <CheckCircle2 className="size-3.5" />
                        Подключено
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                        <Link2 className="size-3.5" />
                        Не подключено
                      </Badge>
                    )}

                    {conn?.last_synced_at ? (
                      <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                        <CalendarClock className="size-3.5" />
                        Синхронизировано{" "}
                        {new Date(conn.last_synced_at).toLocaleString(undefined, {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {!isConnected ? (
                  <Link href="/api/strava/connect" className={buttonVariants()}>
                    Подключить Strava
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {!isConnected ? (
                <div className="rounded-2xl border border-dashed bg-muted/15 p-5">
                  <div className="max-w-2xl space-y-2">
                    <div className="text-sm font-semibold">Что даст подключение</div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <div className="rounded-xl border bg-background p-3">
                        Автоматический импорт новых тренировок из Strava
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        Быстрое наполнение истории активности в CapyRun
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        Актуальные данные для аналитики и прогресса
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        Удобная повторная синхронизация в один клик
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoTile
                      label="Статус"
                      value="Аккаунт подключён"
                      hint="Можно импортировать новые тренировки"
                    />
                    <InfoTile
                      label="Последняя синхронизация"
                      value={
                        conn?.last_synced_at
                          ? new Date(conn.last_synced_at).toLocaleString(undefined, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Пока не запускалась"
                      }
                      hint="Обновляется после успешного импорта"
                    />
                    <InfoTile
                      label="Подключено с"
                      value={
                        conn?.created_at
                          ? new Date(conn.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : "—"
                      }
                      hint="Дата первой авторизации"
                    />
                  </div>

                  {conn?.error_message ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
                        <ShieldAlert className="size-4" />
                        Последняя ошибка синхронизации
                      </div>
                      <div className="text-sm text-muted-foreground">{conn.error_message}</div>
                    </div>
                  ) : null}

                  <StravaSyncGroup disabled={!isConnected} autoStart={autosync}>
                    <div className="w-full space-y-2">
                      {/* строка кнопок — фиксированная */}
                      <div className="flex items-center gap-2">
                        <StravaSyncButton compact />
                        <StravaDisconnectButton disabled={!isConnected} />
                      </div>

                      {/* статус синхронизации — всегда НИЖЕ */}
                      <StravaSyncButton statusOnly />
                    </div>
                  </StravaSyncGroup>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function InfoTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-muted/15 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}