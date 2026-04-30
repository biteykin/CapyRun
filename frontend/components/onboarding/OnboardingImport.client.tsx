// frontend/components/onboarding/OnboardingImport.client.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, FileUp, PencilLine, Unplug } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OnboardingStepHeader from "@/components/onboarding/OnboardingStepHeader";

type ImportChoice = "strava" | "upload" | "manual" | "skipped";

const ACTIONS = [
  {
    id: "strava" as const,
    title: "Подключить Strava",
    description: "Автоматически подтянем тренировки и дадим тренеру больше контекста.",
    icon: Activity,
    href: "/api/strava/connect",
    primary: true,
  },
  {
    id: "upload" as const,
    title: "Загрузить тренировку",
    description: "Загрузите файл тренировки, если он уже есть на компьютере.",
    icon: FileUp,
    href: "/workouts/upload",
    primary: false,
  },
  {
    id: "manual" as const,
    title: "Добавить тренировку вручную",
    description: "Подойдёт, если хочется быстро внести последнюю тренировку без файла.",
    icon: PencilLine,
    href: "/workouts/new",
    primary: false,
  },
];

export default function OnboardingImportClient() {
  const router = useRouter();
  const [loadingChoice, setLoadingChoice] = React.useState<ImportChoice | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function finishOnboarding(choice: ImportChoice, href: string) {
    if (loadingChoice) return;
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
    }
  }

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

      <div className="grid gap-3 md:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const loading = loadingChoice === action.id;

          return (
            <Card key={action.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  type="button"
                  variant={action.primary ? "primary" : "secondary"}
                  className="w-full"
                  disabled={Boolean(loadingChoice)}
                  onClick={() => void finishOnboarding(action.id, action.href)}
                >
                  {loading ? "Открываем…" : action.title}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
              <Unplug className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Можно пропустить</div>
              <div className="text-sm text-muted-foreground">
                Тренер начнёт с цели и параметров, а данные добавим позже.
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(loadingChoice)}
            onClick={() => void finishOnboarding("skipped", "/home")}
          >
            {loadingChoice === "skipped" ? "Завершаем…" : "Пропустить"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
