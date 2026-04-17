"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Flame,
  Footprints,
  HeartPulse,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseBrowser";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { sportColor } from "@/components/ui/sport-theme";

/* ─── types ─────────────────────────────────────────────────── */
type DayRow  = { d: string; workouts: number; time_sec: number; distance_m: number; kcal: number };
type WeekRow = { week_start: string; workouts: number; time_sec: number; distance_m: number };
type WdRow   = { dow: number; workouts: number; time_sec: number };
type MixRow  = { sport: string; workouts: number; time_sec: number };
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

/* ─── constants ──────────────────────────────────────────────── */
const DOW_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const DOW_RU_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;
const PERIOD_STORAGE_KEY = "capyrun.dashboard.periodDays";
const PERIOD_OPTIONS = [7, 30, 90, 365] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

/* ─── analytics palette (colors.ts) ─────────────────────────── */
const C = {
  blue:         "#1B2EC9",
  blueLight:    "#C5CEFA",
  purple:       "#59229F",
  purpleLight:  "#D1C1E4",
  green:        "#1A9E3A",
  greenLight:   "#C5EDD0",
  red:          "#E60012",
  redLight:     "#FFCCCC",
  yellow:       "#FFD600",
  yellowLight:  "#FFF5B0",
  teal:         "#3AAAEF",
  tealLight:    "#C5E8FF",
  navy:         "#283158",
  navyLight:    "#D7DCE8",
} as const;

// ordered data colours for pie slices
const PIE_COLORS = [C.blue, C.purple, C.green, C.yellow, C.teal, C.navy];
const WEEKDAY_ANALYTICS_COLORS = [
  { solid: C.blue,   light: C.blueLight },
  { solid: C.purple, light: C.purpleLight },
  { solid: C.green,  light: C.greenLight },
  { solid: C.red,    light: C.redLight },
  { solid: C.yellow, light: C.yellowLight },
  { solid: C.teal,   light: C.tealLight },
  { solid: C.navy,   light: C.navyLight },
] as const;
const HR_ZONE_COLORS: Record<string, string> = {
  Z1: C.purple,
  Z2: C.teal,
  Z3: C.green,
  Z4: C.yellow,
  Z5: C.red,
};

