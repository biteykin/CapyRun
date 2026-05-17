// frontend/components/onboarding/StravaConnectCard.tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StravaIcon from "@/components/icons/StravaIcon";
import {
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  Unplug,
} from "lucide-react";

const STRAVA_ORANGE = "#FC4C02";

export function StravaConnectCard({
  isConnected,
  isLoading,
  onConnect,
}: {
  isConnected: boolean;
  isLoading?: boolean;
  onConnect: () => void;
}) {
  return (
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
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-[#FC4C02]/40 bg-[#FC4C02]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FC4C02]"
                >
                  Рекомендуем
                </Badge>
              </div>
            </div>
          </div>

          {!isConnected ? (
            <Button
              type="button"
              onClick={onConnect}
              disabled={isLoading}
              className="shrink-0 gap-2 bg-[#FC4C02] text-white shadow-sm transition hover:bg-[#e34503] focus-visible:ring-[#FC4C02]/40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Открываем Strava…
                </>
              ) : (
                <>
                  <StravaIcon className="h-4 w-4" />
                  Подключить Strava
                </>
              )}
            </Button>
          ) : null}
        </div>

        {!isConnected ? <BenefitsGrid /> : null}
      </CardContent>
    </Card>
  );
}

function BenefitsGrid() {
  const items: { icon: ReactNode; title: string; desc: string }[] = [
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
      <div className="grid gap-2 sm:grid-cols-3">
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