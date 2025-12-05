"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlanGoalType =
  | "10k"
  | "HM"
  | "M"
  | "trail"
  | "ride"
  | "swim"
  | "strength"
  | "weight"
  | "vo2max"
  | "custom";

type SportEnum =
  | "run"
  | "ride"
  | "swim"
  | "walk"
  | "hike"
  | "row"
  | "strength"
  | "yoga"
  | "aerobics"
  | "crossfit"
  | "pilates"
  | "other"
  | null;

type PresetKind = "generic" | "race" | "health";

type Preset = {
  id: string;
  title: string;
  description: string;
  type: PlanGoalType;
  sport: SportEnum;
  kind: PresetKind;
  defaultDurationWeeks: number;
};

const PRESETS: Preset[] = [
  {
    id: "regular_training",
    title: "Регулярные тренировки",
    description: "Сформировать устойчивую привычку тренироваться 3–4 раза в неделю.",
    type: "custom",
    sport: "run",
    kind: "generic",
    defaultDurationWeeks: 12,
  },
  {
    id: "start_running",
    title: "Начать бегать",
    description: "Плавный вход в бег: чередование ходьбы и лёгкого бега, без перегруза.",
    type: "custom",
    sport: "run",
    kind: "generic",
    defaultDurationWeeks: 8,
  },
  {
    id: "weight_loss",
    title: "Сбросить вес",
    description: "Снизить вес за счёт регулярной активности и разумного дефицита калорий.",
    type: "weight",
    sport: "other",
    kind: "health",
    defaultDurationWeeks: 16,
  },
  {
    id: "vo2max_boost",
    title: "Повысить выносливость",
    description: "Улучшить VO₂max и общую аэробную форму за счёт структурированных тренировок.",
    type: "vo2max",
    sport: "run",
    kind: "generic",
    defaultDurationWeeks: 12,
  },
  // Гоночные цели
  {
    id: "race_10k",
    title: "Подготовка к забегу 10 км",
    description: "Выбери дату старта и целевое время, мы построим подготовку под 10 км.",
    type: "10k",
    sport: "run",
    kind: "race",
    defaultDurationWeeks: 10,
  },
  {
    id: "race_hm",
    title: "Подготовка к полумарафону",
    description: "Готовимся к полумарафону (21,1 км) под конкретный старт.",
    type: "HM",
    sport: "run",
    kind: "race",
    defaultDurationWeeks: 12,
  },
  {
    id: "race_m",
    title: "Подготовка к марафону",
    description: "Марафон как главная цель сезона — с фокусом на здоровье и результат.",
    type: "M",
    sport: "run",
    kind: "race",
    defaultDurationWeeks: 16,
  },
];

type RaceDetails = {
  raceName: string;
  raceDate: string; // YYYY-MM-DD
  targetTime: string; // "01:45:00"
};

type RaceDetailsState = Record<string, RaceDetails>;

