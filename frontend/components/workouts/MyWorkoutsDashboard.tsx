//frontend/components/workouts/MyWorkoutsDashboard.tsx

"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  Flame,
  Footprints,
  MessageCircle,
  Plus,
  Quote,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sportColor, humanSport } from "@/components/ui/sport-theme";
import logo from "@/app/icon-512.png";

// ============================================================
// TYPES
// ============================================================
type DayRow = { d: string; workouts: number; time_sec: number; distance_m: number; kcal: number };
type WeekRow = { week_start: string; workouts: number; time_sec: number; distance_m: number };
type WdRow = { dow: number; workouts: number; time_sec: number };
type MixRow = { sport: string; workouts: number; time_sec: number };
type HrZoneTime = Record<string, number> | null;
type WorkoutZoneRow = { local_date: string | null; hr_zone_time: HrZoneTime };

type NextPlannedWorkoutRow = {
  id: string;
  planned_date: string;
  title: string | null;
  sport: string | null;
  status: string | null;
  structure?: {
    duration_min?: number | null;
    distance_km?: number | null;
    goal?: string | null;
    effort?: string | null;
  } | null;
};

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  status: string;
  date_from: string;
  date_to: string;
  target_json: {
    primary?: string;
    secondary?: string;
    race_name?: string;
    target_time_s?: number;
  } | null;
  progress_cache?: {
    completion_pct?: number;
    progress_pct?: number;
    progress?: number;
  } | null;
  is_primary?: boolean | null;
};

type CoachQuoteRow = { id: string; body?: string; body_preview?: string; created_at: string };

type GoalForecast = {
  title: string;
  days_left: number;
  current_weekly_km: number;
  projected_weekly_km: number;
  recommended_weekly_km: number | null;
  pct_of_recommended?: number | null;
  status: "on_track" | "watch" | "behind" | "unknown";
} | null;

type HrZonesData = {
  rows: { zone: string; seconds: number; minutes: number }[];
  easyPct: number;
  hardPct: number;
  hasData: boolean;
  workoutsWithDetailedHr: number;
  balanceLabel: string;
  balanceTone: "good" | "ok" | "warn";
  balanceAdvice: string;
};

type WeeklyChartPoint = { w: string; hours: number; workouts: number; distance_km: number };

type FormScore = {
  score: number;
  label: string;
  tone: "good" | "ok" | "warn" | "muted";
};

type Trend = { pct: number; up: boolean };

// ============================================================
// CONSTANTS
// ============================================================
const DOW_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const PERIOD_STORAGE_KEY = "capyrun.dashboard.periodDays";
const PERIOD_OPTIONS = [7, 30, 90, 365] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

// Бренд-палитра
const C = {
  indigo: "rgb(27,46,201)",
  indigoLight: "rgba(27,46,201,0.12)",
  indigoSoft: "rgba(197,206,250,0.55)",
  green: "rgb(26,158,58)",
  greenLight: "rgba(26,158,58,0.12)",
  greenSoft: "rgba(197,237,208,0.55)",
  orange: "rgb(229,139,33)",
  orangeLight: "rgba(229,139,33,0.12)",
  orangeSoft: "rgba(255,246,232,0.85)",
  violet: "rgb(124,58,237)",
  violetLight: "rgba(124,58,237,0.12)",
  violetSoft: "rgba(209,193,228,0.55)",
  sky: "rgb(14,165,233)",
  skyLight: "rgba(14,165,233,0.12)",
  rose: "rgb(244,63,94)",
} as const;

const RU_MONTHS_SHORT = [
  "янв.",
  "фев.",
  "март",
  "апр.",
  "май",
  "июнь",
  "июль",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
] as const;

function formatShortRuDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getDate()} ${RU_MONTHS_SHORT[date.getMonth()]}`;
}

function formatNumberRu(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat("ru-RU", options).format(value);
}

const GOAL_TYPE_META: Record<string, { emoji: string; label: string }> = {
  "10k": { emoji: "💨", label: "Забег 10 км" },
  HM: { emoji: "🏁", label: "Полумарафон" },
  M: { emoji: "🧱", label: "Марафон" },
  trail: { emoji: "⛰️", label: "Трейл" },
  ride: { emoji: "🚴‍♂️", label: "Вело" },
  swim: { emoji: "🏊‍♂️", label: "Плавание" },
  strength: { emoji: "🏋️‍♂️", label: "Силовая" },
  weight: { emoji: "⚖️", label: "Снижение веса" },
  vo2max: { emoji: "🫁", label: "Выносливость" },
  custom: { emoji: "🎯", label: "Индивидуальная цель" },
};

const GOAL_TYPE_ACCENT: Record<string, { progress: string; track: string }> = {
  "10k": { progress: C.indigo, track: C.indigoLight },
  HM: { progress: C.indigo, track: C.indigoLight },
  custom: { progress: C.indigo, track: C.indigoLight },
  M: { progress: C.violet, track: C.violetLight },
  strength: { progress: C.violet, track: C.violetLight },
  trail: { progress: C.green, track: C.greenLight },
  ride: { progress: C.green, track: C.greenLight },
  vo2max: { progress: C.green, track: C.greenLight },
  swim: { progress: C.sky, track: C.skyLight },
  weight: { progress: C.orange, track: C.orangeLight },
};

const HR_ZONE_COLORS: Record<string, string> = {
  Z1: C.sky,
  Z2: C.green,
  Z3: C.indigo,
  Z4: C.orange,
  Z5: C.rose,
};

// ============================================================
// HELPERS
// ============================================================
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function fmtTime(sec: number) {
  const s = Number(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

function fmtHoursOnly(sec: number) {
  const h = Math.max(1, Math.round(sec / 3600));
  return `${h} ч`;
}
function fmtKm(meters: number) {
  const km = Number(meters || 0) / 1000;
  const d = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(d).replace(".", ",")} км`;
}
function fmtKcal(k: number) {
  return `${Math.round(Number(k || 0))} ккал`;
}
function fmtPercent(v: number) {
  return `${Math.round(v)}%`;
}
function formatDateShortRu(isoDate?: string | null) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  if (today === target) return "Сегодня";

  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
