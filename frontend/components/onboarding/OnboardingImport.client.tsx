// frontend/components/onboarding/OnboardingImport.client.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OnboardingStepHeader from "@/components/onboarding/OnboardingStepHeader";
import { StravaConnectCard } from "@/components/onboarding/StravaConnectCard";

type ImportChoice = "strava" | "skipped";

type StravaConn = {
  status: string | null;
} | null;

export default function OnboardingImportClient() {
  const router = useRouter();
  const [loadingChoice, setLoadingChoice] = React.useState<ImportChoice | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stravaConn, setStravaConn] = React.useState<StravaConn>(null);
  const [isConnecting, setIsConnecting] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/integrations/strava-status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.conn) setStravaConn(json.conn);
      })
      .catch(() => {
        // тихо — карточка покажет «не подключено»
      });
  }, []);

  async function finishOnboarding(choice: ImportChoice, href: string) {
    if (loadingChoice || isConnecting) return;
    setLoadingChoice(choice);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/import", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      if (href.startsWith("/api/")) {
        window.location.href = href;
      } else {
        router.push(href);
        router.refresh();
      }
    } catch (e: any) {
      console.error("onboarding import finish failed", e);
      setError(e?.message ?? "Не удалось завершить онбординг");
      setLoadingChoice(null);
      setIsConnecting(false);
    }
  }

  async function handleStravaConnect() {
    if (loadingChoice || isConnecting) return;
    setIsConnecting(true);
    setError(null);
    // После возврата из Strava OAuth callback'а — хотим, чтобы юзер попал на /onboarding/finalizing,
    // а не на /integrations (стандартное место). Cookie одноразовая (10 мин TTL), читается в callback.
    document.cookie =
      "strava_redirect_after=/onboarding/finalizing; path=/; max-age=600; samesite=lax";
    await finishOnboarding("strava", "/api/strava/connect");
  }

  const busy = Boolean(loadingChoice) || isConnecting;

  return (
    <section className="space-y-6">
      <div>
        <OnboardingStepHeader step={4} total={4} />

        <h1 className="mt-3 text-2xl font-extrabold">
          Добавьте тренировки
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Подключите Strava или добавьте тренировку, чтобы AI-тренер начал анализ и дал персональные рекомендации.
        </p>
      </div>

      <StravaConnectCard
        isConnected={stravaConn?.status === "connected"}
        isLoading={isConnecting}
        onConnect={() => void handleStravaConnect()}
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold">Можно подключить позже</div>
              <div className="text-sm text-muted-foreground">
                Подключите Strava позже — раздел «Интеграции» всегда под рукой. Загрузить файлы с умных часов (Garmin, Polar, Suunto) или добавить тренировку вручную можно прямо в кабинете.
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void finishOnboarding("skipped", "/onboarding/finalizing")}
          >
            {loadingChoice === "skipped" ? "Завершаем…" : "Пропустить"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