/* ─── helpers ────────────────────────────────────────────────── */
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function fmtTime(sec: number) {
  const s = Number(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtKm(meters: number) {
  const km = Number(meters || 0) / 1000;
  const d = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(d).replace(".", ",")} км`;
}
function fmtKcal(k: number) {                                                                 
  return `${Math.round(Number(k || 0))} ккал`;
}
function prettySport(s: string) {
  const map: Record<string, string> = {
    run: "Бег", ride: "Вело", swim: "Плавание", walk: "Ходьба",
    hike: "Хайк", row: "Гребля", strength: "Силовая", yoga: "Йога",
    aerobics: "Аэробика", crossfit: "Кроссфит", pilates: "Пилатес", other: "Другая",
  };
  return map[s] ?? s;
}
function dateDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function formatZoneLabel(raw: string) {
  const key = String(raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    z1: "Z1",
    z2: "Z2",
    z3: "Z3",
    z4: "Z4",
    z5: "Z5",
    zone1: "Z1",
    zone2: "Z2",
    zone3: "Z3",
    zone4: "Z4",
    zone5: "Z5",
  };
  return map[key] ?? String(raw || "").toUpperCase();
}
function zoneOrder(label: string) {
  const m = /^Z(\d+)$/.exec(label);
  return m ? Number(m[1]) : 999;
}
function fmtPercent(v: number) {
  return `${Math.round(v)}%`;
}
function formatDateShortRu(isoDate?: string | null) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}
function plannedWorkoutSummary(workout: NextPlannedWorkoutRow | null) {
  if (!workout) return null;

  const parts: string[] = [];
  if (workout.sport) parts.push(prettySport(workout.sport));
  if (workout.structure?.duration_min) parts.push(`${Math.round(Number(workout.structure.duration_min))} мин`);
  if (workout.structure?.distance_km) parts.push(`${Number(workout.structure.distance_km).toFixed(1)} км`);
  if (workout.structure?.effort) parts.push(String(workout.structure.effort));

  return {
    title: workout.title || workout.structure?.goal || "Тренировка по плану",
    meta: parts.join(" · ") || "Плановая тренировка",
    dateLabel: formatDateShortRu(workout.planned_date),
  };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MyWorkoutsDashboardClient({ daysDefault = 30 }: { daysDefault?: number }) {
  const [days, setDays]       = useState<PeriodOption>(daysDefault as PeriodOption);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);

  // restore saved period (client-only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if ((PERIOD_OPTIONS as readonly number[]).includes(parsed))
        setDays(parsed as PeriodOption);
    } catch { /* ignore */ }
  }, []);

  // persist period
  useEffect(() => {
    try { window.localStorage.setItem(PERIOD_STORAGE_KEY, String(days)); } catch { /* ignore */ }
  }, [days]);

  /* ── data state ── */
  const [daysData, setDaysData] = useState<DayRow[]>([]);
  const [weeks,    setWeeks]    = useState<WeekRow[]>([]);
  const [wd,       setWd]       = useState<WdRow[]>([]);
  const [mix,      setMix]      = useState<MixRow[]>([]);
  const [zoneRows, setZoneRows] = useState<WorkoutZoneRow[]>([]);
  const [nextPlannedWorkout, setNextPlannedWorkout] = useState<NextPlannedWorkoutRow | null>(null);
  const [weeklyHoverIndex, setWeeklyHoverIndex] = useState<number | null>(null);

  /* ── fetch ── */
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const fromISO = dateDaysAgo(days);
        const [a, b, c, d, e, f] = await Promise.all([
          supabase.rpc("dash_fast_days",         { days }),
          supabase.rpc("dash_fast_weeks",        { weeks: 12 }),
          supabase.rpc("dash_fast_weekday",      { days }),
          supabase.rpc("dash_fast_sport_mix",    { days }),
          supabase
            .from("workouts")
            .select("local_date, hr_zone_time")
            .gte("local_date", fromISO),
          supabase
            .from("user_plan_sessions")
            .select("id, planned_date, title, sport, status, structure")
            .gte("planned_date", todayISO())
            .in("status", ["planned", "moved"])
            .order("planned_date", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);
        if (canceled) return;
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        if (c.error) throw c.error;
        if (d.error) throw d.error;
        if ("error" in e && e.error) throw e.error;
        if ("error" in f && f.error) throw f.error;
        setDaysData((a.data ?? []) as DayRow[]);
        setWeeks(   (b.data ?? []) as WeekRow[]);
        setWd(      (c.data ?? []) as WdRow[]);
        setMix(     (d.data ?? []) as MixRow[]);
        setZoneRows((e.data ?? []) as WorkoutZoneRow[]);
        setNextPlannedWorkout((f.data ?? null) as NextPlannedWorkoutRow | null);
      } catch (e: any) {
        if (!canceled) setErr(e?.message ?? String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [days]);

  /* ─── derived: KPI totals ─── */
  const kpi = useMemo(() => ({
    workouts:   daysData.reduce((s, x) => s + (isNum(x.workouts)   ? x.workouts   : 0), 0),
    time_sec:   daysData.reduce((s, x) => s + (isNum(x.time_sec)   ? x.time_sec   : 0), 0),
    distance_m: daysData.reduce((s, x) => s + Number(x.distance_m || 0), 0),
    kcal:       daysData.reduce((s, x) => s + Number(x.kcal        || 0), 0),
  }), [daysData]);

  /* ─── derived: period trend (second half vs first half) ─── */
  const trend = useMemo(() => {
    if (daysData.length < 6) return null;
    const sorted = [...daysData].sort((a, b) => a.d.localeCompare(b.d));
    const half   = Math.floor(sorted.length / 2);
    const distA  = sorted.slice(0, half).reduce((s, x) => s + Number(x.distance_m || 0), 0);
    const distB  = sorted.slice(half   ).reduce((s, x) => s + Number(x.distance_m || 0), 0);
    if (distA <= 0) return null;
    const pct = Math.round(((distB - distA) / distA) * 100);
    return { pct, up: pct >= 0 };
  }, [daysData]);

  /* ─── derived: form score ─── */
  const form = useMemo(() => {
    if (!daysData.length) return { score: 0, label: "нет данных", tone: "muted" as const };
    const sorted = [...daysData].sort((a, b) => a.d.localeCompare(b.d));
    const last7  = sorted.slice(-7);
    const last28 = sorted.slice(-28);
    const km7    = last7.reduce( (s, x) => s + Number(x.distance_m || 0), 0) / 1000;
    const km28   = last28.reduce((s, x) => s + Number(x.distance_m || 0), 0) / 1000;
    const exp7   = last28.length >= 14 ? (km28 / Math.max(1, last28.length)) * 7 : km7;
    if (exp7 <= 0.2) return { score: 35, label: "строим базу", tone: "muted" as const };
    const ratio = km7 / Math.max(0.01, exp7);
    const score = Math.max(0, Math.min(100, Math.round(55 + (ratio - 1) * 28)));
    const tone  = score >= 80 ? "good" as const : score >= 65 ? "ok" as const : score >= 50 ? "warn" as const : "muted" as const;
    const label = score >= 80 ? "готов жечь" : score >= 65 ? "хорошая форма" : score >= 50 ? "нормально" : "бережно";
    return { score, label, tone };
  }, [daysData]);

  /* ─── derived: averages & insights ─── */
  const avgPerWorkout = useMemo(() => {
    const w = Math.max(1, kpi.workouts);
    return {
      distance_m: kpi.workouts > 0 ? kpi.distance_m / w : 0,
      time_sec:   kpi.workouts > 0 ? kpi.time_sec   / w : 0,
    };
  }, [kpi]);

  const weeklyAvg = useMemo(() => {
    const valid = weeks.filter((w) => Number(w.time_sec || 0) > 0 || Number(w.distance_m || 0) > 0);
    if (!valid.length) return { time_sec: 0, distance_m: 0, workouts: 0 };
    return {
      time_sec:   valid.reduce((s, w) => s + Number(w.time_sec   || 0), 0) / valid.length,
      distance_m: valid.reduce((s, w) => s + Number(w.distance_m || 0), 0) / valid.length,
      workouts:   valid.reduce((s, w) => s + Number(w.workouts   || 0), 0) / valid.length,
    };
  }, [weeks]);

  const weeklyChartData = useMemo(() => {
    return weeks.map((w) => ({
      w: w.week_start,
      hours: +(Number(w.time_sec || 0) / 3600).toFixed(2),
      workouts: Number(w.workouts || 0),
      distance_km: +(Number(w.distance_m || 0) / 1000).toFixed(1),
    }));
  }, [weeks]);

  const activeWeeklyPoint = useMemo(() => {
    if (!weeklyChartData.length) return null;
    if (weeklyHoverIndex != null && weeklyChartData[weeklyHoverIndex]) {
      return weeklyChartData[weeklyHoverIndex];
    }
    return weeklyChartData[weeklyChartData.length - 1] ?? null;
  }, [weeklyChartData, weeklyHoverIndex]);

  const activeDays = useMemo(
    () => daysData.filter((d) => Number(d.workouts || 0) > 0).length,
    [daysData],
  );

  const topWeekday = useMemo(() => {
    if (!wd.length) return null;
    const top = [...wd].sort((a, b) => {
      const diff = Number(b.time_sec || 0) - Number(a.time_sec || 0);
      return diff !== 0 ? diff : Number(b.workouts || 0) - Number(a.workouts || 0);
    })[0];
    return top
      ? { label: DOW_RU_FULL[(top.dow - 1 + 7) % 7], workouts: Number(top.workouts || 0) }
      : null;
  }, [wd]);

  const topSport = useMemo(() => {
    if (!mix.length) return null;
    const total = mix.reduce((s, x) => s + Number(x.time_sec || 0), 0);
    const top   = [...mix].sort((a, b) => Number(b.time_sec || 0) - Number(a.time_sec || 0))[0];
    return top
      ? {
          label: prettySport(top.sport),
          share: total > 0 ? Math.round((Number(top.time_sec || 0) / total) * 100) : 0,
        }
      : null;
  }, [mix]);

  const hrZones = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of zoneRows) {
      const hr = row.hr_zone_time;
      if (!hr || typeof hr !== "object") continue;

      for (const [rawKey, rawValue] of Object.entries(hr)) {
        const seconds = Number(rawValue || 0);
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        const label = formatZoneLabel(rawKey);
        totals.set(label, (totals.get(label) ?? 0) + seconds);
      }
    }

    const rows = Array.from(totals.entries())
      .map(([zone, seconds]) => ({
        zone,
        seconds,
        minutes: Math.round(seconds / 60),
      }))
      .sort((a, b) => zoneOrder(a.zone) - zoneOrder(b.zone));

    const easySeconds = rows
      .filter((r) => r.zone === "Z1" || r.zone === "Z2")
      .reduce((sum, r) => sum + r.seconds, 0);
    const hardSeconds = rows
      .filter((r) => !["Z1", "Z2"].includes(r.zone))
      .reduce((sum, r) => sum + r.seconds, 0);
    const totalSeconds = easySeconds + hardSeconds;
    const easyPct = totalSeconds > 0 ? (easySeconds / totalSeconds) * 100 : 0;
    const hardPct = totalSeconds > 0 ? (hardSeconds / totalSeconds) * 100 : 0;

    return {
      rows,
      easySeconds,
      hardSeconds,
      totalSeconds,
      easyPct,
      hardPct,
      hasData: totalSeconds > 0,
    };
  }, [zoneRows]);

  const intensityRecommendation = useMemo(() => {
    if (!hrZones.hasData) {
      return "Пока недостаточно данных по пульсовым зонам, чтобы оценить баланс лёгкой и тяжёлой работы.";
    }
    if (hrZones.easyPct >= 75 && hrZones.hardPct <= 25) {
      return "Баланс близок к 80/20. Хорошая база: лёгкой работы достаточно, тяжёлая нагрузка не доминирует.";
    }
    if (hrZones.easyPct < 75) {
      return "Стоит добавить больше лёгких тренировок. Сейчас доля интенсивной работы выглядит выше желаемой.";
    }
    return "Тяжёлой работы сейчас немного. Это нормально для базы, но при желании можно точечно добавить качественную нагрузку.";
  }, [hrZones]);

  /* ─── derived: text ─── */
  const summaryLines = useMemo(() => {
    if (kpi.workouts === 0) {
      return ["За выбранный период пока нет тренировок"];
    }

    const lines: string[] = [];
    if (topSport) {
      lines.push(`Основной фокус — ${topSport.label.toLowerCase()} (${topSport.share}% объёма)`);
    }
    if (topWeekday) {
      lines.push(`Самый объёмный день недели — ${topWeekday.label}`);
    }
    if (form.score >= 75) {
      lines.push("Форма выглядит уверенно — можно держать хороший объём");
    } else if (form.score >= 55) {
      lines.push("Форма хорошая — главное сейчас не терять ритм");
    } else {
      lines.push("Сейчас лучше мягко наращивать базу без перегруза");
    }

    return lines;
  }, [form.score, kpi.workouts, topSport, topWeekday]);

  const nextWorkoutCard = useMemo(() => plannedWorkoutSummary(nextPlannedWorkout), [nextPlannedWorkout]);

  const weeklyComparison = useMemo(() => {
    const point = activeWeeklyPoint;
    if (!point) {
      return {
        title: "Пока нет недельных данных",
        text: "Когда накопится несколько тренировок, здесь появится ориентир по недельному объёму",
        emoji: "📊",
      };
    }

    const hours = Number(point.hours || 0);

    if (hours < 2) {
      return {
        title: "Лёгкий режим",
        text: "Небольшой объём — отлично для восстановления или мягкого входа в тренировки",
        emoji: "🐢",
      };
    }
    if (hours < 4) {
      return {
        title: "Спокойный ритм",
        text: "Стабильные тренировки для здоровья и формы без перегрузки",
        emoji: "🙂",
      };
    }
    if (hours < 6.5) {
      return {
        title: "Хорошая база",
        text: "Уже системный уровень — так тренируются те, кто строит выносливость",
        emoji: "🏃",
      };
    }
    if (hours < 9) {
      return {
        title: "Сильный объём",
        text: "Похоже на подготовку к серьёзной цели — нагрузка уже заметная",
        emoji: "🐇",
      };
    }

    return {
      title: "Очень высокий объём",
      text: "Такой объём держат дисциплинированные спортсмены — почти соревновательный режим",
      emoji: "🐆",
    };
  }, [activeWeeklyPoint]);

  /* ─── hero gradient & bar color ─── */
  const heroGradient =
    form.tone === "good" ? "bg-gradient-to-br from-emerald-200/70 to-blue-100/60 dark:from-emerald-500/20 dark:to-sky-500/10" :
    form.tone === "ok"   ? "bg-gradient-to-br from-blue-100/70 to-violet-100/70 dark:from-sky-500/15 dark:to-violet-500/10" :
    form.tone === "warn" ? "bg-gradient-to-br from-amber-100/80 to-orange-100/60 dark:from-amber-500/15 dark:to-sky-500/10" :
    "bg-gradient-to-br from-muted/60 to-muted/20";

  const formBarColor =
    form.tone === "good" ? C.green :
    form.tone === "ok"   ? C.blue  :
    form.tone === "warn" ? C.yellow :
    "#595958";

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <section className="space-y-4">

      {/* ── period picker + nav ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">Период</span>
          <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border bg-muted/10 p-0.5">
            {PERIOD_OPTIONS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={days === n ? "secondary" : "ghost"}
                onClick={() => setDays(n)}
                disabled={loading}
                className="h-7 rounded-full px-3 text-sm hover:bg-muted/40"
              >
                {n} дн.
              </Button>
            ))}
          </div>
          {loading && <Badge variant="secondary" className="shrink-0">Обновляем…</Badge>}
          {err      && <Badge variant="destructive" className="shrink-0">Ошибка</Badge>}
        </div>

        <Link href="/workouts">
          <Button variant="secondary" size="sm">Тренировки →</Button>
        </Link>
      </div>

      {err && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Не удалось загрузить дашборд</CardTitle>
            <CardDescription className="text-destructive">{err}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* ── HERO ── */}
      <Card className={cn("relative overflow-hidden", heroGradient)}>
        <CardContent className="relative space-y-4 p-4 sm:p-6">

          {/* score + badges row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Runner HQ</Badge>
                <Badge variant="outline">форма · объём · привычки</Badge>
              </div>
              <div className="text-2xl font-extrabold leading-tight sm:text-3xl">
                Форма:{" "}
                <span className="tabular-nums">{form.score || "—"}</span>/100
                <span className="ml-2 text-base font-semibold text-muted-foreground">
                  {form.label}
                </span>
              </div>
              <div className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-background/70">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(6, form.score || 0)}%`, background: formBarColor }}
                />
              </div>
            </div>

            {/* meta-badges: trend / activity */}
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-1.5">
              {trend && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium backdrop-blur",
                  trend.up
                    ? "bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                )}>
                  {trend.up
                    ? <ArrowUp   className="h-3.5 w-3.5" />
                    : <ArrowDown className="h-3.5 w-3.5" />}
                  {Math.abs(trend.pct)}% к прошлому периоду
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-sm font-medium backdrop-blur">
                📅 {activeDays} из {days} дней активны
              </span>
            </div>
          </div>

          {/* 4 KPI tiles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeroKPI icon={<TrendingUp className="h-4 w-4" />} label="Тренировок" value={kpi.workouts}                 color={C.blue}   fill={C.blueLight} />
            <HeroKPI icon={<Footprints className="h-4 w-4" />} label="Дистанция"  value={fmtKm(kpi.distance_m)}        color={C.purple} fill={C.purpleLight} />
            <HeroKPI icon={<Activity  className="h-4 w-4" />} label="Время"       value={fmtTime(kpi.time_sec)}        color={C.green}  fill={C.greenLight} />
            <HeroKPI
              icon={<Flame className="h-4 w-4" style={{ color: C.red }} />}
              label="Калории"
              value={fmtKcal(kpi.kcal)}
              color={C.red}
              fill={C.redLight}
            />
          </div>

          {/* 2 insight tiles */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
            <InsightTile
              title="Средняя тренировка"
              value={fmtTime(Math.round(avgPerWorkout.time_sec))}
              sub={avgPerWorkout.distance_m > 0 ? fmtKm(avgPerWorkout.distance_m) : undefined}
              tone="blue"
            />
            <InsightTile
              title="Средний объём в неделю"
              value={fmtKm(weeklyAvg.distance_m)}
              sub={fmtTime(Math.round(weeklyAvg.time_sec))}
              tone="violet"
            />
          </div>

          {/* summary + next step */}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-white/50 bg-background/60 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4" />
                Вывод
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {summaryLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/50 bg-background/60 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4" />
                Следующая тренировка
              </div>
              {nextWorkoutCard ? (
                <>
                  <div className="text-sm font-medium">{nextWorkoutCard.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{nextWorkoutCard.dateLabel}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{nextWorkoutCard.meta}</div>
                  <Link href="/plan">
                    <Button variant="secondary" size="sm" className="mt-3 rounded-xl">
                      Открыть план →
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    В плане пока нет ближайшей тренировки. Можно открыть календарь и добавить следующую сессию.
                  </p>
                  <Link href="/plan">
                    <Button variant="secondary" size="sm" className="rounded-xl">
                      Открыть план →
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── HR ZONES + WEEKLY RHYTHM ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Пульсовые зоны</CardTitle>
            <CardDescription>сколько времени тренировки шли в каждой зоне за период и как выглядит баланс 80/20</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hrZones.hasData ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.95fr_1.25fr]">
                  <div className="grid grid-cols-2 gap-2">
                    <CompactStat label="Лёгкая работа" value={fmtPercent(hrZones.easyPct)} tone="green" />
                    <CompactStat label="Интенсивная работа" value={fmtPercent(hrZones.hardPct)} tone="red" />
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      <HeartPulse className="h-4 w-4" />
                      Баланс 80/20
                    </div>
                    <p className="text-sm text-muted-foreground">{intensityRecommendation}</p>
                  </div>
                </div>

                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hrZones.rows}
                      margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                    >
                      <XAxis dataKey="zone" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [`${v} мин`, "Время"]} />
                      <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                        {hrZones.rows.map((row) => (
                          <Cell
                            key={row.zone}
                            fill={HR_ZONE_COLORS[row.zone] ?? C.purple}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyStateCard
                emoji="🫀"
                title="Пульсовые зоны пока не собраны"
                description="Как только появятся тренировки с данными по пульсу, здесь покажем распределение по зонам и проверим баланс 80/20"
              />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Объём тренировок по неделям</CardTitle>
            <CardDescription>12 недель · сколько времени вы тренировались каждую неделю</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <CompactStat
                label="Среднее время в неделю"
                value={fmtTime(Math.round(weeklyAvg.time_sec))}
                tone="blue"
              />
              <CompactStat
                label="Тренировок в неделю"
                value={Math.round(weeklyAvg.workouts * 10) / 10}
                tone="blue"
              />
            </div>
            <div className="h-40 sm:h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  onMouseMove={(state) => {
                    if (typeof state?.activeTooltipIndex === "number") {
                      setWeeklyHoverIndex(state.activeTooltipIndex);
                    }
                  }}
                  onMouseLeave={() => setWeeklyHoverIndex(null)}
                >
                  <XAxis dataKey="w" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} ч`, "Время"]} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill={C.blue} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <WeeklyVolumeCallout
              point={activeWeeklyPoint}
              title={weeklyComparison.title}
              text={weeklyComparison.text}
              emoji={weeklyComparison.emoji}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── DAILY TREND + KCAL ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Время тренировок по дням</CardTitle>
            <CardDescription>как распределялось тренировочное время внутри выбранного периода</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={daysData.map((d) => ({
                    d:        d.d,
                    time_h:   Math.round((Number(d.time_sec || 0) / 3600) * 100) / 100,
                    workouts: Number(d.workouts || 0),
                  }))}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity={0.42} />
                      <stop offset="100%" stopColor={C.blueLight} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any, name: any) =>
                      name === "time_h" ? [`${v} ч`, "Время"] : [v, "Тренировок"]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="time_h"
                    stroke={C.blue}
                    fill="url(#dailyFill)"
                    strokeWidth={3}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Сожжённые калории</CardTitle>
            <CardDescription>динамика энергозатрат по дням за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={daysData.map((d) => ({
                    d: d.d,
                    kcal: Math.round(Number(d.kcal || 0)),
                  }))}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="kcalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} ккал`, "Калории"]} />
                  <Area
                    type="monotone"
                    dataKey="kcal"
                    stroke="var(--destructive)"
                    fill="url(#kcalFill)"
                    strokeWidth={3}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── WEEKDAY HABITS + SPORT MIX ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Распределение тренировок по дням недели</CardTitle>
            <CardDescription>в какие дни недели у вас больше всего объёма и тренировок</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={wd.map((x) => ({
                    d: DOW_RU[(x.dow - 1 + 7) % 7],
                    h: +(Number(x.time_sec || 0) / 3600).toFixed(2),
                    c: Number(x.workouts || 0),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <defs>
                    {WEEKDAY_ANALYTICS_COLORS.map((color, idx) => (
                      <pattern
                        key={`weekday-time-pattern-${idx}`}
                        id={`weekday-time-pattern-${idx}`}
                        patternUnits="userSpaceOnUse"
                        width="16"
                        height="16"
                        patternTransform="rotate(-45)"
                      >
                        <rect width="16" height="16" fill={color.light} />
                        <rect x="8" y="0" width="8" height="16" fill={color.solid} />
                      </pattern>
                    ))}
                  </defs>
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any, name: any) =>
                      name === "h" ? [`${v} ч`, "Время"] : [v, "Тренировки"]
                    }
                  />
                  <Legend iconSize={10} />
                  <Bar
                    yAxisId="left"
                    dataKey="h"
                    radius={[6, 6, 0, 0]}
                    name="Время"
                  >
                    {wd.map((_, idx) => (
                      <Cell
                        key={`weekday-time-cell-${idx}`}
                        fill={`url(#weekday-time-pattern-${idx % WEEKDAY_ANALYTICS_COLORS.length})`}
                      />
                    ))}
                  </Bar>
                  <Bar
                    yAxisId="right"
                    dataKey="c"
                    radius={[6, 6, 0, 0]}
                    name="Тренировки"
                  >
                    {wd.map((_, idx) => (
                      <Cell
                        key={`weekday-workouts-cell-${idx}`}
                        fill={WEEKDAY_ANALYTICS_COLORS[idx % WEEKDAY_ANALYTICS_COLORS.length].solid}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Структура тренировок по видам спорта</CardTitle>
            <CardDescription>какую долю времени занимает каждый вид активности</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix.map((m) => ({
                      name: prettySport(m.sport),
                      value: Math.max(0, Number(m.time_sec || 0)),
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {mix.map((m, i) => (
                      <Cell key={i} fill={sportColor(m?.sport)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmtTime(Number(v)), "Время"]} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UI COMPONENTS
═══════════════════════════════════════════════════════════════ */

function HeroKPI({
  icon, label, value, color, fill,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
  fill: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/65 p-3 backdrop-blur sm:p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: fill, color }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InsightTile({
  title, value, sub, tone,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: "blue" | "violet" | "green" | "yellow";
}) {
  const cls =
    tone === "blue"   ? "border-[rgba(27,46,201,0.18)]  bg-[rgba(197,206,250,0.65)]" :
    tone === "violet" ? "border-[rgba(89,34,159,0.18)]  bg-[rgba(209,193,228,0.45)]" :
    tone === "green"  ? "border-[rgba(26,158,58,0.18)]  bg-[rgba(197,237,208,0.70)]" :
    /* yellow */        "border-[rgba(255,214,0,0.25)]   bg-[rgba(255,245,176,0.70)]";

  return (
    <div className={cn("rounded-2xl border p-3 sm:p-4", cls)}>
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-base font-semibold tabular-nums sm:text-lg">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function CompactStat({
  label, value, tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: "blue" | "violet" | "green" | "red";
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-3",
      tone === "blue"
        ? "border-[rgba(27,46,201,0.18)] bg-[rgba(197,206,250,0.38)]"
        : tone === "violet"
        ? "border-[rgba(89,34,159,0.18)] bg-[rgba(209,193,228,0.30)]"
        : tone === "green"
        ? "border-[rgba(26,158,58,0.18)] bg-[rgba(197,237,208,0.38)]"
        : "border-destructive/20 bg-destructive/5",
    )}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyStateCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full border bg-background text-3xl shadow-sm">
          {emoji}
        </div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function WeeklyVolumeCallout({
  point,
  title,
  text,
  emoji,
}: {
  point: { w: string; hours: number; workouts: number; distance_km: number } | null;
  title: string;
  text: string;
  emoji: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        "border-[rgba(27,46,201,0.18)] bg-[rgba(197,206,250,0.35)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70 text-lg">
          {emoji}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="text-sm font-semibold">{title}</div>
            {point ? (
              <div className="text-xs text-muted-foreground">
                {point.hours.toFixed(1)} ч · {point.workouts} трен. · {point.distance_km.toFixed(1)} км
              </div>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">{text}</div>
        </div>
      </div>
    </div>
  );
}