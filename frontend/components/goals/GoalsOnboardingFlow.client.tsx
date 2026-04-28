//frontend/components/goals/GoalsOnboardingFlow.client.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight } from "lucide-react";

export type GoalsOnboardingFlowProps = {
  /** Режим использования:
   *  - "initial" — первый заход, приветственный текст
   *  - "add-more" — добавление новых целей позже
   *  - "onboarding" — часть общего онбординга после регистрации
   */
  mode?: "initial" | "add-more" | "onboarding";
  /** Колбэк после успешного сохранения целей */
  onFinished?: () => void;
  initialProfile?: {
    sex?: "male" | "female" | null;
    age?: number | null;
    birth_date?: string | null;
    height_cm?: number | null;
    weight_kg?: number | null;
  };
  editGoal?: {
    id: string;
    title: string | null;
    type: string | null;
    sport: string | null;
    date_to: string | null;
    date_from?: string | null;
    target_json: any;
    notes?: string | null;
  } | null;
};

type PresetId =
  | "weight"
  | "vo2max"
  | "race-5k"
  | "race-10k"
  | "race-hm"
  | "race-marathon"
  | "start"
  | "custom";

type Step = 1 | 2;

const PRESETS: {
  id: PresetId;
  title: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: "start",
    title: "Просто начать",
    emoji: "✨",
    description: "Хочу сдвинуться с мёртвой точки и понять, с чего начать.",
  },
  {
    id: "vo2max",
    title: "Улучшить выносливость",
    emoji: "🫁",
    description: "Хочу легче держать темп, меньше уставать и увереннее переносить нагрузку.",
  },
  {
    id: "weight",
    title: "Снижение веса",
    emoji: "⚖️",
    description: "Минус лишние килограммы без жёстких диет и перегрузок.",
  },
  {
    id: "race-5k",
    title: "Забег 5 км",
    emoji: "5️⃣",
    description: "Подготовиться к лёгкому старту на 5 км.",
  },
  {
    id: "race-10k",
    title: "Забег 10 км",
    emoji: "🔟",
    description: "Комфортно пробежать десятку, не умерев по пути.",
  },
  {
    id: "race-hm",
    title: "Полумарафон",
    emoji: "🏅",
    description: "Подготовиться к полумарафону и добежать в удовольствие.",
  },
  {
    id: "race-marathon",
    title: "Марафон",
    emoji: "🏃‍♂️",
    description: "Большая цель — марафон. Готов работать системно.",
  },
  {
    id: "custom",
    title: "Своя цель",
    emoji: "🎯",
    description: "Опишите цель своими словами — если она не подходит под готовые варианты.",
  },
];

function resolveGoalType(presets: PresetId[]): string {
  if (presets.includes("race-10k")) return "10k";
  if (presets.includes("race-hm")) return "HM";
  if (presets.includes("race-marathon")) return "M";
  if (presets.includes("weight")) return "weight";
  if (presets.includes("vo2max")) return "vo2max";
  return "custom";
}

function resolveSport(presets: PresetId[]): string | null {
  if (
    presets.includes("race-5k") ||
    presets.includes("race-10k") ||
    presets.includes("race-hm") ||
    presets.includes("race-marathon") ||
    presets.includes("start") ||
    presets.includes("vo2max")
  ) {
    return "run";
  }
  return null;
}

