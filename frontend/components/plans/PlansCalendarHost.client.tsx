// frontend/components/plans/PlansCalendarHost.client.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bike,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Flame,
  Flag,
  Footprints,
  Gauge,
  PersonStanding,
  Route,
  Snowflake,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import PlansCalendar, { type PlanEvent } from "./PlansCalendar.client";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import * as RD from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";

type ActiveGoal = {
  id: string;
  title: string | null;
  type: string | null;
  sport: string | null;
  date_to: string | null;
} | null;

export type PlansCalendarHostProps = {
  events: PlanEvent[];
  initialMonthISO: string;
  activeGoal?: ActiveGoal;
};

type ExtendedEvent = PlanEvent & {
  kind?: "planned" | "workout" | "goal";
  isCompleted?: boolean;
  structure?: {
    goal?: string | null;
    main?: string | null;
    notes?: string | null;
    steps?: any[] | null;
    effort?: string | null;
    warmup?: string | null;
    cooldown?: string | null;
    hr_target?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
    strength_block?: string | null;
    hydration?: string | null;
    fueling?: string | null;
  } | null;
};

type PlannedHrZoneChip = {
  value?: string;
  label?: string;
  range?: string | null;
  color?: string | null;
};

// Цвета из Colors (Storybook):
// bg-success, bg-yellow, data-color-11
const COLOR_COMPLETED = "#2D7601"; // выполнена
const COLOR_MISSED = "#F6B021";    // пропущена
const COLOR_PLANNED = "#0C5BF9";   // запланирована (data-color-11)

function getTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pluralizeRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function calcPace(
  distance_m?: number | null,
  duration_sec?: number | null,
  sport?: string | null
): string | null {
  if (!distance_m || !duration_sec || distance_m <= 0 || duration_sec <= 0) return null;
  const km = distance_m / 1000;
  if (sport === "ride") {
    const kmh = km / (duration_sec / 3600);
    return `${kmh.toFixed(1)} км/ч`;
  }
  if (sport === "swim") {
    const minPer100m = duration_sec / 60 / (distance_m / 100);
    const m = Math.floor(minPer100m);
    const s = Math.round((minPer100m - m) * 60);
    return `${m}:${String(s).padStart(2, "0")} /100м`;
  }
  const minPerKm = duration_sec / 60 / km;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /км`;
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00");
  const b = new Date(toIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getGoalMotivation(daysToGoal: number, isRace: boolean): string {
  if (daysToGoal < 0) return "Эта цель уже в прошлом. Время поставить новую и двигаться дальше.";
  if (daysToGoal === 0) return isRace ? "Сегодня твой день! Доверяй подготовке и наслаждайся стартом 🚀" : "Сегодня дата цели.";
  if (daysToGoal <= 3) return "Финал совсем рядом. Сохраняй спокойствие — главная работа уже сделана.";
  if (daysToGoal <= 14) return "Финиш близко. Сбавь объём, набирай свежесть и доверяй плану.";
  if (daysToGoal <= 56) return "Подготовка в активной фазе. Каждая тренировка приближает результат.";
  return "Впереди достаточно времени для качественной подготовки. Главное — последовательность.";
}

type SportOption = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bg: string;
  textColor?: string;
};
const SPORT_OPTIONS: SportOption[] = [
  { value: "run", label: "Бег", Icon: Footprints, color: "#30bb5c", bg: "rgba(48,187,92,0.14)", textColor: "#1F8541" },
  { value: "ride", label: "Вело", Icon: Bike, color: "#a400d0", bg: "rgba(164,0,208,0.10)" },
  { value: "swim", label: "Плавание", Icon: Waves, color: "#2565f9", bg: "rgba(37,101,249,0.10)" },
  { value: "strength", label: "ОФП", Icon: Dumbbell, color: "#ed3b44", bg: "rgba(237,59,68,0.10)", textColor: "#C72530" },
  { value: "walk", label: "Ходьба", Icon: PersonStanding, color: "#f3950a", bg: "rgba(243,149,10,0.14)", textColor: "#A86200" },
  { value: "other", label: "Другое", Icon: Activity, color: "#B7B9AE", bg: "rgba(183,185,174,0.20)", textColor: "#5C5E58" },
];

type EffortPreset = { label: string; color: string; bg: string; textColor?: string };
const EFFORT_PRESETS: EffortPreset[] = [
  { label: "Легко", color: "#3AAAEF", bg: "#C5E8FF" },
  { label: "Умеренно", color: "#1A9E3A", bg: "#C5EDD0" },
  { label: "Тяжело", color: "#FFD600", bg: "#FFF5B0", textColor: "#8B6B00" },
  { label: "Максимум", color: "#E60012", bg: "#FFCCCC" },
];

type HrZoneDef = { value: string; desc: string; color: string; bg: string; textColor?: string };
const HR_ZONE_DEFS: HrZoneDef[] = [
  { value: "Z1", desc: "восстановление", color: "#59229F", bg: "#D1C1E4" },
  { value: "Z2", desc: "лёгкая аэробная", color: "#3AAAEF", bg: "#C5E8FF" },
  { value: "Z3", desc: "умеренная", color: "#1A9E3A", bg: "#C5EDD0" },
  { value: "Z4", desc: "пороговая", color: "#FFD600", bg: "#FFF5B0", textColor: "#8B6B00" },
  { value: "Z5", desc: "максимальная", color: "#E60012", bg: "#FFCCCC" },
];

function getHrZoneDef(value?: string | null): HrZoneDef | null {
  if (!value) return null;
  const key = value.trim().toUpperCase();
  return HR_ZONE_DEFS.find((z) => z.value === key) ?? null;
}

function formatDateRu(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMinutes(min?: number | null) {
  if (!min || min <= 0) return "—";
  return `${Math.round(min)} мин`;
}

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatDistance(m?: number | null) {
  if (!m || m <= 0) return "—";
  const km = m / 1000;
  return `${km.toFixed(1)} км`;
}

function formatPlannedDistance(km?: number | null) {
  if (!km || km <= 0) return "—";
  return `${Number(km).toFixed(1)} км`;
}

function formatStep(step: any): string {
  if (!step) return "—";

  const parts: string[] = [];
  if (step.label) parts.push(String(step.label));
  if (step.repeats) parts.push(`×${step.repeats}`);
  if (step.sets) parts.push(`${step.sets} подхода`);
  if (step.duration_min) parts.push(`${step.duration_min} мин`);
  if (step.distance_km) parts.push(`${Number(step.distance_km).toFixed(1)} км`);
  if (step.target) parts.push(String(step.target));

  return parts.join(" · ") || "—";
}

function SportBadge({ sport }: { sport?: string | null }) {
  const labelMap: Record<string, string> = {
    run: "Бег",
    ride: "Вело",
    swim: "Плавание",
    walk: "Ходьба",
    hike: "Хайк",
    strength: "ОФП",
  };

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
      {labelMap[sport ?? ""] ?? sport ?? "Тренировка"}
    </span>
  );
}

function MetaPill(props: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}

type StepTheme = {
  color: string;
  bg: string;
  textColor?: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
};

const STEP_THEME_BY_TYPE: Record<string, StepTheme> = {
  warmup: { color: "#3AAAEF", bg: "#C5E8FF", Icon: Flame, label: "Разминка" },
  interval: { color: "#E60012", bg: "#FFCCCC", Icon: Zap, label: "Интервал" },
  tempo: { color: "#FFD600", bg: "#FFF5B0", textColor: "#8B6B00", Icon: TrendingUp, label: "Темп" },
  recovery: { color: "#1A9E3A", bg: "#C5EDD0", Icon: Wind, label: "Восстановление" },
  cooldown: { color: "#59229F", bg: "#D1C1E4", Icon: Snowflake, label: "Заминка" },
  exercise: { color: "#ed3b44", bg: "rgba(237,59,68,0.14)", textColor: "#C72530", Icon: Dumbbell, label: "Упражнение" },
  default: { color: "#f3950a", bg: "rgba(243,149,10,0.14)", textColor: "#A86200", Icon: Activity, label: "Шаг" },
};

function getStepTheme(type?: string | null): StepTheme {
  return STEP_THEME_BY_TYPE[type ?? ""] ?? STEP_THEME_BY_TYPE.default;
}

function getSportTheme(sport?: string | null) {
  return (
    SPORT_OPTIONS.find((o) => o.value === sport) ??
    SPORT_OPTIONS[SPORT_OPTIONS.length - 1]
  );
}

function getTrainingBenefit(evt: ExtendedEvent | null, activeGoal?: ActiveGoal) {
  if (!evt) return "Эта тренировка поддерживает общий прогресс и помогает двигаться к цели без перегруза.";

  const title = String(evt.title ?? "").toLowerCase();
  const sport = String(evt.sport ?? "").toLowerCase();
  const structure = evt.structure ?? null;
  const goal = String(structure?.goal ?? "").toLowerCase();

  const text = `${title} ${goal} ${sport}`;
  const activeGoalTitle = activeGoal?.title?.trim() || null;
  const goalSuffix = activeGoalTitle
    ? ` Это также помогает в достижении цели «${activeGoalTitle}».`
    : "";

  if (text.includes("длинн")) {
    return (
      "Развивает выносливость, помогает спокойнее держать нагрузку на длительной работе и укрепляет базу под более длинные дистанции." +
      goalSuffix
    );
  }

  if (text.includes("темпов")) {
    return (
      "Учит держать устойчиво высокий, но контролируемый темп. Помогает повышать пороговую выносливость и напрямую влияет на способность бежать быстрее на целевой дистанции." +
      goalSuffix
    );
  }

  if (text.includes("интерв")) {
    return (
      "Развивает скорость, экономичность и переносимость интенсивной нагрузки. Помогает улучшать форму и поднимать потолок текущих возможностей." +
      goalSuffix
    );
  }

  if (text.includes("легк")) {
    return (
      "Даёт аэробную базу, помогает восстанавливаться и поддерживать объём без лишнего стресса. Это фундамент, на котором держится весь план." +
      goalSuffix
    );
  }

  if (text.includes("офп") || text.includes("сил") || sport === "strength") {
    return (
      "Укрепляет мышцы и связки, улучшает стабильность и снижает риск травм. Такая работа помогает увереннее переносить беговой объём и держать технику." +
      goalSuffix
    );
  }

  return `Поддерживает прогресс по плану, помогает развивать нужные качества и постепенно приближает к текущей спортивной цели.${goalSuffix}`;
}

function getChecklistItems(evt: ExtendedEvent | null): string[] {
  if (!evt) return [];

  const sport = String(evt.sport ?? "").toLowerCase();
  const structure = evt.structure ?? null;
  const steps = Array.isArray(structure?.steps) ? structure.steps : [];
  const hasWarmup = steps.some((s) => s?.type === "warmup") || !!structure?.warmup;
  const hasCooldown = steps.some((s) => s?.type === "cooldown") || !!structure?.cooldown;

  const items: string[] = [];

  if (hasWarmup) items.push("Сделать короткую разминку перед стартом");
  if (sport === "run") items.push("Подготовить часы, форму и кроссовки заранее");
  if (sport === "strength") items.push("Проверить технику и не работать через боль");
  if (structure?.hydration) items.push(`По воде: ${structure.hydration}`);
  else items.push("Заранее подумать о воде, если тренировка затянется");
  if (structure?.fueling) items.push(`По питанию: ${structure.fueling}`);
  if (hasCooldown) items.push("Оставить 5–10 минут на заминку после тренировки");

  return items.slice(0, 5);
}

function getTrainingPurposeLabel(evt: ExtendedEvent | null) {
  const title = String(evt?.title ?? "").toLowerCase();
  const goal = String(evt?.goal ?? evt?.structure?.goal ?? "").toLowerCase();
  const sport = String(evt?.sport ?? "").toLowerCase();

  if (sport === "strength" || title.includes("офп") || goal.includes("офп")) {
    return "Силовая устойчивость";
  }
  if (title.includes("темпов") || goal.includes("темпов")) {
    return "Развитие темповой выносливости";
  }
  if (title.includes("интервал") || goal.includes("интервал")) {
    return "Развитие скорости";
  }
  if (title.includes("длинн") || goal.includes("длинн")) {
    return "Развитие выносливости";
  }
  if (title.includes("легк") || goal.includes("легк")) {
    return "Аэробная база и восстановление";
  }
  return "Поддержка формы";
}

function getExecutionTips(evt: ExtendedEvent | null): string[] {
  const tips: string[] = [];
  const title = String(evt?.title ?? "").toLowerCase();
  const goal = String(evt?.goal ?? evt?.structure?.goal ?? "").toLowerCase();
  const effort = String(evt?.effort ?? evt?.structure?.effort ?? "").toLowerCase();
  const hrTarget = String(evt?.hr_target ?? evt?.structure?.hr_target ?? "");
  const sport = String(evt?.sport ?? "").toLowerCase();

  if (sport === "strength" || title.includes("офп") || goal.includes("")) {
    tips.push("Держи технику на первом месте и не работай через боль.");
    tips.push("Делай движения спокойно и контролируемо, без спешки.");
    tips.push("Между подходами восстанавливай дыхание, а не просто жди время.");
  } else if (title.includes("темпов") || goal.includes("темпов")) {
    tips.push("Начни спокойно и выходи в рабочий темп постепенно, без резкого ускорения.");
    tips.push("Темп должен быть уверенным, но контролируемым — без ощущения, что ты терпишь с первых минут.");
    tips.push("Держи технику ровной: расслабленные плечи, короткий контакт с землёй, стабильный ритм.");
  } else if (title.includes("интервал") || goal.includes("интервал")) {
    tips.push("Быстрые отрезки беги собрано, но не на максимум — важно сохранить качество всех повторов.");
    tips.push("На восстановлении реально сбавляй, чтобы следующая работа была качественной.");
    tips.push("Следи, чтобы темп не разваливался на последних интервалах.");
  } else if (title.includes("длинн") || goal.includes("длинн")) {
    tips.push("Первые минуты беги с запасом, не разгоняйся раньше времени.");
    tips.push("Главная цель — ровное устойчивое усилие, а не быстрый темп любой ценой.");
    tips.push("Следи за самочувствием и не бойся чуть замедлиться, если пульс уходит выше плана.");
  } else {
    tips.push("Держи усилие ровным и не ускоряйся без причины.");
    tips.push("Ориентируйся на контроль дыхания и ощущение устойчивого темпа.");
  }

  if (effort.includes("легк")) {
    tips.unshift("Беги в комфортном разговорном темпе — должно оставаться ощущение запаса.");
  } else if (effort.includes("умерен")) {
    tips.unshift("Работай на уверенном, но контролируемом усилии — без избыточного давления.");
  }

  if (hrTarget.trim()) {
    tips.push(`Следи за ориентиром по пульсу: ${hrTarget}.`);
  }

  return tips.slice(0, 4);
}

type PlannedWorkoutFormProps = {
  date: string;
  onDateChange?: (v: string) => void;
  minDate?: string;
  title: string;
  onTitleChange: (v: string) => void;
  sport: string;
  onSportChange: (v: string) => void;
  durationMin: string;
  onDurationMinChange: (v: string) => void;
  distanceKm: string;
  onDistanceKmChange: (v: string) => void;
  effort: string;
  onEffortChange: (v: string) => void;
  hrZones: string[];
  onHrZonesChange: (v: string[]) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  error?: string | null;
};

function PlannedWorkoutForm({
  date,
  onDateChange,
  minDate,
  title,
  onTitleChange,
  sport,
  onSportChange,
  durationMin,
  onDurationMinChange,
  distanceKm,
  onDistanceKmChange,
  effort,
  onEffortChange,
  hrZones,
  onHrZonesChange,
  notes,
  onNotesChange,
  error,
}: PlannedWorkoutFormProps) {
  const isDistanceVisible = sport !== "strength" && sport !== "other";

  function toggleZone(value: string) {
    onHrZonesChange(
      hrZones.includes(value)
        ? hrZones.filter((z) => z !== value)
        : [...hrZones, value]
    );
  }

  return (
    <div className="space-y-6">
      {/* Тип тренировки — тайлы с иконками */}
      <div className="space-y-2">
        <Label>Тип тренировки</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SPORT_OPTIONS.map((opt) => {
            const selected = sport === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSportChange(opt.value)}
                style={
                  selected
                    ? {
                        backgroundColor: opt.bg,
                        borderColor: opt.color,
                        color: opt.textColor ?? opt.color,
                      }
                    : undefined
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                  selected
                    ? "shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-[rgba(12,91,249,0.4)] hover:bg-[rgba(12,91,249,0.04)] hover:text-foreground"
                )}
              >
                <Icon
                  className="size-5"
                  style={selected ? { color: opt.color } : undefined}
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Название */}
      <div className="space-y-2">
        <Label htmlFor="pwf-title">Название</Label>
        <Input
          id="pwf-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Например: Лёгкий бег 40 минут"
        />
      </div>

      {/* Дата (только если редактируемая) + длительность + дистанция */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          onDateChange ? "sm:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {onDateChange ? (
          <div className="space-y-2">
            <Label htmlFor="pwf-date">Дата</Label>
            <Input
              id="pwf-date"
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="pwf-duration">Длительность, мин</Label>
          <Input
            id="pwf-duration"
            type="number"
            inputMode="numeric"
            min={1}
            value={durationMin}
            onChange={(e) => onDurationMinChange(e.target.value)}
            placeholder="40"
          />
        </div>
        {isDistanceVisible ? (
          <div className="space-y-2">
            <Label htmlFor="pwf-distance">Дистанция, км</Label>
            <Input
              id="pwf-distance"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={distanceKm}
              onChange={(e) => onDistanceKmChange(e.target.value)}
              placeholder="6.0"
            />
          </div>
        ) : null}
      </div>

      {/* Интенсивность — пресеты + свободное поле */}
      <div className="space-y-2">
        <Label htmlFor="pwf-effort">Интенсивность</Label>
        <div className="flex flex-wrap gap-2">
          {EFFORT_PRESETS.map((preset) => {
            const selected =
              effort.trim().toLowerCase() === preset.label.toLowerCase();
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onEffortChange(selected ? "" : preset.label)}
                style={
                  selected
                    ? {
                        backgroundColor: preset.bg,
                        borderColor: preset.color,
                        color: preset.textColor ?? preset.color,
                      }
                    : undefined
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <Input
          id="pwf-effort"
          value={effort}
          onChange={(e) => onEffortChange(e.target.value)}
          placeholder="или опиши своими словами"
        />
      </div>

      {/* Пульсовые зоны — inline чипы */}
      <div className="space-y-2">
        <Label>Пульсовые зоны</Label>
        <div className="flex flex-wrap gap-2">
          {HR_ZONE_DEFS.map((zone) => {
            const selected = hrZones.includes(zone.value);
            return (
              <button
                key={zone.value}
                type="button"
                onClick={() => toggleZone(zone.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                )}
                style={
                  selected
                    ? {
                        backgroundColor: zone.bg,
                        borderColor: zone.color,
                        color: zone.textColor ?? zone.color,
                      }
                    : undefined
                }
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: zone.color }}
                  aria-hidden
                />
                <span className="font-bold">{zone.value}</span>
                <span className="opacity-75">{zone.desc}</span>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          Можно выбрать несколько зон, например Z2 и Z3
        </div>
      </div>

      {/* Заметки */}
      <div className="space-y-2">
        <Label htmlFor="pwf-notes">План и заметки</Label>
        <Textarea
          id="pwf-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
          placeholder="Например: 10 минут разминки, затем ровный лёгкий бег. После — заминка и растяжка."
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function PlansCalendarHost({
  events,
  initialMonthISO,
  activeGoal = null,
}: PlansCalendarHostProps) {
  const router = useRouter();

  const initialMonth = React.useMemo(
    () => new Date(initialMonthISO),
    [initialMonthISO]
  );

  const [selected, setSelected] = React.useState<ExtendedEvent | null>(null);
  const [calendarEventsState, setCalendarEventsState] = React.useState<PlanEvent[]>(events);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDate, setCreateDate] = React.useState<string>("");
  const [createTitle, setCreateTitle] = React.useState("");
  const [createSport, setCreateSport] = React.useState("run");
  const [createDurationMin, setCreateDurationMin] = React.useState("");
  const [createDistanceKm, setCreateDistanceKm] = React.useState("");
  const [createEffort, setCreateEffort] = React.useState("");
  const [createHrZones, setCreateHrZones] = React.useState<string[]>([]);
  const [createNotes, setCreateNotes] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editDate, setEditDate] = React.useState("");
  const [editTitle, setEditTitle] = React.useState("");
  const [editSport, setEditSport] = React.useState("run");
  const [editDurationMin, setEditDurationMin] = React.useState("");
  const [editDistanceKm, setEditDistanceKm] = React.useState("");
  const [editEffort, setEditEffort] = React.useState("");
  const [editHrZones, setEditHrZones] = React.useState<string[]>([]);
  const [editNotes, setEditNotes] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Маппим статусы в цвета и флаг isCompleted
  const calendarEvents = React.useMemo<PlanEvent[]>(() => {
    return calendarEventsState.map((e) => {
      const kind = e.kind ?? undefined;
      const status = e.status ?? undefined;

      const isCompleted =
        kind === "workout" || status === "completed";

      const isMissed = status === "missed";

      let colorHex: string | undefined = COLOR_PLANNED;

      if (isCompleted) {
        colorHex = COLOR_COMPLETED;
      } else if (isMissed) {
        colorHex = COLOR_MISSED;
      }

      return {
        ...e,
        kind,
        status,
        colorHex,
        isCompleted,
      };
    });
  }, [calendarEventsState]);

  const orderedEvents = React.useMemo<ExtendedEvent[]>(() => {
    return [...calendarEvents]
      .sort((a, b) => {
        const byDate = String(a.date).localeCompare(String(b.date));
        if (byDate !== 0) return byDate;
        return String(a.title ?? "").localeCompare(String(b.title ?? ""));
      })
      .map((e) => e as ExtendedEvent);
  }, [calendarEvents]);

  const selectedIndex = React.useMemo(() => {
    if (!selected) return -1;
    return orderedEvents.findIndex((evt) => String(evt.id) === String(selected.id));
  }, [orderedEvents, selected]);

  const prevEvent = selectedIndex > 0 ? orderedEvents[selectedIndex - 1] : null;
  const nextEvent =
    selectedIndex >= 0 && selectedIndex < orderedEvents.length - 1
      ? orderedEvents[selectedIndex + 1]
      : null;

  React.useEffect(() => {
    if (!selected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // не мешаем подтверждению удаления
      if (confirmDeleteOpen) return;
      if (createOpen) return;
      if (editOpen) return;

      if (e.key === "ArrowLeft" && prevEvent) {
        e.preventDefault();
        setSelected(prevEvent);
      }

      if (e.key === "ArrowRight" && nextEvent) {
        e.preventDefault();
        setSelected(nextEvent);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, prevEvent, nextEvent, confirmDeleteOpen, createOpen, editOpen]);

  React.useEffect(() => {
    setCalendarEventsState(events);
  }, [events]);

  const handleEventClick = (evt: PlanEvent) => {
    setSelected(evt as ExtendedEvent);
  };

  const handleDayClick = (isoDate: string) => {
    if (isoDate < getTodayIso()) return;
    setCreateDate(isoDate);
    setCreateTitle("");
    setCreateSport("run");
    setCreateDurationMin("");
    setCreateDistanceKm("");
    setCreateEffort("");
    setCreateHrZones([]);
    setCreateNotes("");
    setCreateError(null);
    setCreateOpen(true);
  };

  const openEditDialog = React.useCallback(() => {
    if (!selected || selected.kind !== "planned") return;

    const structure = selected.structure ?? null;
    const rawHrZones = (structure as any)?.hr_zones;
    const normalizedHrZones = Array.isArray(rawHrZones)
      ? rawHrZones
          .map((zone) => {
            if (typeof zone === "string") return zone;
            if (zone && typeof zone === "object") {
              return String((zone as PlannedHrZoneChip).value ?? "");
            }
            return "";
          })
          .filter(Boolean)
      : [];

    setEditDate(String(selected.date ?? ""));
    setEditTitle(String(selected.title ?? ""));
    setEditSport(String(selected.sport ?? "run"));
    setEditDurationMin(
      selected.planned_duration_min != null
        ? String(selected.planned_duration_min)
        : structure?.duration_min != null
          ? String(structure.duration_min)
          : ""
    );
    setEditDistanceKm(
      selected.planned_distance_km != null
        ? String(selected.planned_distance_km)
        : structure?.distance_km != null
          ? String(structure.distance_km)
          : ""
    );
    setEditEffort(
      String(
        selected.effort ??
          structure?.effort ??
          ""
      )
    );
    setEditHrZones(normalizedHrZones);
    setEditNotes(
      String(
        selected.notes ??
          structure?.notes ??
          selected.description ??
          ""
      )
    );
    setEditError(null);
    setEditOpen(true);
  }, [selected]);

  const handleEventDrop = React.useCallback(
    async (evt: PlanEvent, nextDate: string) => {
      const todayIso = getTodayIso();
      const eventId = String(evt.id);

      if (evt.kind !== "planned") return;
      if (evt.status === "completed" || evt.status === "missed") return;
      if (String(evt.date) < todayIso) return;
      if (nextDate < todayIso) return;
      if (String(evt.date) === nextDate) return;

      const prevEvents = calendarEventsState;

      setCalendarEventsState((prev) =>
        prev.map((item) =>
          String(item.id) === eventId
            ? {
                ...item,
                date: nextDate,
                planned_date: nextDate,
              }
            : item
        )
      );

      setSelected((prev) =>
        prev && String(prev.id) === eventId
          ? ({
              ...prev,
              date: nextDate,
              planned_date: nextDate,
            } as ExtendedEvent)
          : prev
      );

      try {
        const res = await fetch(`/api/plan/sessions/${eventId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planned_date: nextDate,
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          console.error("plan_session_reschedule_failed", json);
          throw new Error("Не удалось перенести тренировку.");
        }

        router.refresh();
      } catch (e) {
        console.error("plan_session_reschedule_failed", e);
        setCalendarEventsState(prevEvents);
        setSelected((prev) =>
          prev && String(prev.id) === eventId
            ? ({ ...prev, date: String(evt.date), planned_date: String(evt.date) } as ExtendedEvent)
            : prev
        );
      }
    },
    [calendarEventsState, router]
  );

  // 👉 теперь кликаем по ЛЮБОЙ части дня (даже если есть карточки)
  // это важно: прокидываем хендлер вниз и используем stopPropagation в карточках

  const handleCreatePlannedWorkout = React.useCallback(async () => {
    if (isCreating) return;

    const title = createTitle.trim();
    const durationMin = createDurationMin.trim() ? Number(createDurationMin) : null;
    const distanceVisible = createSport !== "strength" && createSport !== "other";
    const distanceKm =
      distanceVisible && createDistanceKm.trim() ? Number(createDistanceKm) : null;

    if (!createDate) {
      setCreateError("Не выбрана дата.");
      return;
    }

    if (!title) {
      setCreateError("Укажите название тренировки.");
      return;
    }

    if (!createSport) {
      setCreateError("Выберите тип тренировки.");
      return;
    }

    if (
      durationMin != null &&
      (!Number.isFinite(durationMin) || durationMin <= 0)
    ) {
      setCreateError("Длительность должна быть больше 0.");
      return;
    }

    if (distanceKm != null && (!Number.isFinite(distanceKm) || distanceKm <= 0)) {
      setCreateError("Некорректная дистанция.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const res = await fetch("/api/plan/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planned_date: createDate,
          sport: createSport,
          title,
          notes: createNotes.trim() || null,
          effort: createEffort.trim() || null,
          hr_zones: createHrZones,
          duration_min: durationMin,
          distance_km: distanceKm,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        console.error("create planned workout failed", json);

        if (String(json?.error ?? "").includes("user_plan_id")) {
          throw new Error("Не удалось создать тренировку. План ещё не инициализирован.");
        }

        throw new Error("Ошибка сохранения тренировки. Попробуйте ещё раз.");
      }

      const json = await res.json();
      const data = json.session;

      const createdEvent: PlanEvent = {
        id: data.id,
        date: data.planned_date,
        title: data.title || title,
        kind: "planned",
        status: data.status,
        sport: createSport,
        description: data.structure?.notes ?? data.notes ?? data.structure?.main ?? null,
        user_plan_id: data.user_plan_id,
        link_workout_id: data.link_workout_id,
        structure: data.structure ?? null,
        notes: data.notes ?? data.structure?.notes ?? null,
        goal: data.structure?.goal ?? null,
        main: data.structure?.main ?? null,
        effort: data.structure?.effort ?? null,
        hr_target: createHrZones.length ? createHrZones.join(", ") : null,
        planned_distance_km: data.structure?.distance_km ?? null,
        planned_duration_min: data.structure?.duration_min ?? null,
        planned_date: data.planned_date,
        source: "manual",
      };

      setCalendarEventsState((prev) => [...prev, createdEvent]);
      setCreateOpen(false);
    } catch (e: any) {
      console.error("create planned workout failed", e);
      setCreateError(e?.message ?? "Не удалось создать плановую тренировку.");
    } finally {
      setIsCreating(false);
    }
  }, [
    createDate,
    createDistanceKm,
    createDurationMin,
    createEffort,
    createHrZones,
    createNotes,
    createSport,
    createTitle,
    isCreating,
  ]);

  const isCreateValid =
    !!createDate &&
    !!createSport &&
    createTitle.trim().length > 0 &&
    (createDurationMin === "" || Number(createDurationMin) > 0);

  const isEditValid =
    !!editDate &&
    !!editSport &&
    editTitle.trim().length > 0 &&
    (editDurationMin === "" || Number(editDurationMin) > 0);

  const dateStr = selected ? formatDateRu(selected.date) : "—";
  const description = (selected?.description as string | null | undefined) ?? null;
  const sport = selected?.sport ?? null;
  const distanceStr = formatDistance(selected?.distance_m);
  const durationStr = formatDuration(selected?.duration_sec);
  const structure = selected?.structure ?? null;
  const plannedMain = structure?.main ?? (selected as any)?.main ?? null;
  const plannedEffort = structure?.effort ?? (selected as any)?.effort ?? null;
  const plannedHrTarget = structure?.hr_target ?? (selected as any)?.hr_target ?? null;
  const plannedHrZones: PlannedHrZoneChip[] = (() => {
    const raw = (structure as any)?.hr_zones;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const items = raw.map((z: unknown, i: number) => {
      if (typeof z === "string") {
        return { value: z, label: z };
      }
      if (z && typeof z === "object") {
        const o = z as PlannedHrZoneChip;
        return {
          value: o.value,
          label: o.label,
          range: o.range,
          color: o.color,
        };
      }
      return { value: String(z ?? i) };
    });
    const order = (z: PlannedHrZoneChip) => {
      const m = String(z.value ?? z.label ?? "")
        .toUpperCase()
        .match(/Z(\d+)/);
      return m ? parseInt(m[1], 10) : 999;
    };
    return items.sort((a, b) => order(a) - order(b));
  })();
  const plannedStrengthBlock =
    structure?.strength_block ?? (selected as any)?.strength_block ?? null;
  const plannedNotes = structure?.notes ?? (selected as any)?.notes ?? null;
  const plannedSteps = Array.isArray(structure?.steps) ? structure.steps : [];
  const plannedDistanceStr = formatPlannedDistance(
    (selected as any)?.planned_distance_km ?? structure?.distance_km ?? null
  );
  const trainingBenefit = getTrainingBenefit(selected, activeGoal);
  const checklistItems = getChecklistItems(selected);
  const plannedDurationStr = formatMinutes(
    (selected as any)?.planned_duration_min ?? structure?.duration_min ?? null
  );
  const isPlanned = selected?.kind === "planned";
  const isGoal = selected?.kind === "goal";
  const isWorkout = selected?.kind === "workout";

  const handleUpdatePlannedWorkout = React.useCallback(async () => {
    if (!selected || !isPlanned || isUpdating) return;

    const title = editTitle.trim();
    const durationMin = editDurationMin.trim() ? Number(editDurationMin) : null;
    const distanceVisible = editSport !== "strength" && editSport !== "other";
    const distanceKm =
      distanceVisible && editDistanceKm.trim() ? Number(editDistanceKm) : null;

    if (!editDate) {
      setEditError("Не выбрана дата.");
      return;
    }

    if (editDate < getTodayIso()) {
      setEditError("Нельзя перенести плановую тренировку в прошлое.");
      return;
    }

    if (!title) {
      setEditError("Укажите название тренировки.");
      return;
    }

    if (!editSport) {
      setEditError("Выберите тип тренировки.");
      return;
    }

    if (
      durationMin != null &&
      (!Number.isFinite(durationMin) || durationMin <= 0)
    ) {
      setEditError("Длительность должна быть больше 0.");
      return;
    }

    if (distanceKm != null && (!Number.isFinite(distanceKm) || distanceKm <= 0)) {
      setEditError("Некорректная дистанция.");
      return;
    }

    try {
      setIsUpdating(true);
      setEditError(null);

      const res = await fetch(`/api/plan/sessions/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planned_date: editDate,
          sport: editSport,
          title,
          notes: editNotes.trim() || null,
          effort: editEffort.trim() || null,
          hr_zones: editHrZones,
          duration_min: durationMin,
          distance_km: distanceKm,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        console.error("update planned workout failed", json);
        throw new Error("Ошибка сохранения тренировки. Попробуйте ещё раз.");
      }

      const json = await res.json().catch(() => null);
      const session = json?.session;
      const nextStructure = session?.structure ?? {
        ...(selected.structure ?? {}),
        notes: editNotes.trim() || null,
        effort: editEffort.trim() || null,
        hr_zones: editHrZones,
        duration_min: durationMin,
        distance_km: distanceKm,
      };

      const updatedEvent: ExtendedEvent = {
        ...selected,
        date: session?.planned_date ?? editDate,
        planned_date: session?.planned_date ?? editDate,
        title: session?.title ?? title,
        sport: session?.sport ?? editSport,
        description: session?.notes ?? (editNotes.trim() || null),
        notes: session?.notes ?? (editNotes.trim() || null),
        structure: nextStructure,
        effort: nextStructure?.effort ?? (editEffort.trim() || null),
        hr_target: editHrZones.length ? editHrZones.join(", ") : null,
        planned_duration_min: nextStructure?.duration_min ?? durationMin,
        planned_distance_km: nextStructure?.distance_km ?? distanceKm,
      };

      setCalendarEventsState((prev) =>
        prev.map((evt) =>
          String(evt.id) === String(selected.id) ? updatedEvent : evt
        )
      );
      setSelected(updatedEvent);
      setEditOpen(false);
      router.refresh();
    } catch (e: any) {
      console.error("update planned workout failed", e);
      setEditError(e?.message ?? "Не удалось сохранить тренировку.");
    } finally {
      setIsUpdating(false);
    }
  }, [
    editDate,
    editDistanceKm,
    editDurationMin,
    editEffort,
    editHrZones,
    editNotes,
    editSport,
    editTitle,
    isPlanned,
    isUpdating,
    router,
    selected,
  ]);

  const purposeLabel = getTrainingPurposeLabel(selected);
  const executionTips = getExecutionTips(selected);

  const doDelete = React.useCallback(async () => {
    if (!selected || !isPlanned || isDeleting) return;

    try {
      setIsDeleting(true);

      const res = await fetch(`/api/plan/sessions/${selected.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        console.error("plan_session_cancel_failed", json);
        return;
      }

      setCalendarEventsState((prev) => prev.filter((evt) => String(evt.id) !== String(selected.id)));
      setConfirmDeleteOpen(false);
      setSelected(null);
    } catch (e) {
      console.error("plan_session_cancel_failed", e);
    } finally {
      setIsDeleting(false);
    }
  }, [selected, isPlanned, isDeleting]);

  return (
    <>
      <PlansCalendar
        events={calendarEvents}
        initialMonth={initialMonth}
        onEventClick={handleEventClick}
        onDayClick={handleDayClick}
        onEventDrop={handleEventDrop}
      />

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelected(null);
              setConfirmDeleteOpen(false);
            }}
          />
          <RD.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex h-[min(85vh,900px)] w-[min(960px,calc(100vw-2rem))] max-w-[960px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden " +
                "rounded-[var(--radius-lg,var(--radius))] border border-border bg-background p-0 text-foreground shadow-strong " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onPointerDownOutside={() => {
              setSelected(null);
              setConfirmDeleteOpen(false);
            }}
          >
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <DialogTitle>
                {selected?.title || "Тренировка"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!prevEvent}
                  onClick={() => {
                    if (prevEvent) {
                      setSelected(prevEvent);
                      setConfirmDeleteOpen(false);
                    }
                  }}
                >
                  ← Предыдущая
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!nextEvent}
                  onClick={() => {
                    if (nextEvent) {
                      setSelected(nextEvent);
                      setConfirmDeleteOpen(false);
                    }
                  }}
                >
                  Следующая →
                </Button>
              </div>
            </div>
          </div>

          {/* Тело модалки со скроллом */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!isGoal ? (
                <Card className="gap-4 bg-muted/20 py-4 sm:col-span-2">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 px-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {isPlanned ? "План" : "Выполнено"}
                        </span>
                        <SportBadge sport={sport} />
                        {isPlanned ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            {purposeLabel}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <div className="text-lg font-semibold leading-tight">
                          {selected?.title || "Тренировка"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isPlanned ? (
                        <>
                          {plannedDurationStr !== "—" ? (
                            <MetaPill icon={<Timer className="h-3.5 w-3.5" />}>
                              {plannedDurationStr}
                            </MetaPill>
                          ) : null}
                          {plannedDistanceStr !== "—" ? (
                            <MetaPill icon={<Route className="h-3.5 w-3.5" />}>
                              {plannedDistanceStr}
                            </MetaPill>
                          ) : null}
                          {plannedEffort ? (
                            <MetaPill icon={<Gauge className="h-3.5 w-3.5" />}>
                              {plannedEffort}
                            </MetaPill>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {durationStr !== "—" ? (
                            <MetaPill icon={<Timer className="h-3.5 w-3.5" />}>
                              {durationStr}
                            </MetaPill>
                          ) : null}
                          {distanceStr !== "—" ? (
                            <MetaPill icon={<Route className="h-3.5 w-3.5" />}>
                              {distanceStr}
                            </MetaPill>
                          ) : null}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
                ) : null}
              </div>

              {isGoal ? (
                (() => {
                  const goalType = String((selected as any)?.goal_type ?? "").toLowerCase();
                  const isRaceGoal = ["5k", "10k", "hm", "m", "race", "event"].includes(goalType);
                  const goalIcon = (selected as any)?.goal_icon ?? "🎯";
                  const daysToGoal = selected?.date ? daysBetweenIso(getTodayIso(), String(selected.date)) : null;
                  const motivation = daysToGoal != null ? getGoalMotivation(daysToGoal, isRaceGoal) : "";
                  const accent = isRaceGoal
                    ? { main: "#E58B21", deep: "#A56300", soft: "#FFD600", orb: "rgba(255,214,0,0.35)" }
                    : { main: "#1B2EC9", deep: "#0E1A8E", soft: "#3AAAEF", orb: "rgba(58,170,239,0.30)" };

                  return (
                    <Card
                      className="relative gap-0 overflow-hidden border-2 py-0"
                      style={{
                        borderColor: isRaceGoal ? "rgba(229,139,33,0.4)" : "rgba(27,46,201,0.3)",
                        background: isRaceGoal
                          ? "linear-gradient(135deg, rgba(255,214,0,0.20) 0%, rgba(255,255,255,0.55) 60%, rgba(229,139,33,0.14) 100%)"
                          : "linear-gradient(135deg, rgba(58,170,239,0.16) 0%, rgba(255,255,255,0.55) 60%, rgba(27,46,201,0.12) 100%)",
                      }}
                    >
                      <div
                        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl"
                        style={{ background: accent.orb }}
                      />
                      <div
                        className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full blur-3xl"
                        style={{ background: isRaceGoal ? "rgba(229,139,33,0.22)" : "rgba(27,46,201,0.18)" }}
                      />

                      <CardContent className="relative space-y-5 p-6 sm:p-7">
                        {/* Hero */}
                        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
                          <div
                            className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-white text-5xl shadow-lg ring-4"
                            style={{ boxShadow: `0 0 0 4px ${isRaceGoal ? "rgba(255,214,0,0.4)" : "rgba(58,170,239,0.4)"}, 0 10px 25px -10px rgba(0,0,0,0.2)` }}
                          >
                            {goalIcon}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
                              style={{ color: accent.deep }}
                            >
                              <Trophy className="size-3" />
                              {isRaceGoal ? "Гонка / Соревнование" : "Цель"}
                            </div>
                            <div className="text-2xl font-bold leading-tight sm:text-3xl">
                              {selected?.title || "Цель"}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground/80 sm:justify-start">
                              <CalendarDays className="size-4" />
                              <span>{dateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Countdown cards */}
                        {daysToGoal != null ? (
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-sm backdrop-blur-sm">
                              <div className="text-3xl font-extrabold tabular-nums" style={{ color: accent.deep }}>
                                {Math.abs(daysToGoal)}
                              </div>
                              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {pluralizeRu(Math.abs(daysToGoal), ["день", "дня", "дней"])}{daysToGoal < 0 ? " назад" : daysToGoal === 0 ? "" : " до"}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-sm backdrop-blur-sm">
                              <div className="text-3xl font-extrabold tabular-nums" style={{ color: accent.deep }}>
                                {Math.floor(Math.abs(daysToGoal) / 7)}
                              </div>
                              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {pluralizeRu(Math.floor(Math.abs(daysToGoal) / 7), ["неделя", "недели", "недель"])}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-sm backdrop-blur-sm">
                              <div className="text-2xl font-extrabold uppercase tabular-nums" style={{ color: accent.deep }}>
                                {String((selected as any)?.goal_type ?? "—").toUpperCase()}
                              </div>
                              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Тип
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Motivation */}
                        {motivation ? (
                          <div
                            className="rounded-2xl border bg-white/65 p-4 backdrop-blur-sm"
                            style={{ borderColor: isRaceGoal ? "rgba(229,139,33,0.30)" : "rgba(27,46,201,0.25)" }}
                          >
                            <div className="flex items-start gap-2.5">
                              <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: accent.main }} />
                              <div className="text-sm font-medium leading-relaxed">{motivation}</div>
                            </div>
                          </div>
                        ) : null}

                        {/* CTA */}
                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => {
                              setSelected(null);
                              router.push("/goals");
                            }}
                          >
                            Открыть цель
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()
              ) : isPlanned ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          Целевой пульс
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        {plannedHrZones.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {plannedHrZones.map((zone, idx) => {
                              const def = getHrZoneDef(zone.value ?? zone.label);
                              const accent = def?.color ?? zone.color ?? "#1B2EC9";
                              return (
                                <span
                                  key={zone.value ?? zone.label ?? String(idx)}
                                  className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
                                  style={
                                    def
                                      ? {
                                          backgroundColor: def.bg,
                                          borderColor: def.color,
                                          color: def.textColor ?? def.color,
                                        }
                                      : undefined
                                  }
                                >
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: accent }}
                                    aria-hidden
                                  />
                                  <span className="font-bold">{zone.value ?? zone.label}</span>
                                  {def ? (
                                    <span className="opacity-75">{def.desc}</span>
                                  ) : zone.range ? (
                                    <span className="text-muted-foreground">{zone.range}</span>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm font-medium">
                            {plannedHrTarget || "без ориентира по пульсу"}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          Длительность
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{plannedDurationStr}</div>
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          Интенсивность
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{plannedEffort ?? "—"}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Flag className="h-4 w-4" />
                        Что даст эта тренировка
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <div className="text-sm text-muted-foreground">
                        {trainingBenefit}
                      </div>
                    </CardContent>
                  </Card>

                  {plannedSteps.length > 0 ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">План тренировки</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 px-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          Визуализация тренировки
                        </div>
                        <div className="flex h-20 overflow-hidden rounded-xl border bg-muted/5 shadow-sm">
                          {plannedSteps.map((step, idx) => {
                            const raw =
                              Number(step?.duration_min ?? 0) > 0
                                ? Number(step.duration_min)
                                : Number(step?.distance_km ?? 1);
                            const repeats =
                              Number(step?.repeats ?? 0) > 0 ? Number(step.repeats) : 1;
                            const weighted = raw * repeats;
                            const flexGrow = Math.max(1, weighted);
                            const theme = getStepTheme(step?.type);
                            const Icon = theme.Icon;
                            const durLabel =
                              Number(step?.duration_min ?? 0) > 0
                                ? `${Math.round(Number(step.duration_min))}'`
                                : Number(step?.distance_km ?? 0) > 0
                                  ? `${Number(step.distance_km).toFixed(1)}km`
                                  : "";

                            return (
                              <div
                                key={`${selected?.id}-viz-${idx}`}
                                className="group relative flex flex-col items-center justify-center gap-0.5 overflow-hidden border-r border-white/60 px-2 transition-all last:border-r-0 hover:brightness-105"
                                style={{
                                  background: theme.bg,
                                  flex: `${flexGrow} 1 0%`,
                                  minWidth: 60,
                                }}
                                title={formatStep(step)}
                              >
                                <div className="absolute inset-x-0 top-0 h-1" style={{ background: theme.color }} />
                                <Icon className="size-4" style={{ color: theme.color }} />
                                <div
                                  className="text-[10px] font-extrabold leading-none tabular-nums"
                                  style={{ color: theme.textColor ?? theme.color }}
                                >
                                  {durLabel}
                                </div>
                                {repeats > 1 ? (
                                  <div
                                    className="text-[9px] font-bold uppercase tracking-wider"
                                    style={{ color: theme.textColor ?? theme.color, opacity: 0.75 }}
                                  >
                                    ×{repeats}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const seen = new Set<string>();
                            return plannedSteps
                              .map((s) => String(s?.type ?? "default"))
                              .filter((t) => {
                                if (seen.has(t)) return false;
                                seen.add(t);
                                return true;
                              })
                              .map((type) => {
                                const theme = getStepTheme(type);
                                const Icon = theme.Icon;
                                return (
                                  <span
                                    key={type}
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                    style={{
                                      borderColor: theme.color,
                                      color: theme.textColor ?? theme.color,
                                      backgroundColor: theme.bg,
                                    }}
                                  >
                                    <Icon className="size-3" />
                                    {theme.label}
                                  </span>
                                );
                              });
                          })()}
                        </div>
                      </CardContent>
                      <CardContent className="space-y-3 px-4">
                        {plannedSteps.map((step, idx) => {
                          const stepTheme = getStepTheme(step?.type);
                          const StepIcon = stepTheme.Icon;
                          return (
                          <div
                            key={`${selected?.id}-step-${idx}`}
                            className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                            style={{ borderLeftWidth: 4, borderLeftColor: stepTheme.color }}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                                style={{ background: stepTheme.bg }}
                              >
                                <StepIcon className="size-5" style={{ color: stepTheme.color }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="text-sm font-semibold">
                                      {step?.label ?? `Шаг ${idx + 1}`}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatStep(step)}
                                    </div>
                                  </div>
                                  <span
                                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                    style={{
                                      background: stepTheme.bg,
                                      color: stepTheme.textColor ?? stepTheme.color,
                                    }}
                                  >
                                    {stepTheme.label}
                                  </span>
                                </div>
                                {step?.notes ? (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    {String(step.notes)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </CardContent>

                      {plannedNotes ? (
                        <CardContent className="border-t px-4 pt-4">
                          <div className="mb-2 text-sm font-semibold">Примечания</div>
                          <div className="text-sm text-muted-foreground">
                            {plannedNotes}
                          </div>
                        </CardContent>
                      ) : null}
                    </Card>
                  ) : (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">План тренировки</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm text-muted-foreground">
                          Структура тренировки пока не заполнена
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Flag className="h-4 w-4" />
                        Как выполнять
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <ul className="space-y-2">
                        {executionTips.map((tip, idx) => (
                          <li
                            key={`${selected?.id}-tip-${idx}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
                            <span className="text-muted-foreground">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {plannedStrengthBlock ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                          <Dumbbell className="h-4 w-4" />
                          Силовой блок
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm text-muted-foreground">{plannedStrengthBlock}</div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {checklistItems.length > 0 ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">Чеклист перед тренировкой</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4">
                        {checklistItems.map((item, idx) => (
                          <div
                            key={`${selected?.id}-check-${idx}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(45,118,1)]" />
                            <span className="text-muted-foreground">{item}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : (
                <>
                  {(() => {
                    const sportTheme = getSportTheme(sport);
                    const SportIco = sportTheme.Icon;
                    const paceStr = calcPace(
                      selected?.distance_m as number | null | undefined,
                      selected?.duration_sec as number | null | undefined,
                      sport
                    );
                    return (
                      <>
                        {/* Achievement banner */}
                        <Card
                          className="relative gap-0 overflow-hidden border-2 py-0"
                          style={{
                            borderColor: "rgba(26,158,58,0.35)",
                            background:
                              "linear-gradient(135deg, rgba(197,237,208,0.55) 0%, rgba(255,255,255,0.7) 60%, rgba(26,158,58,0.12) 100%)",
                          }}
                        >
                          <div
                            className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full blur-3xl"
                            style={{ background: "rgba(26,158,58,0.25)" }}
                          />
                          <CardContent className="relative flex items-center justify-between gap-3 p-5">
                            <div className="flex items-center gap-3">
                              <div className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-md ring-2 ring-emerald-200/60">
                                <CheckCircle2 className="size-6 text-emerald-700" />
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                  Выполнено
                                </div>
                                <div className="text-base font-bold">Тренировка завершена</div>
                              </div>
                            </div>
                            <Sparkles className="size-6 text-emerald-600/60" />
                          </CardContent>
                        </Card>

                        {/* Metric grid */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div
                            className="rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md"
                            style={{ borderColor: `${sportTheme.color}33` }}
                          >
                            <div
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: sportTheme.textColor ?? sportTheme.color }}
                            >
                              <Route className="size-3.5" />
                              <span>Дистанция</span>
                            </div>
                            <div className="mt-1 text-xl font-extrabold tabular-nums">{distanceStr}</div>
                          </div>
                          <div
                            className="rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md"
                            style={{ borderColor: `${sportTheme.color}33` }}
                          >
                            <div
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: sportTheme.textColor ?? sportTheme.color }}
                            >
                              <Timer className="size-3.5" />
                              <span>Время</span>
                            </div>
                            <div className="mt-1 text-xl font-extrabold tabular-nums">{durationStr}</div>
                          </div>
                          <div
                            className="rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md"
                            style={{ borderColor: `${sportTheme.color}33` }}
                          >
                            <div
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: sportTheme.textColor ?? sportTheme.color }}
                            >
                              <Gauge className="size-3.5" />
                              <span>Темп</span>
                            </div>
                            <div className="mt-1 text-xl font-extrabold tabular-nums">{paceStr ?? "—"}</div>
                          </div>
                          <div
                            className="rounded-2xl border p-3 transition-shadow hover:shadow-md"
                            style={{
                              borderColor: `${sportTheme.color}33`,
                              background: sportTheme.bg,
                            }}
                          >
                            <div
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: sportTheme.textColor ?? sportTheme.color }}
                            >
                              <SportIco className="size-3.5" />
                              <span>Тип</span>
                            </div>
                            <div
                              className="mt-1 text-xl font-extrabold"
                              style={{ color: sportTheme.textColor ?? sportTheme.color }}
                            >
                              {sportTheme.label}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {description ? (
                          <Card>
                            <CardContent className="space-y-2 p-5">
                              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Sparkles className="size-3.5" />
                                Описание
                              </div>
                              <div className="text-sm leading-relaxed">{description}</div>
                            </CardContent>
                          </Card>
                        ) : null}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-row justify-end gap-2 border-t px-6 py-4">
            {isWorkout && selected?.link_workout_id ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const workoutId = selected.link_workout_id;
                  setSelected(null);
                  setConfirmDeleteOpen(false);
                  window.location.href = `/workouts/${workoutId}`;
                }}
              >
                Перейти
              </Button>
            ) : null}

            {isPlanned ? (
              <Button
                type="button"
                variant="danger"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Удалить
              </Button>
            ) : null}

            {isPlanned ? (
              <Button
                type="button"
                variant="primary"
                disabled={isUpdating}
                onClick={openEditDialog}
              >
                Редактировать
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelected(null);
                setConfirmDeleteOpen(false);
              }}
            >
              Закрыть
            </Button>
          </div>
          </RD.Content>
        </DialogPortal>
      </Dialog>

      <ConfirmActionDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Удалить тренировку?"
        description="Это действие необратимо."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={doDelete}
        contentClassName="max-w-md"
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <RD.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
              "rounded-[var(--radius-lg,var(--radius))] border border-border bg-background p-0 text-foreground shadow-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="shrink-0 border-b px-6 py-5">
              <DialogTitle>Новая плановая тренировка</DialogTitle>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>{formatDateRu(createDate)}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <PlannedWorkoutForm
                date={createDate}
                title={createTitle}
                onTitleChange={setCreateTitle}
                sport={createSport}
                onSportChange={setCreateSport}
                durationMin={createDurationMin}
                onDurationMinChange={setCreateDurationMin}
                distanceKm={createDistanceKm}
                onDistanceKmChange={setCreateDistanceKm}
                effort={createEffort}
                onEffortChange={setCreateEffort}
                hrZones={createHrZones}
                onHrZonesChange={setCreateHrZones}
                notes={createNotes}
                onNotesChange={setCreateNotes}
                error={createError}
              />
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isCreating}
                onClick={() => setCreateOpen(false)}
              >
                Отменить
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isCreating || !isCreateValid}
                onClick={() => void handleCreatePlannedWorkout()}
              >
                {isCreating ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </RD.Content>
        </DialogPortal>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <RD.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
              "rounded-[var(--radius-lg,var(--radius))] border border-border bg-background p-0 text-foreground shadow-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="shrink-0 border-b px-6 py-5">
              <DialogTitle>Редактировать тренировку</DialogTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                Измените параметры плановой тренировки.
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <PlannedWorkoutForm
                date={editDate}
                onDateChange={setEditDate}
                minDate={getTodayIso()}
                title={editTitle}
                onTitleChange={setEditTitle}
                sport={editSport}
                onSportChange={setEditSport}
                durationMin={editDurationMin}
                onDurationMinChange={setEditDurationMin}
                distanceKm={editDistanceKm}
                onDistanceKmChange={setEditDistanceKm}
                effort={editEffort}
                onEffortChange={setEditEffort}
                hrZones={editHrZones}
                onHrZonesChange={setEditHrZones}
                notes={editNotes}
                onNotesChange={setEditNotes}
                error={editError}
              />
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isUpdating}
                onClick={() => setEditOpen(false)}
              >
                Отменить
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isUpdating || !isEditValid}
                onClick={() => void handleUpdatePlannedWorkout()}
              >
                {isUpdating ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </RD.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}