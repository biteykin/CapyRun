// frontend/app/(protected)/integrations/page.tsx

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { apiGet } from "@/lib/server/apiFetch";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import StravaSyncButton, { StravaSyncGroup } from "@/components/settings/strava-sync-button";
import StravaDisconnectButton from "@/components/settings/strava-disconnect-button";
import { Badge } from "@/components/ui/badge";
import StravaIcon from "@/components/icons/StravaIcon";
import {
  CalendarClock,
  CheckCircle2,
  History,
  Hourglass,
  Plug,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Unplug,
  Watch,
  Zap,
} from "lucide-react";

const STRAVA_ORANGE = "#FC4C02";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { conn, isConnected } = await apiGet<{
    conn: {
      id: string;
      provider: string;
      status: string | null;
      created_at: string | null;
      updated_at: string | null;
      last_synced_at: string | null;
      error_message: string | null;
    } | null;
    isConnected: boolean;
  }>("/api/integrations/strava-status");

  const autosync = searchParams?.autosync === "1";
  const total = 3;
  const active = isConnected ? 1 : 0;

  const lastSyncedAt = conn?.last_synced_at
    ? new Date(conn.last_synced_at).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const connectedSinceAt = conn?.created_at
    ? new Date(conn.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <main className="space-y-6">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Интеграции</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Подключите спортивные сервисы — CapyRun сам подтянет тренировки и метрики.
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        >
          <Plug className="size-3.5" />
          {active} из {total} подключено
        </Badge>
      </header>

      {/* Strava */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl",
            isConnected ? "bg-[#FC4C02]/20" : "bg-[#FC4C02]/12"
          )}
        />
        {isConnected ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#FC4C02] to-transparent"
          />
        ) : null}

        <CardContent className="relative space-y-6 p-6">
          {/* Header row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-background shadow-sm">
                <StravaIcon className="h-6 w-6" style={{ color: STRAVA_ORANGE }} />
              </div>
              <div className="space-y-2">
                <div>
                  <CardTitle className="text-lg">Strava</CardTitle>
                  <CardDescription>
                    Импорт тренировок и автосинхронизация активности
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isConnected ? (
                    <Badge className="gap-1.5 rounded-full border border-green-300 bg-green-100 px-3 py-1 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="size-3.5" />
                      Подключено
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                      <Unplug className="size-3.5" />
                      Не подключено
                    </Badge>
                  )}
                  {lastSyncedAt ? (
                    <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                      <CalendarClock className="size-3.5" />
                      Синхронизировано {lastSyncedAt}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {!isConnected ? (
              <Link
                href="/api/strava/connect"
                className={cn(
                  buttonVariants(),
                  "shrink-0 gap-2 bg-[#FC4C02] text-white shadow-sm transition hover:bg-[#e34503]"
                )}
              >
                <StravaIcon className="h-4 w-4" />
                Подключить Strava
              </Link>
            ) : null}
          </div>

          {!isConnected ? (
            <BenefitsGrid />
          ) : (
            <ConnectedSection
              lastSyncedAt={lastSyncedAt}
              connectedSinceAt={connectedSinceAt}
              errorMessage={conn?.error_message ?? null}
              autosync={autosync}
              isConnected={isConnected}
            />
          )}
        </CardContent>
      </Card>

      {/* Coming soon */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Скоро в работе
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ComingSoonCard
            name="Apple Watch"
            description="Импорт тренировок напрямую с часов"
            blobClass="bg-zinc-300/40"
            iconClass="text-zinc-700"
            icon={<Watch className="size-6" />}
          />
          <ComingSoonCard
            name="Garmin"
            description="Синхронизация с Garmin Connect"
            blobClass="bg-sky-300/40"
            iconClass="text-sky-700"
            icon={<Watch className="size-6" />}
          />
        </div>
      </section>
    </main>
  );
}

function BenefitsGrid() {
  const items: { icon: ReactNode; title: string; desc: string }[] = [
    {
      icon: <Zap className="size-4" />,
      title: "Автоимпорт",
      desc: "Новые тренировки сами попадают в CapyRun",
    },
    {
      icon: <History className="size-4" />,
      title: "История",
      desc: "Подтянем все прошлые активности",
    },
    {
      icon: <Sparkles className="size-4" />,
      title: "AI-аналитика",
      desc: "Данные сразу попадают в AI-тренера",
    },
    {
      icon: <RefreshCw className="size-4" />,
      title: "В один клик",
      desc: "Повторная синхронизация в любой момент",
    },
  ];

  return (
    <div className="rounded-2xl border bg-muted/15 p-4">
      <div className="mb-3 text-sm font-semibold">Что вы получите</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((b) => (
          <div
            key={b.title}
            className="flex items-start gap-3 rounded-xl border bg-background p-3 transition hover:shadow-sm"
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FC4C02]/10"
              style={{ color: STRAVA_ORANGE }}
            >
              {b.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectedSection({
  lastSyncedAt,
  connectedSinceAt,
  errorMessage,
  autosync,
  isConnected,
}: {
  lastSyncedAt: string | null;
  connectedSinceAt: string | null;
  errorMessage: string | null;
  autosync: boolean;
  isConnected: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile
          icon={<CheckCircle2 className="size-4 text-green-600" />}
          label="Статус"
          value="Аккаунт подключён"
          hint="Можно импортировать новые тренировки"
        />
        <InfoTile
          icon={<CalendarClock className="size-4 text-muted-foreground" />}
          label="Последняя синхронизация"
          value={lastSyncedAt ?? "Пока не запускалась"}
          hint="Обновляется после успешного импорта"
        />
        <InfoTile
          icon={<History className="size-4 text-muted-foreground" />}
          label="Подключено с"
          value={connectedSinceAt ?? "—"}
          hint="Дата первой авторизации"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <ShieldAlert className="size-4" />
            Последняя ошибка синхронизации
          </div>
          <div className="text-sm text-muted-foreground">{errorMessage}</div>
        </div>
      ) : null}

      <StravaSyncGroup disabled={!isConnected} autoStart={autosync}>
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <StravaSyncButton compact />
            <StravaDisconnectButton disabled={!isConnected} />
          </div>
          <StravaSyncButton statusOnly />
        </div>
      </StravaSyncGroup>
    </div>
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
    <div className="rounded-2xl border bg-muted/15 p-4 transition hover:bg-muted/25">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function ComingSoonCard({
  name,
  description,
  icon,
  blobClass,
  iconClass,
}: {
  name: string;
  description: string;
  icon: ReactNode;
  blobClass: string;
  iconClass: string;
}) {
  return (
    <Card className="relative overflow-hidden border-dashed">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl",
          blobClass
        )}
      />
      <CardContent className="relative flex items-center justify-between gap-3 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background",
              iconClass
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            <CardDescription className="truncate text-xs">{description}</CardDescription>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5 rounded-full">
          <Hourglass className="size-3.5" />
          Скоро
        </Badge>
      </CardContent>
    </Card>
  );
}