export default function GoalsOnboardingFlow({
  mode = "initial",
  onFinished,
  initialProfile,
  editGoal = null,
}: GoalsOnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);

  const isEditMode = !!editGoal?.id;

  function presetFromGoal(goal: GoalsOnboardingFlowProps["editGoal"]): PresetId | null {
    if (!goal) return null;
    const presets = Array.isArray(goal.target_json?.presets)
      ? goal.target_json.presets
      : [];
    if (presets[0]) return presets[0] as PresetId;
    if (goal.type === "10k") return "race-10k";
    if (goal.type === "HM") return "race-hm";
    if (goal.type === "M") return "race-marathon";
    if (goal.type === "weight") return "weight";
    if (goal.type === "vo2max") return "vo2max";
    return "custom";
  }

  function formatHhMmSsFromSeconds(totalSec?: number | null) {
    if (!totalSec || totalSec <= 0) return "";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatMmSsFromSeconds(totalSec?: number | null) {
    if (!totalSec || totalSec <= 0) return "";
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const [selectedPreset, setSelectedPreset] = React.useState<PresetId | null>(() =>
    presetFromGoal(editGoal)
  );
  const [goalTitle, setGoalTitle] = React.useState(() => {
    const fromTitle = editGoal?.title;
    const fromPrimary = editGoal?.target_json?.primary;
    const raw =
      (typeof fromTitle === "string" && fromTitle.trim()) ||
      (typeof fromPrimary === "string" && fromPrimary.trim()) ||
      "";
    return raw;
  });
  const [goalDate, setGoalDate] = React.useState(
    editGoal?.date_to ? editGoal.date_to.slice(0, 10) : ""
  );
  const [targetFinishTime, setTargetFinishTime] = React.useState(() =>
    formatHhMmSsFromSeconds(editGoal?.target_json?.target_time_s ?? null)
  );
  const [targetPace, setTargetPace] = React.useState(() =>
    formatMmSsFromSeconds(editGoal?.target_json?.pace_s_per_km ?? null)
  );
  const [secondaryGoals, setSecondaryGoals] = React.useState(
    editGoal?.target_json?.secondary ?? editGoal?.notes ?? ""
  );

  const goalProfile = editGoal?.target_json?.profile as
    | {
        gender?: string | null;
        age?: number | null;
        height_cm?: number | null;
        weight_kg?: number | null;
      }
    | undefined;

  const [gender, setGender] = React.useState<"male" | "female" | "">(
    (goalProfile?.gender as "male" | "female" | undefined) ??
      (initialProfile?.sex as "male" | "female" | null) ??
      ""
  );
  const [age, setAge] = React.useState<string>(
    goalProfile?.age != null
      ? String(goalProfile.age)
      : initialProfile?.age != null
        ? String(initialProfile.age)
        : ""
  );
  const [heightCm, setHeightCm] = React.useState<string>(
    goalProfile?.height_cm != null
      ? String(goalProfile.height_cm)
      : initialProfile?.height_cm != null
        ? String(initialProfile.height_cm)
        : ""
  );
  const [weightKg, setWeightKg] = React.useState<string>(
    goalProfile?.weight_kg != null
      ? String(goalProfile.weight_kg)
      : initialProfile?.weight_kg != null
        ? String(initialProfile.weight_kg)
        : ""
  );

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isInitial = mode === "initial";
  const stepHint =
    step === 1
      ? "Сейчас можно выбрать только одну цель"
      : "Данные нужны для более точного плана и рекомендаций";
  const isRaceGoal =
    selectedPreset === "race-5k" ||
    selectedPreset === "race-10k" ||
    selectedPreset === "race-hm" ||
    selectedPreset === "race-marathon";

  const selectedPresetObj = PRESETS.find((p) => p.id === selectedPreset);

  // Явно определяем дистанцию для беговых целей
  const raceDistanceKm = React.useMemo(() => {
    if (!selectedPresetObj) return null;

    switch (selectedPresetObj.id) {
      case "race-5k":
        return 5;
      case "race-10k":
        return 10;
      case "race-hm":
        return 21.1;
      case "race-marathon":
        return 42.2;
      default:
        return null;
    }
  }, [selectedPresetObj]);

  const distanceType =
    selectedPreset === "race-5k"
      ? "5k"
      : selectedPreset === "race-10k"
      ? "10k"
      : selectedPreset === "race-hm"
      ? "HM"
      : selectedPreset === "race-marathon"
      ? "M"
      : null;

  const selectPreset = (id: PresetId) => {
    setSelectedPreset((prev) => (prev === id ? null : id));
    setError(null);
  };

  function deriveBirthDateFromAge(ageValue: string, prevBirthDate?: string | null) {
    const ageNum = Number(ageValue);
    if (!Number.isFinite(ageNum) || ageNum <= 0) return null;

    const now = new Date();
    const year = now.getFullYear() - ageNum;

    let month = 1;
    let day = 1;

    if (prevBirthDate) {
      const prev = new Date(prevBirthDate);
      if (!Number.isNaN(prev.getTime())) {
        month = prev.getMonth() + 1;
        day = prev.getDate();
      }
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function clampSegment(value: string, max = 59): string {
    if (value.length < 2) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.min(max, n)).padStart(2, "0");
  }

  function formatHhMmSsFromDigits(digits: string): string {
    const d = digits.replace(/\D/g, "").slice(0, 6);

    const h = d.slice(0, 2);
    const m = d.slice(2, 4);
    const s = d.slice(4, 6);

    const safeM = clampSegment(m, 59);
    const safeS = clampSegment(s, 59);

    return [h, safeM, safeS].filter(Boolean).join(":");
  }

  function formatMmSsFromDigits(digits: string): string {
    const d = digits.replace(/\D/g, "").slice(0, 4);

    const m = d.slice(0, 2);
    const s = d.slice(2, 4);

    const safeM = clampSegment(m, 59);
    const safeS = clampSegment(s, 59);

    return [safeM, safeS].filter(Boolean).join(":");
  }

  function allowOnlyTimeInput(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ];

    if (allowed.includes(e.key)) return;
    if (
      (e.metaKey || e.ctrlKey) &&
      ["a", "c", "v", "x"].includes(e.key.toLowerCase())
    )
      return;
    if (/^\d$/.test(e.key)) return;

    e.preventDefault();
  }

  function parseHhMmSsToSeconds(value: string): number | null {
    const raw = value.trim();
    if (!raw) return null;

    const parts = raw.split(":").map((x) => Number(x));
    if (parts.some((x) => !Number.isFinite(x) || x < 0)) return null;

    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }

    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }

    return null;
  }

  function parseMmSsToSeconds(value: string): number | null {
    const raw = value.trim();
    if (!raw) return null;
    const parts = raw.split(":").map((x) => Number(x));
    if (parts.length !== 2) return null;
    if (parts.some((x) => !Number.isFinite(x) || x < 0)) return null;
    const [m, s] = parts;
    return m * 60 + s;
  }

  function formatHhMmSs(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatMmSs(secPerKm: number | null): string | null {
    if (!secPerKm || secPerKm <= 0) return null;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function onFinishTimeChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const formatted = formatHhMmSsFromDigits(digits);

    setTargetFinishTime(formatted);

    const sec = parseHhMmSsToSeconds(formatted);
    if (sec && raceDistanceKm) {
      setTargetPace(formatMmSs(Math.round(sec / raceDistanceKm)) ?? "");
    } else if (!formatted) {
      setTargetPace("");
    }
  }

  function onPaceChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const formatted = formatMmSsFromDigits(digits);

    setTargetPace(formatted);

    const secPerKm = parseMmSsToSeconds(formatted);
    if (secPerKm && raceDistanceKm) {
      setTargetFinishTime(formatHhMmSs(Math.round(secPerKm * raceDistanceKm)));
    } else if (!formatted) {
      setTargetFinishTime("");
    }
  }

  function onPaceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
      allowOnlyTimeInput(e);
      return;
    }

    e.preventDefault();

    const input = e.currentTarget;
    const pos = input.selectionStart ?? targetPace.length;
    const isSeconds = targetPace.includes(":") && pos > targetPace.indexOf(":");

    const [mRaw = "0", sRaw = "0"] = targetPace.split(":");
    let m = Number(mRaw || 0);
    let s = Number(sRaw || 0);
    const delta = e.key === "ArrowUp" ? 1 : -1;

    if (isSeconds) s = Math.max(0, Math.min(59, s + delta));
    else m = Math.max(0, Math.min(59, m + delta));

    onPaceChange(`${String(m).padStart(2, "0")}${String(s).padStart(2, "0")}`);
  }

  function onFinishTimeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
      allowOnlyTimeInput(e);
      return;
    }

    e.preventDefault();

    const input = e.currentTarget;
    const pos = input.selectionStart ?? targetFinishTime.length;
    const firstColon = targetFinishTime.indexOf(":");
    const secondColon = targetFinishTime.indexOf(":", firstColon + 1);

    const isMinutes =
      firstColon >= 0 &&
      pos > firstColon &&
      (secondColon < 0 || pos <= secondColon);
    const isSeconds = secondColon >= 0 && pos > secondColon;

    const [hRaw = "0", mRaw = "0", sRaw = "0"] = targetFinishTime.split(":");
    let h = Number(hRaw || 0);
    let m = Number(mRaw || 0);
    let s = Number(sRaw || 0);
    const delta = e.key === "ArrowUp" ? 1 : -1;

    if (isSeconds) s = Math.max(0, Math.min(59, s + delta));
    else if (isMinutes) m = Math.max(0, Math.min(59, m + delta));
    else h = Math.max(0, Math.min(99, h + delta));

    onFinishTimeChange(
      `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}${String(s).padStart(2, "0")}`
    );
  }

  const targetTimeSec = parseHhMmSsToSeconds(targetFinishTime);
  const targetPaceSecPerKm = parseMmSsToSeconds(targetPace);

  const canGoNextFromStep1 =
    !!selectedPreset &&
    (selectedPreset !== "custom" || goalTitle.trim().length >= 3);

  const canSaveFromStep2 =
    canGoNextFromStep1 &&
    goalTitle.trim().length >= 3 &&
    goalDate.trim() !== "" &&
    gender &&
    age.trim() !== "" &&
    heightCm.trim() !== "" &&
    weightKg.trim() !== "";

  async function handleSave() {
    if (isSaving || !canSaveFromStep2) return;
    setIsSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) {
        throw new Error("Пользователь не авторизован");
      }

      const today = new Date();
      const fromStr =
        isEditMode && editGoal?.date_from
          ? editGoal.date_from.slice(0, 10)
          : today.toISOString().slice(0, 10);
      const toStr = goalDate;

      const selectedPresets = selectedPreset ? [selectedPreset] : [];
      const goalType = resolveGoalType(selectedPresets);
      const sport = resolveSport(selectedPresets);

      const birthDate = deriveBirthDateFromAge(age, initialProfile?.birth_date ?? null);

      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          sex: gender || null,
          birth_date: birthDate,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (profileErr) throw profileErr;

      const title = goalTitle.trim();

      const targetJson = {
        primary: goalTitle.trim() || null,
        secondary: secondaryGoals.trim() || null,
        presets: selectedPresets,
        ...(isRaceGoal
          ? {
              race_date: goalDate || null,
              target_time_s: targetTimeSec,
              pace_s_per_km: targetPaceSecPerKm,
              distance_type: distanceType,
              distance_km: raceDistanceKm,
            }
          : {}),
        profile: {
          gender: gender || null,
          age: age ? Number(age) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
        },
      };

      const goalPayload = {
        user_id: user.id,
        title,
        type: goalType,
        sport,
        date_from: fromStr,
        date_to: toStr,
        status: "active", // из enum plan_status
        target_json: targetJson,
        notes: secondaryGoals.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: saveGoalErr } =
        isEditMode && editGoal
          ? await supabase
              .from("goals")
              .update(goalPayload)
              .eq("id", editGoal.id)
              .eq("user_id", user.id)
          : await supabase.from("goals").insert(goalPayload);

      if (saveGoalErr) throw saveGoalErr;

      onFinished?.();
      router.push(isEditMode ? "/goals?updated=1" : "/goals?created=1");
      router.refresh();
    } catch (e: any) {
      console.error("goals onboarding save error", e);
      setError(
        e?.message ||
          "Не получилось сохранить цели. Попробуй ещё раз или чуть позже."
      );
    } finally {
      setIsSaving(false);
    }
  }

  // --- Рендер шагов ---

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <CardTitle>
            {isEditMode
              ? "Редактируем цель"
              : isInitial
                ? "Какая цель сейчас главная?"
                : "Выберите новую цель"}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? "Можно изменить сценарий цели, дату, параметры и детали подготовки."
              : "Выберите один сценарий. На его основе тренер будет строить план и расставлять акценты."}
          </CardDescription>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PRESETS.map((p) => {
            const active = selectedPreset === p.id;

            return (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer transition-all",
                  active
                    ? "border-[rgb(26,158,58)] bg-[rgba(197,237,208,0.35)] shadow-md ring-2 ring-[rgba(26,158,58,0.18)]"
                    : "bg-card hover:border-muted-foreground/40"
                )}
                onClick={() => selectPreset(p.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-xl">{p.emoji}</div>
                      <div>
                        <CardTitle className="text-sm">{p.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {p.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="pt-0.5">
                      {active ? (
                        <CheckCircle2 className="size-5 text-[rgb(26,158,58)]" />
                      ) : (
                        <div className="size-5 rounded-full border border-muted-foreground/30" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {selectedPreset === "custom" ? (
          <div className="space-y-2 rounded-2xl border bg-muted/10 p-4">
            <Label htmlFor="customGoalTitle">Опишите свою цель</Label>
            <Textarea
              id="customGoalTitle"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              rows={3}
              placeholder="Например: «Хочу спокойно бегать по утрам 3 раза в неделю» или «Хочу подготовиться к паделу и улучшить общую форму»"
            />
            <div className="text-xs text-muted-foreground">
              Напишите свободно: что хотите улучшить, к какому сроку и почему это важно
            </div>
          </div>
        ) : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/goals")}
          >
            Назад
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canGoNextFromStep1}
            onClick={() => setStep(2)}
          >
            Далее
            <ChevronRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <CardTitle>Параметры о тебе</CardTitle>
          <CardDescription>
            Мы предзаполнили данные из профиля. Если что-то измените здесь, обновим и профиль тоже.
          </CardDescription>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="goalTitle">Название цели</Label>
            <Input
              id="goalTitle"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Например: Полумарафон в Казани"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalDate">Дата цели</Label>
            <Input
              id="goalDate"
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              Это может быть дата старта или дата, к которой цель должна быть выполнена
            </div>
          </div>
        </div>

        {raceDistanceKm !== null ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetFinishTime">Желаемое время финиша</Label>
              <Input
                id="targetFinishTime"
                value={targetFinishTime}
                onChange={(e) => onFinishTimeChange(e.target.value)}
              onKeyDown={onFinishTimeKeyDown}
                inputMode="numeric"
                maxLength={8}
                placeholder="01:45:00"
              />
              <div className="text-xs text-muted-foreground">
                Формат: чч:мм:сс
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPace">Целевой темп, мин/км</Label>
              <Input
                id="targetPace"
                value={targetPace}
                onChange={(e) => onPaceChange(e.target.value)}
              onKeyDown={onPaceKeyDown}
                inputMode="numeric"
                maxLength={5}
                placeholder="05:00"
              />
              <div className="text-xs text-muted-foreground">
                Темп и время связаны между собой
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid w-full gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gender">Пол</Label>
            <Select
              value={gender || "unset"}
              onValueChange={(v) =>
                setGender(v === "unset" ? "" : (v as "male" | "female"))
              }
            >
              <SelectTrigger id="gender">
                <SelectValue placeholder="Выберите пол" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Не выбрано</SelectItem>
                <SelectItem value="male">Мужской</SelectItem>
                <SelectItem value="female">Женский</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">Возраст</Label>
            <Input
              id="age"
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Например: 34"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Рост (см)</Label>
            <Input
              id="height"
              type="number"
              min={120}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Например: 178"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Вес (кг)</Label>
            <Input
              id="weight"
              type="number"
              min={35}
              max={200}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Например: 79"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondary">
            Опыт, ограничения и важные детали
          </Label>
          <Textarea
            id="secondary"
            value={secondaryGoals}
            onChange={(e) => setSecondaryGoals(e.target.value)}
            rows={3}
            placeholder="Например: «Раньше бегал 5 км по выходным, сейчас был перерыв 2 месяца. Колено иногда побаливает после долгих пробежек, могу тренироваться 3 раза в неделю»"
          />
          <div className="text-xs text-muted-foreground">
            Напишите свободно: текущий уровень, прошлые старты, травмы,
            ограничения по времени и все, что тренеру важно учитывать
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(1)}
          >
            Назад
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSaveFromStep2 || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Сохраняем…" : "Сохранить цели"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full">
      <Card
        className={cn(
          "flex h-full flex-col border bg-card text-card-foreground shadow-sm rounded-xl"
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Шаг {step} из 2</Badge>
              <span className="text-xs text-muted-foreground">
                {stepHint}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all",
                    step === i
                      ? "bg-[color:var(--btn-primary-main,#E58B21)]"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="w-full">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </CardContent>

        
      </Card>
    </section>
  );
}