export type GoalsOnboardingProps = {
  /** Колбэк после успешного сохранения (можно сделать router.refresh() в обёртке) */
  onCreated?: () => void;
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeToSeconds(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":").map((s) => parseInt(s, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  let h = 0,
    m = 0,
    s = 0;
  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else if (parts.length === 1) {
    s = parts[0];
  } else {
    return null;
  }
  return h * 3600 + m * 60 + s;
}

export default function GoalsOnboarding({ onCreated }: GoalsOnboardingProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [raceDetails, setRaceDetails] = React.useState<RaceDetailsState>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const togglePreset = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 10) {
        return prev; // максимум 10 целей
      }
      return [...prev, id];
    });
    setSuccess(null);
    setError(null);
  };

  const handleRaceFieldChange = (
    presetId: string,
    field: keyof RaceDetails,
    value: string
  ) => {
    setRaceDetails((prev) => ({
      ...prev,
      [presetId]: {
        raceName: prev[presetId]?.raceName ?? "",
        raceDate: prev[presetId]?.raceDate ?? "",
        targetTime: prev[presetId]?.targetTime ?? "",
        [field]: value,
      },
    }));
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (selectedIds.length === 0) {
      setError("Выберите хотя бы одну цель.");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        throw new Error("Не удалось определить пользователя. Попробуйте перелогиниться.");
      }

      const today = new Date();

      const rows = selectedIds.map((id) => {
        const preset = PRESETS.find((p) => p.id === id)!;
        const durationDays = preset.defaultDurationWeeks * 7;

        let dateFrom: string;
        let dateTo: string;
        let title = preset.title;
        let target_json: any = { preset_id: id };

        if (preset.kind === "race") {
          const details = raceDetails[id];
          const raceDateISO = details?.raceDate || null;

          if (raceDateISO) {
            const raceDate = new Date(raceDateISO);
            dateTo = raceDateISO;
            const fromDate = addDays(raceDate, -durationDays);
            dateFrom = formatDateISO(fromDate);
          } else {
            dateFrom = formatDateISO(today);
            dateTo = formatDateISO(addDays(today, durationDays));
          }

          if (details?.raceName) {
            title = `${preset.title}: ${details.raceName}`;
          }

          const seconds = parseTimeToSeconds(details?.targetTime || "");
          target_json = {
            ...target_json,
            kind: "race",
            race_name: details?.raceName || null,
            race_date: raceDateISO,
            target_time_s: seconds,
            distance_type: preset.type,
          };
        } else {
          dateFrom = formatDateISO(today);
          dateTo = formatDateISO(addDays(today, durationDays));
          target_json = {
            ...target_json,
            kind: preset.kind,
          };
        }

        return {
          user_id: user.id,
          title,
          type: preset.type,
          sport: preset.sport,
          date_from: dateFrom,
          date_to: dateTo,
          status: "active" as const,
          target_json,
        };
      });

      const { error: insertErr } = await supabase.from("goals").insert(rows);
      if (insertErr) throw insertErr;

      setSuccess("Цели сохранены.");
      setSelectedIds([]);
      setRaceDetails({});
      if (onCreated) {
        onCreated();
      }
    } catch (e: any) {
      console.error("Failed to save goals", e);
      setError(e?.message ?? "Не удалось сохранить цели.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Выберите 1–10 целей. Для гоночных целей укажите старт и желаемое время — план будет строиться вокруг них.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PRESETS.map((preset) => {
          const selected = selectedIds.includes(preset.id);
          const race = preset.kind === "race";
          const details = raceDetails[preset.id] || {
            raceName: "",
            raceDate: "",
            targetTime: "",
          };

          return (
            <Card
              key={preset.id}
              className={cn(
                "cursor-pointer transition-all",
                selected ? "border-primary shadow-md" : "hover:border-muted-foreground/40"
              )}
              onClick={() => togglePreset(preset.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{preset.title}</CardTitle>
                <CardDescription className="text-xs">
                  {preset.description}
                </CardDescription>
              </CardHeader>
              {race && selected && (
                <CardContent className="pt-1 space-y-2">
                  <div className="space-y-1">
                    <label className="block text-xs text-muted-foreground">
                      Название старта
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border px-2 py-1 text-xs"
                      value={details.raceName}
                      onChange={(e) =>
                        handleRaceFieldChange(
                          preset.id,
                          "raceName",
                          e.target.value
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Например, Moscow Half Marathon"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">
                        Дата старта
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        value={details.raceDate}
                        onChange={(e) =>
                          handleRaceFieldChange(
                            preset.id,
                            "raceDate",
                            e.target.value
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">
                        Целевое время
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-md border px-2 py-1 text-xs"
                        value={details.targetTime}
                        onChange={(e) =>
                          handleRaceFieldChange(
                            preset.id,
                            "targetTime",
                            e.target.value
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        placeholder="01:45:00"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Можно комбинировать цели. Например, «Сбросить вес» + «Полумарафон».
        </div>
        <div className="flex gap-2 justify-end">
          {error && (
            <div className="text-xs text-red-600 max-w-xs text-right">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-700 max-w-xs text-right">
              {success}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
          >
            Сохранить цели
          </Button>
        </div>
      </div>
    </div>
  );
}