function daysLeft(dateTo?: string | null) {
  if (!dateTo) return null;
  const end = new Date(dateTo);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}
function daysLeftLabel(dateTo?: string | null) {
  const d = daysLeft(dateTo);
  if (d == null) return "Без даты";
  if (d < 0) return "Срок прошёл";
  if (d === 0) return "Сегодня";
  if (d === 1) return "1 день";
  if (d >= 2 && d <= 4) return `${d} дня`;
  return `${d} дней`;
}
function getGoalProgressPct(goal: GoalRow): number {
  const p = goal.progress_cache ?? {};
  const raw = [p.completion_pct, p.progress_pct, p.progress].find(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (typeof raw === "number") return Math.max(0, Math.min(100, Math.round(raw)));
  if (goal.date_from && goal.date_to) {
    const start = new Date(goal.date_from).getTime();
    const end = new Date(goal.date_to).getTime();
    const now = Date.now();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
    }
  }
  return 0;
}
function formatZoneLabel(raw: string) {
  const key = String(raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    z1: "Z1", z2: "Z2", z3: "Z3", z4: "Z4", z5: "Z5",
    zone1: "Z1", zone2: "Z2", zone3: "Z3", zone4: "Z4", zone5: "Z5",
  };
  return map[key] ?? String(raw || "").toUpperCase();
}
function zoneOrder(label: string) {
  const m = /^Z(\d+)$/.exec(label);
  return m ? Number(m[1]) : 999;
}
function sportEmoji(s?: string | null): string {
  const k = (s || "").toLowerCase();
  const map: Record<string, string> = {
    run: "🏃", ride: "🚴", swim: "🏊", walk: "🚶", hike: "🥾",
    row: "🚣", strength: "🏋️", yoga: "🧘", aerobics: "💃",
    crossfit: "🏋️‍♂️", pilates: "🤸",
  };
  return map[k] ?? "🏃";
}

type PlannedWorkoutSummary = {
  title: string;
  meta: string;
  dateLabel: string;
  sport: string | null;
};
function plannedWorkoutSummary(workout: NextPlannedWorkoutRow | null): PlannedWorkoutSummary | null {
  if (!workout) return null;
  const parts: string[] = [];
  if (workout.structure?.duration_min) parts.push(`${Math.round(Number(workout.structure.duration_min))} мин`);
  if (workout.structure?.distance_km) parts.push(`${Number(workout.structure.distance_km).toFixed(1)} км`);
  if (workout.structure?.effort) parts.push(String(workout.structure.effort));
  return {
    title: workout.title || workout.structure?.goal || "Тренировка по плану",
    meta: parts.join(" · ") || "Плановая тренировка",
    dateLabel: formatDateShortRu(workout.planned_date),
    sport: workout.sport,
  };
}

// ============================================================
// SVG RADIAL GAUGE
// ============================================================
function RadialProgress({
  value, size = 190, strokeWidth = 15, trackColor, progressColor,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  progressColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const halfCirc = circumference / 2;
  const p = Math.max(0, Math.min(100, value));
  const progressLen = Math.min((p / 100) * halfCirc, halfCirc);
  const viewH = size / 2 + strokeWidth;
  return (
    <svg width={size} height={viewH} viewBox={`0 0 ${size} ${viewH}`} aria-hidden className="block">
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${halfCirc} ${circumference}`}
        transform={`rotate(180, ${cx}, ${cy})`}
      />
      {p > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={progressColor} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${progressLen} ${circumference}`}
          transform={`rotate(180, ${cx}, ${cy})`}
          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
        />
      )}
    </svg>
  );
}

// ============================================================
// SHADCN-STYLE CHART TOOLTIP
// ============================================================
type TooltipFormatter = (value: number, name?: string) => string;

function ChartTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string; fill?: string; dataKey?: string }>;
  label?: string | number;
  formatter?: TooltipFormatter;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      {label != null ? <div className="mb-1.5 text-xs font-bold text-foreground">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color || entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name ?? entry.dataKey}:</span>
            <span className="ml-auto font-bold tabular-nums text-foreground">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MyWorkoutsDashboardClient({
  daysDefault = 30,
  userName,
}: {
  daysDefault?: number;
  userName?: string | null;
}) {
  const [days, setDays] = useState<PeriodOption>(daysDefault as PeriodOption);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if ((PERIOD_OPTIONS as readonly number[]).includes(parsed)) {
        setDays(parsed as PeriodOption);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(PERIOD_STORAGE_KEY, String(days));
    } catch {}
  }, [days]);

  const [daysData, setDaysData] = useState<DayRow[]>([]);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [wd, setWd] = useState<WdRow[]>([]);
  const [mix, setMix] = useState<MixRow[]>([]);
  const [zoneRows, setZoneRows] = useState<WorkoutZoneRow[]>([]);
  const [nextPlannedWorkout, setNextPlannedWorkout] = useState<NextPlannedWorkoutRow | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<GoalRow | null>(null);
  const [coachQuote, setCoachQuote] = useState<CoachQuoteRow | null>(null);
  const [goalForecast, setGoalForecast] = useState<GoalForecast>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr(null);

      // очищаем старые данные перед новой загрузкой,
      // иначе React/HMR может оставлять старые точки графиков
      setDaysData([]);
      setWeeks([]);
      setWd([]);
      setMix([]);
      setZoneRows([]);
      setGoalForecast(null);

      try {
        const res = await fetch(`/api/dashboard/home?days=${days}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (canceled) return;

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }

        const data = json?.data ?? {};

        setDaysData((data.days ?? []) as DayRow[]);
        setWeeks((data.weeks ?? []) as WeekRow[]);
        setWd((data.weekday ?? []) as WdRow[]);
        setMix((data.sportMix ?? []) as MixRow[]);
        setZoneRows((data.hrZones ?? []) as WorkoutZoneRow[]);
        setNextPlannedWorkout((data.nextPlanned ?? null) as NextPlannedWorkoutRow | null);
        setPrimaryGoal((data.primaryGoal ?? null) as GoalRow | null);
        setCoachQuote((data.latestCoachMessage ?? null) as CoachQuoteRow | null);
        setGoalForecast((data.goalForecast ?? null) as GoalForecast);
      } catch (e: unknown) {
        if (!canceled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [days]);

  const kpi = useMemo(
    () => ({
      workouts: daysData.reduce((s, x) => s + (isNum(x.workouts) ? x.workouts : 0), 0),
      time_sec: daysData.reduce((s, x) => s + (isNum(x.time_sec) ? x.time_sec : 0), 0),
      distance_m: daysData.reduce((s, x) => s + Number(x.distance_m || 0), 0),
      kcal: daysData.reduce((s, x) => s + Number(x.kcal || 0), 0),
    }),
    [daysData],
  );

  const trend: Trend | null = useMemo(() => {
    if (daysData.length < 6) return null;
    const sorted = [...daysData].sort((a, b) => a.d.localeCompare(b.d));
    const half = Math.floor(sorted.length / 2);
    const distA = sorted.slice(0, half).reduce((s, x) => s + Number(x.distance_m || 0), 0);
    const distB = sorted.slice(half).reduce((s, x) => s + Number(x.distance_m || 0), 0);
    if (distA <= 0) return null;
    const pct = Math.round(((distB - distA) / distA) * 100);
    return { pct, up: pct >= 0 };
  }, [daysData]);

  const form: FormScore = useMemo(() => {
    if (!daysData.length) return { score: 0, label: "нет данных", tone: "muted" };
    const sorted = [...daysData].sort((a, b) => a.d.localeCompare(b.d));
    const last7 = sorted.slice(-7);
    const last28 = sorted.slice(-28);
    const km7 = last7.reduce((s, x) => s + Number(x.distance_m || 0), 0) / 1000;
    const km28 = last28.reduce((s, x) => s + Number(x.distance_m || 0), 0) / 1000;
    const exp7 = last28.length >= 14 ? (km28 / Math.max(1, last28.length)) * 7 : km7;
    if (exp7 <= 0.2) return { score: 35, label: "строим базу", tone: "muted" };
    const ratio = km7 / Math.max(0.01, exp7);
    const score = Math.max(0, Math.min(100, Math.round(55 + (ratio - 1) * 28)));
    const tone: FormScore["tone"] =
      score >= 80 ? "good" : score >= 65 ? "ok" : score >= 50 ? "warn" : "muted";
    const label =
      score >= 80 ? "готов жечь" :
      score >= 65 ? "хорошая форма" :
      score >= 50 ? "нормально" :
      "бережно";
    return { score, label, tone };
  }, [daysData]);

  const formAccent = useMemo(() => {
    switch (form.tone) {
      case "good": return { progress: C.green, track: C.greenLight };
      case "ok": return { progress: C.indigo, track: C.indigoLight };
      case "warn": return { progress: C.orange, track: C.orangeLight };
      default:
        if (form.score > 0) return { progress: C.rose, track: "rgba(244,63,94,0.12)" };
        return { progress: "rgb(120,120,140)", track: "rgba(120,120,140,0.14)" };
    }
  }, [form.tone, form.score]);

  const weeklyAvg = useMemo(() => {
    const valid = weeks.filter((w) => Number(w.time_sec || 0) > 0 || Number(w.distance_m || 0) > 0);
    if (!valid.length) return { time_sec: 0, distance_m: 0, workouts: 0 };
    return {
      time_sec: valid.reduce((s, w) => s + Number(w.time_sec || 0), 0) / valid.length,
      distance_m: valid.reduce((s, w) => s + Number(w.distance_m || 0), 0) / valid.length,
      workouts: valid.reduce((s, w) => s + Number(w.workouts || 0), 0) / valid.length,
    };
  }, [weeks]);

  const activeDays = useMemo(
    () => daysData.filter((d) => Number(d.workouts || 0) > 0).length,
    [daysData],
  );

  const weeklyChartData: WeeklyChartPoint[] = useMemo(() => {
    return [...weeks]
      .sort((a, b) => a.week_start.localeCompare(b.week_start))
      .map((w) => ({
        w: formatShortRuDate(w.week_start),
        hours: +(Number(w.time_sec || 0) / 3600).toFixed(2),
        workouts: Number(w.workouts || 0),
        distance_km: +(Number(w.distance_m || 0) / 1000).toFixed(1),
      }));
  }, [weeks]);

  const hrZones: HrZonesData = useMemo(() => {
    const totals = new Map<string, number>();
    let workoutsWithDetailedHr = 0;

    for (const row of zoneRows) {
      const hr = row.hr_zone_time;
      if (!hr || typeof hr !== "object") continue;

      const hasAnyZoneSeconds = Object.values(hr).some((rawValue) => {
        const seconds = Number(rawValue || 0);
        return Number.isFinite(seconds) && seconds > 0;
      });

      if (hasAnyZoneSeconds) workoutsWithDetailedHr += 1;

      for (const [rawKey, rawValue] of Object.entries(hr)) {
        const seconds = Number(rawValue || 0);
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        const label = formatZoneLabel(rawKey);
        totals.set(label, (totals.get(label) ?? 0) + seconds);
      }
    }
    const rows = Array.from(totals.entries())
      .map(([zone, seconds]) => ({ zone, seconds, minutes: Math.round(seconds / 60) }))
      .sort((a, b) => zoneOrder(a.zone) - zoneOrder(b.zone));
    const easySeconds = rows
      .filter((r) => r.zone === "Z1" || r.zone === "Z2")
      .reduce((s, r) => s + r.seconds, 0);
    const hardSeconds = rows
      .filter((r) => !["Z1", "Z2"].includes(r.zone))
      .reduce((s, r) => s + r.seconds, 0);
    const totalSeconds = easySeconds + hardSeconds;
    const easyPct = totalSeconds > 0 ? (easySeconds / totalSeconds) * 100 : 0;
    const hardPct = totalSeconds > 0 ? (hardSeconds / totalSeconds) * 100 : 0;

    const balanceTone: HrZonesData["balanceTone"] =
      easyPct >= 78 && easyPct <= 90 ? "good" : easyPct >= 70 ? "ok" : "warn";

    const balanceLabel =
      balanceTone === "good"
        ? "Баланс отличный"
        : balanceTone === "ok"
          ? "Почти 80/20"
          : "Слишком много интенсивности";

    const balanceAdvice =
      balanceTone === "good"
        ? "Лёгкие зоны занимают основную часть нагрузки — это хороший фундамент для прогресса."
        : balanceTone === "ok"
          ? "Баланс близок к целевому. Добавь немного больше спокойного бега в Z1–Z2."
          : "Интенсивной работы многовато. Чтобы прогрессировать и не перегореть, чаще держи лёгкий темп в Z1–Z2.";

    return {
      rows,
      easyPct,
      hardPct,
      hasData: totalSeconds > 0,
      workoutsWithDetailedHr,
      balanceLabel,
      balanceTone,
      balanceAdvice,
    };
  }, [zoneRows]);

  const nextWorkoutCard = useMemo(() => plannedWorkoutSummary(nextPlannedWorkout), [nextPlannedWorkout]);
  const goalAccent = primaryGoal ? GOAL_TYPE_ACCENT[primaryGoal.type] ?? GOAL_TYPE_ACCENT.custom : null;
  const goalPct = primaryGoal ? getGoalProgressPct(primaryGoal) : 0;
  const goalMeta = primaryGoal ? GOAL_TYPE_META[primaryGoal.type] ?? GOAL_TYPE_META.custom : null;

  const safeUserName = userName && !userName.includes("@") ? userName.trim() : "";

  // === WELCOME (полностью пустой пользователь) ===
  const isWelcome =
    !loading && !err && kpi.workouts === 0 && !primaryGoal && !nextPlannedWorkout;
  if (isWelcome) {
    return <WelcomeEmptyState userName={safeUserName || null} />;
  }

  return (
    <section className="space-y-5">
      {/* HEADER */}
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {safeUserName ? `Привет, ${safeUserName}` : "Привет!"}
          </h1>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full border bg-muted/10 p-0.5">
            {PERIOD_OPTIONS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={days === n ? "secondary" : "ghost"}
                onClick={() => setDays(n)}
                disabled={loading}
                className="h-7 rounded-full px-3 text-xs hover:bg-muted/40"
              >
                {n} дн.
              </Button>
            ))}
          </div>

          <Link href="/workouts" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
            >
              Тренировки <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {err ? (
        <Card className="border-destructive/30">
          <CardContent className="py-3">
            <div className="text-sm font-semibold text-destructive">Ошибка загрузки: {err}</div>
          </CardContent>
        </Card>
      ) : null}

      {/* HERO ROW: форма + цитата тренера */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <FormHeroCard
          score={form.score}
          label={form.label}
          accent={formAccent}
          kpi={kpi}
          trend={trend}
          activeDays={activeDays}
          totalDays={days}
        />
        <CoachQuoteCard quote={coachQuote} />
      </div>

      {/* ROW: next workout + primary goal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NextWorkoutCard data={nextWorkoutCard} />
        <PrimaryGoalCard goal={primaryGoal} meta={goalMeta} accent={goalAccent} pct={goalPct} />
      </div>

      <GoalForecastCard forecast={goalForecast} />

      {/* CHART: weekly volume */}
      <WeeklyVolumeCard data={weeklyChartData} weeklyAvg={weeklyAvg} />

      {/* ROW: HR zones + sport mix */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HrZonesCard hrZones={hrZones} />
        <SportMixCard mix={mix} />
      </div>

      {/* ROW: daily time + daily kcal */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DailyTimeCard daysData={daysData} />
        <DailyKcalCard daysData={daysData} />
      </div>

      {/* CHART: weekday distribution */}
      <WeekdayDistributionCard wd={wd} />
    </section>
  );
}

// ============================================================
// FORM HERO
// ============================================================
function FormHeroCard({
  score, label, accent, kpi, trend, activeDays, totalDays,
}: {
  score: number;
  label: string;
  accent: { progress: string; track: string };
  kpi: { workouts: number; time_sec: number; distance_m: number; kcal: number };
  trend: Trend | null;
  activeDays: number;
  totalDays: number;
}) {
  const heroBg = `
    radial-gradient(circle at calc(100% + 5rem) -5rem, ${accent.track} 0, transparent 58%),
    radial-gradient(circle at -4rem calc(100% + 4rem), ${accent.track} 0, transparent 55%)
  `;

  return (
    <Card
      className="relative overflow-hidden border bg-card shadow-2xl shadow-[rgba(229,139,33,0.12)]"
      style={{ backgroundImage: heroBg }}
    >

      <CardContent className="relative space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-100/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 backdrop-blur">
            <Sparkles className="size-3.5" />
            Твоя форма
          </span>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
                trend.up
                  ? "bg-[rgba(197,237,208,0.7)] text-[rgb(26,158,58)]"
                  : "bg-[rgba(255,232,232,0.7)] text-[rgb(220,38,38)]",
              )}
            >
              {trend.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {Math.abs(trend.pct)}% к началу периода
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <RadialProgress
              value={score}
              size={170}
              strokeWidth={14}
              trackColor={accent.track}
              progressColor={accent.progress}
            />
            <div className="absolute inset-x-0 bottom-2 text-center">
              <div className="flex items-baseline justify-center gap-0.5 tabular-nums">
                <span className="text-4xl font-extrabold leading-none">{score || "—"}</span>
                <span className="text-base font-bold text-muted-foreground">/100</span>
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Форма
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5 sm:pt-2">
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl capitalize">
              {label}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {score >= 80
                ? "Уверенный объём за последние недели — можешь смело держать ритм и добавлять качество."
                : score >= 65
                ? "Стабильная нагрузка. Хорошее время для точечной интенсивной работы."
                : score >= 50
                ? "Тренируешься по-человечески, без перегруза. Можно мягко наращивать."
                : "Сейчас лучше аккуратно вернуться в ритм — без рывков."}
            </p>
            <div className="text-xs text-muted-foreground">
              {activeDays} из {totalDays} дней были активными
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiTile icon={<TrendingUp className="size-4" />} label="Тренировок" value={formatNumberRu(kpi.workouts)} accent={C.indigo} bg={C.indigoSoft} />
          <KpiTile icon={<Footprints className="size-4" />} label="Дистанция" value={`${formatNumberRu(Math.round(kpi.distance_m / 1000))} км`} accent={C.violet} bg={C.violetSoft} />
          <KpiTile icon={<Activity className="size-4" />} label="Время" value={fmtTime(kpi.time_sec)} accent={C.green} bg={C.greenSoft} />
          <KpiTile icon={<Flame className="size-4" />} label="Калории" value={`${formatNumberRu(Math.round(kpi.kcal))} ккал`} accent={C.orange} bg={C.orangeSoft} />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTile({
  icon, label, value, accent, bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: string;
  bg: string;
}) {
  return (
    <div className="rounded-2xl border bg-white/65 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="inline-flex size-6 items-center justify-center rounded-full" style={{ background: bg, color: accent }}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-base font-extrabold tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}

// ============================================================
// COACH QUOTE
// ============================================================
function CoachQuoteCard({ quote }: { quote: CoachQuoteRow | null }) {
  const message = quote?.body ?? quote?.body_preview ?? "";

  return (
    <Card className="relative flex flex-col overflow-hidden border bg-gradient-to-br from-[rgba(212,219,253,0.55)] via-card to-[rgba(197,237,208,0.35)] shadow-sm">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white">
            <Image src={logo} alt="Капи" width={36} height={36} className="rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Капи</div>
            <div className="text-[11px] text-muted-foreground">Тренер</div>
          </div>
        </div>

        {message ? (
          <div className="relative flex-1 rounded-2xl border bg-white/70 p-4 backdrop-blur-sm">
            <Quote className="pointer-events-none absolute left-3 top-3 z-10 size-5 rotate-180 fill-[rgba(27,46,201,0.22)] text-[rgba(27,46,201,0.22)]" />
            <div className="max-h-[210px] overflow-y-auto p-4 pl-9 pr-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-2 text-base font-extrabold leading-snug">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-3 text-sm font-extrabold leading-snug first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1.5 mt-3 text-sm font-bold leading-snug first:mt-0">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="my-0 text-sm leading-relaxed text-foreground [&:not(:last-child)]:mb-2">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-2 ml-4 list-disc space-y-1 text-sm leading-relaxed">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 ml-4 list-decimal space-y-1 text-sm leading-relaxed">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="pl-1">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-bold">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                  hr: () => <hr className="my-3 border-border/70" />,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 rounded-2xl border border-dashed bg-white/40 p-4">
            <p className="text-sm text-muted-foreground">
              Капи скоро напишет совет дня. А пока — посмотри статистику ниже.
            </p>
          </div>
        )}

        <Link href="/coach">
          <Button variant="secondary" size="sm" className="w-full">
            <MessageCircle className="mr-1.5 size-4" />
            Открыть чат с тренером
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// NEXT WORKOUT
// ============================================================
function NextWorkoutCard({ data }: { data: PlannedWorkoutSummary | null }) {
  return (
    <Card className="relative flex flex-col overflow-hidden border shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[rgba(197,206,250,0.55)] blur-3xl"
      />

      <CardContent className="relative flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.55)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[rgb(27,46,201)]">
            <CalendarClock className="size-3" />
            Следующая тренировка
          </span>

          {data ? (
            <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {data.dateLabel}
            </span>
          ) : null}
        </div>

        {data ? (
          <>
            <div className="rounded-3xl border bg-white/70 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
                  style={{
                    background: data.sport ? `${sportColor(data.sport)}1A` : C.indigoLight,
                    border: `1px solid ${data.sport ? `${sportColor(data.sport)}40` : "rgba(27,46,201,0.18)"}`,
                  }}
                >
                  {sportEmoji(data.sport)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {humanSport(data.sport)}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug">
                    {data.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] font-medium text-muted-foreground">
                    {data.meta}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1" />

            <Link href="/plan">
              <Button variant="primary" size="sm" className="w-full">
                Открыть в календаре <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/15 px-5 py-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                <CalendarClock className="size-8 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold">Тренировка не запланирована</div>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Добавим тренировку в календарь или попросим Капи собрать неделю.
                </p>
              </div>
            </div>

            <Link href="/plan">
              <Button variant="primary" size="sm" className="w-full">
                <Plus className="mr-1 size-4" /> Запланировать
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// PRIMARY GOAL
// ============================================================
function PrimaryGoalCard({
  goal, meta, accent, pct,
}: {
  goal: GoalRow | null;
  meta: { emoji: string; label: string } | null;
  accent: { progress: string; track: string } | null;
  pct: number;
}) {
  return (
    <Card className="flex flex-col border shadow-sm">
      <CardContent className="flex flex-1 flex-col gap-3.5 p-5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-100/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <Trophy className="size-3" />
          Главная цель
        </span>

        {goal && meta && accent ? (
          <>
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
                  style={{
                    background: accent.track,
                    border: `1px solid color-mix(in srgb, ${accent.progress} 20%, transparent)`,
                  }}
                >
                  {meta.emoji}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="line-clamp-2 text-base font-bold leading-snug">
                    {goal.title || meta.label}
                  </h3>
                  <p className="text-[11px] font-medium text-muted-foreground">{meta.label}</p>
                  <div className="text-[11px] text-muted-foreground">
                    Финиш {formatDateShortRu(goal.date_to)} ·{" "}
                    <span className="font-semibold text-foreground">{daysLeftLabel(goal.date_to)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-muted-foreground">Прогресс</span>
                  <span className="font-extrabold tabular-nums">{pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: accent.track }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: accent.progress }}
                  />
                </div>
              </div>
            </div>
            <Link href="/goals">
              <Button variant="secondary" size="sm" className="w-full">
                Все цели <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/40">
                <Target className="size-7 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold">Цель ещё не поставлена</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Поставь цель — план и календарь будут под неё подстраиваться
                </p>
              </div>
            </div>
            <Link href="/goals">
              <Button variant="primary" size="sm" className="w-full">
                <Plus className="mr-1 size-4" /> Поставить цель
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoalForecastCard({ forecast }: { forecast: GoalForecast }) {
  if (!forecast) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.55)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[rgb(27,46,201)]">
            <Target className="size-3" />
            Прогноз цели
          </span>
          <EmptyChartState text="Поставь цель — и мы покажем прогноз движения к ней" emoji="🔮" />
        </CardContent>
      </Card>
    );
  }

  const isGoalFinished = forecast.days_left <= 0;

  if (isGoalFinished) {
    return (
      <Card className="relative overflow-hidden border-amber-200">
        {/* confetti background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 12% 18%, rgba(255,205,86,0.30) 0 10px, transparent 11px),
              radial-gradient(circle at 84% 20%, rgba(244,63,94,0.22) 0 8px, transparent 9px),
              radial-gradient(circle at 22% 78%, rgba(27,46,201,0.20) 0 9px, transparent 10px),
              radial-gradient(circle at 70% 72%, rgba(26,158,58,0.22) 0 10px, transparent 11px),
              radial-gradient(circle at 92% 58%, rgba(229,139,33,0.22) 0 7px, transparent 8px),
              linear-gradient(
                135deg,
                rgba(255,248,214,0.95) 0%,
                rgba(255,255,255,0.98) 35%,
                rgba(240,247,255,0.96) 68%,
                rgba(240,255,244,0.96) 100%
              )
            `,
          }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-0 size-40 rounded-full bg-[rgba(255,205,86,0.22)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-10 size-44 rounded-full bg-[rgba(244,63,94,0.16)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/3 size-52 rounded-full bg-[rgba(27,46,201,0.12)] blur-3xl"
        />

        <CardContent className="relative grid grid-cols-1 items-center gap-6 p-5 sm:p-6 md:grid-cols-[190px_1fr]">
          <div className="mx-auto flex size-[170px] flex-col items-center justify-center rounded-full border border-amber-200 bg-white/70 text-center shadow-sm">
            <Trophy className="size-10 text-amber-700" />
            <div className="mt-2 text-2xl font-extrabold text-amber-800">Финиш</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              цель завершена
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-100/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                <Target className="size-3" />
                Прогноз цели
              </span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                финиш сегодня
              </span>
            </div>

            <h3 className="line-clamp-2 text-base font-bold leading-snug sm:text-lg">
              {forecast.title}
            </h3>

            <div className="rounded-2xl border border-amber-200 bg-white/70 p-3">
              <div className="text-sm font-extrabold text-amber-900">
                Цель подошла к финишу
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Прогноз больше не нужен: сейчас лучше зафиксировать результат, восстановиться
                и поставить следующую цель.
              </p>
            </div>

            <Link href="/goals">
              <Button variant="primary" size="sm" className="w-full sm:w-fit">
                Посмотреть цель <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    on_track: {
      color: "rgb(26,158,58)",
      trackColor: "rgba(26,158,58,0.14)",
      bgClass: "border-emerald-200 bg-emerald-50 text-emerald-950",
      label: "Успеваем к цели",
      hint: "Текущий ритм соответствует цели. Продолжай в том же темпе.",
    },
    watch: {
      color: "rgb(229,139,33)",
      trackColor: "rgba(229,139,33,0.14)",
      bgClass: "border-amber-200 bg-amber-50 text-amber-950",
      label: "Нужно чуть добавить",
      hint: "Объёма не хватает — добери лёгкими пробежками без интенсивности.",
    },
    behind: {
      color: "rgb(244,63,94)",
      trackColor: "rgba(244,63,94,0.14)",
      bgClass: "border-rose-200 bg-rose-50 text-rose-950",
      label: "Есть риск не успеть",
      hint: "Текущего темпа мало для цели. Стоит пересобрать план с тренером.",
    },
    unknown: {
      color: "rgb(120,120,140)",
      trackColor: "rgba(120,120,140,0.10)",
      bgClass: "border-border bg-muted/20 text-muted-foreground",
      label: "Недостаточно данных",
      hint: "Для прогноза нужны дата финиша и дистанция/тип цели.",
    },
  } as const;

  const cfg = statusConfig[forecast.status];
  const recommendedPct = forecast.pct_of_recommended;
  const radialValue =
    recommendedPct != null ? Math.min(100, Math.max(0, recommendedPct)) : 0;
  const showRadial = forecast.status !== "unknown" && recommendedPct != null;

  const heroBg = `
    radial-gradient(circle at calc(100% + 5rem) -5rem, ${cfg.trackColor} 0, transparent 58%),
    radial-gradient(circle at -4rem calc(100% + 4rem), ${cfg.trackColor} 0, transparent 55%)
  `;

  return (
    <Card
      className="relative overflow-hidden"
      style={{ backgroundImage: heroBg }}
    >
      <CardContent className="relative grid grid-cols-1 items-center gap-6 p-5 sm:p-6 md:grid-cols-[190px_1fr]">
        {/* LEFT: радиальный gauge */}
        {showRadial ? (
          <div className="relative mx-auto shrink-0">
            <RadialProgress
              value={radialValue}
              size={170}
              strokeWidth={14}
              trackColor={cfg.trackColor}
              progressColor={cfg.color}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
              <div className="flex items-baseline justify-center gap-0.5 tabular-nums">
                <span
                  className="text-4xl font-extrabold leading-none"
                  style={{ color: cfg.color }}
                >
                  {recommendedPct}
                </span>
                <span
                  className="text-base font-bold leading-none"
                  style={{ color: cfg.color }}
                >
                  %
                </span>
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                от нужного объёма
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[200px] flex-col items-center justify-center rounded-full border border-dashed bg-muted/20 p-5 text-center">
            <Target className="size-8 text-muted-foreground" />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Для прогноза нужны дата финиша и дистанция/тип цели
            </p>
          </div>
        )}

        {/* RIGHT: контент */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.55)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[rgb(27,46,201)]">
              <Target className="size-3" />
              Прогноз цели
            </span>
            <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {forecast.days_left > 0
                ? `${forecast.days_left} дн. до цели`
                : "финиш сегодня"}
            </span>
          </div>

          <h3 className="line-clamp-2 text-base font-bold leading-snug sm:text-lg">
            {forecast.title}
          </h3>

          <div className={cn("rounded-2xl border p-3", cfg.bgClass)}>
            <div className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: cfg.color }}
              />
              <span className="text-sm font-extrabold">{cfg.label}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-85">{cfg.hint}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ForecastMetricTile
              icon={<TrendingUp className="size-4" />}
              label="Текущий темп"
              value={`${forecast.current_weekly_km}`}
              unit="км/нед"
              hint="средн. за 28 дн."
              accent={cfg.color}
              bg={cfg.trackColor}
            />
            <ForecastMetricTile
              icon={<Target className="size-4" />}
              label="Нужно для цели"
              value={
                forecast.recommended_weekly_km != null
                  ? `${forecast.recommended_weekly_km}`
                  : "—"
              }
              unit="км/нед"
              accent={C.indigo}
              bg={C.indigoSoft}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastMetricTile({
  icon,
  label,
  value,
  unit,
  accent,
  bg,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  accent: string;
  bg: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white/65 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span
          className="inline-flex size-6 items-center justify-center rounded-full"
          style={{ background: bg, color: accent }}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
        <span
          className="text-base font-extrabold sm:text-lg"
          style={{ color: accent }}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[9px] font-medium leading-tight text-muted-foreground/80">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// WEEKLY VOLUME
// ============================================================
function WeeklyVolumeCard({
  data, weeklyAvg,
}: {
  data: WeeklyChartPoint[];
  weeklyAvg: { time_sec: number; distance_m: number; workouts: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Объём по неделям</CardTitle>
        <CardDescription>
          {data.length
            ? `12 недель · в среднем ${formatNumberRu(Math.round(weeklyAvg.distance_m / 1000))} км в неделю`
            : "Сколько километров ты набегал за последние 12 недель"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="weeklyBarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={1} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="w" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => `${v} км`} />}
                  cursor={{ fill: "rgba(27,46,201,0.06)" }}
                />
                <Bar dataKey="distance_km" name="Километры" radius={[6, 6, 0, 0]} fill="url(#weeklyBarFill)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState text="Данных по неделям пока нет" emoji="📊" />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// HR ZONES
// ============================================================
function HrZonesCard({ hrZones }: { hrZones: HrZonesData }) {
  const toneClass =
    hrZones.balanceTone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : hrZones.balanceTone === "ok"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Пульсовые зоны</CardTitle>
        <CardDescription>
          {hrZones.hasData
            ? `лёгкая ${fmtPercent(hrZones.easyPct)} · интенсивная ${fmtPercent(hrZones.hardPct)}`
            : "Распределение времени по зонам Z1–Z5"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hrZones.hasData ? (
          <div className="space-y-3">
            <div className={cn("rounded-2xl border p-3", toneClass)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold">{hrZones.balanceLabel}</div>
                <div className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold tabular-nums">
                  Z1–Z2: {fmtPercent(hrZones.easyPct)} / Z3–Z5: {fmtPercent(hrZones.hardPct)}
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed opacity-85">
                {hrZones.balanceAdvice}
              </p>
            </div>

            <div className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hrZones.rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tickLine={false} axisLine={false} tickMargin={8}
                    tick={{ fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={<ChartTooltip formatter={(v) => `${v} мин`} />}
                    cursor={{ fill: "rgba(27,46,201,0.06)" }}
                  />
                  <Bar dataKey="minutes" name="Время" radius={[6, 6, 0, 0]}>
                    {hrZones.rows.map((row) => (
                      <Cell key={row.zone} fill={HR_ZONE_COLORS[row.zone] ?? C.indigo} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Зоны рассчитаны по {hrZones.workoutsWithDetailedHr} тренировкам с детальным пульсом.
            </div>
          </div>
        ) : (
          <EmptyChartState
            text="Тренировки без пульса. Подключи устройство — и увидишь баланс зон."
            emoji="🫀"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// SPORT MIX
// ============================================================
function SportMixCard({ mix }: { mix: MixRow[] }) {
  const chartData = mix.map((m) => ({
    sport: m.sport,
    name: humanSport(m.sport),
    value: Math.max(0, Number(m.time_sec || 0)),
    color: sportColor(m.sport),
  }));

  const totalSec = chartData.reduce((s, x) => s + x.value, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Структура тренировок</CardTitle>
        <CardDescription>Доля времени по видам спорта</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-[420px] flex-1 flex-col">
        {mix.length ? (
          <div className="flex flex-1 flex-col gap-4">
            <div className="relative min-h-[260px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="82%"
                    paddingAngle={2}
                    strokeWidth={3}
                    stroke="#ffffff"
                  >
                    {chartData.map((m) => (
                      <Cell key={m.sport} fill={m.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtTime(v)} />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-extrabold tabular-nums">
                    {fmtHoursOnly(totalSec)}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    всего
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {chartData.map((m) => {
                const pct = totalSec > 0 ? Math.round((m.value / totalSec) * 100) : 0;

                return (
                  <div
                    key={m.sport}
                    className="flex min-w-0 items-center gap-2 rounded-xl border bg-background/70 px-2.5 py-2"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: m.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {pct}% · {fmtTime(m.value)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyChartState text="Пока нет данных по видам спорта" emoji="🥧" />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// DAILY TIME
// ============================================================
function DailyTimeCard({ daysData }: { daysData: DayRow[] }) {
  const data = daysData.map((d) => ({
    d: formatShortRuDate(d.d),
    time_h: Math.round((Number(d.time_sec || 0) / 3600) * 100) / 100,
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Время по дням</CardTitle>
        <CardDescription>Часы тренировок в каждый день периода</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dailyFillIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => `${v} ч`} />}
                  cursor={{ stroke: C.indigo, strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="time_h"
                  name="Время"
                  stroke={C.indigo}
                  strokeWidth={2.5}
                  fill="url(#dailyFillIndigo)"
                  activeDot={{ r: 4, fill: C.indigo }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState text="Пока нет тренировок в этом периоде" emoji="📈" />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// DAILY KCAL
// ============================================================
function DailyKcalCard({ daysData }: { daysData: DayRow[] }) {
  const data = daysData.map((d) => ({
    d: formatShortRuDate(d.d),
    kcal: Math.round(Number(d.kcal || 0)),
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Калории</CardTitle>
        <CardDescription>Энергозатраты по дням</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="kcalFillOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.orange} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={C.orange} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={<ChartTooltip formatter={(v) => `${v} ккал`} />}
                  cursor={{ stroke: C.orange, strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="kcal"
                  name="Калории"
                  stroke={C.orange}
                  strokeWidth={2.5}
                  fill="url(#kcalFillOrange)"
                  activeDot={{ r: 4, fill: C.orange }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState text="Пока нет данных по калориям" emoji="🔥" />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// WEEKDAY DISTRIBUTION
// ============================================================
function WeekdayDistributionCard({ wd }: { wd: WdRow[] }) {
  const data = wd.map((x) => ({
    d: DOW_RU[(x.dow - 1 + 7) % 7],
    hours: +(Number(x.time_sec || 0) / 3600).toFixed(2),
    workouts: Number(x.workouts || 0),
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">По дням недели</CardTitle>
        <CardDescription>Когда ты тренируешься чаще всего</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="d"
                  tickLine={false} axisLine={false} tickMargin={8}
                  tick={{ fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v, name) =>
                        name === "Часы" ? `${v} ч` : `${v} трен.`
                      }
                    />
                  }
                  cursor={{ fill: "rgba(27,46,201,0.06)" }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="hours" name="Часы" radius={[6, 6, 0, 0]} fill={C.indigo} />
                <Bar yAxisId="right" dataKey="workouts" name="Трен." radius={[6, 6, 0, 0]} fill={C.violet} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState text="Пока недостаточно тренировок" emoji="📅" />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// EMPTY CHART STATE
// ============================================================
function EmptyChartState({ text, emoji }: { text: string; emoji: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <div className="text-3xl">{emoji}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ============================================================
// WELCOME EMPTY STATE
// ============================================================
function WelcomeEmptyState({ userName }: { userName?: string | null }) {
  return (
    <section className="space-y-5">
      <div className="relative mx-auto max-w-2xl space-y-6 text-center">
        <div className="mx-auto inline-flex size-24 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-white/60">
          <Image src={logo} alt="Капи" width={80} height={80} className="rounded-full" />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-100/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <Sparkles className="size-3.5" />
          Привет от Капи
        </span>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Готов жечь{userName ? `, ${userName}` : ""}?
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground">
            Чтобы дашборд ожил данными — добавь первую тренировку, поставь цель или подключи Strava. Дальше я
            подсчитаю форму, недельный объём, баланс зон и буду подсказывать, что делать.
          </p>
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <WelcomeActionCard
            href="/integrations"
            emoji="⚡"
            title="Подключить Strava"
            description="Тренировки подтянутся автоматически"
            accent={C.orange}
            bg={C.orangeSoft}
          />
          <WelcomeActionCard
            href="/workouts"
            emoji="🏃"
            title="Добавить тренировку"
            description="Вручную или из файла"
            accent={C.indigo}
            bg={C.indigoSoft}
          />
          <WelcomeActionCard
            href="/goals"
            emoji="🎯"
            title="Поставить цель"
            description="План адаптируется под неё"
            accent={C.green}
            bg={C.greenSoft}
          />
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[rgb(229,139,33)]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Что появится здесь
            </h2>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <PreviewBullet emoji="📊" title="Форма" text="Оценка 0–100 по объёму и нагрузке" />
            <PreviewBullet emoji="🎯" title="Главная цель" text="Прогресс с полукруглым графиком" />
            <PreviewBullet emoji="🫀" title="Пульсовые зоны" text="Баланс 80/20" />
            <PreviewBullet emoji="📅" title="Календарь" text="Следующая тренировка и план" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function WelcomeActionCard({
  href,
  emoji,
  title,
  description,
  accent,
  bg,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  accent: string;
  bg: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <div className="group relative h-full overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md">
        <div
          className="flex size-12 items-center justify-center rounded-xl text-2xl shadow-sm transition-transform group-hover:scale-110"
          style={{
            background: bg,
            border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
          }}
        >
          {emoji}
        </div>
        <h3 className="mt-3 text-sm font-bold leading-snug">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <ArrowRight className="absolute right-3 top-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function PreviewBullet({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-xl">{emoji}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}