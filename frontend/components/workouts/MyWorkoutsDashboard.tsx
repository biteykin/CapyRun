"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DayRow = { d: string; workouts: number; time_sec: number; distance_m: number; kcal: number };
type WeekRow = { week_start: string; workouts: number; time_sec: number; distance_m: number };
type WdRow = { dow: number; workouts: number; time_sec: number };
type HourRow = { hh: number; workouts: number };
type MixRow = { sport: string; workouts: number; time_sec: number };
type KcalWdRow = { dow: number; kcal: number };

const DOW_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const PERIOD_STORAGE_KEY = "capyrun.dashboard.periodDays";
const PERIOD_OPTIONS = [7, 30, 90, 365] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export default function MyWorkoutsDashboardClient({ daysDefault = 30 }: { daysDefault?: number }) {
  const [days, setDays] = useState(daysDefault);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Restore saved period (client-only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      if ((PERIOD_OPTIONS as readonly number[]).includes(parsed)) {
        setDays(parsed as PeriodOption);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist period on change
  useEffect(() => {
    try {
      window.localStorage.setItem(PERIOD_STORAGE_KEY, String(days));
    } catch {
      // ignore
    }
  }, [days]);

  const [daysData, setDaysData] = useState<DayRow[]>([]);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [wd, setWd] = useState<WdRow[]>([]);
  const [hours, setHours] = useState<HourRow[]>([]);
  const [mix, setMix] = useState<MixRow[]>([]);
  const [kcalWd, setKcalWd] = useState<KcalWdRow[]>([]);

  useEffect(() => {
    let canceled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const [a, b, c, d, e, f] = await Promise.all([
          supabase.rpc("dash_fast_days", { days }),
          supabase.rpc("dash_fast_weeks", { weeks: 12 }),
          supabase.rpc("dash_fast_weekday", { days }),
          supabase.rpc("dash_fast_starts_hour", { days }),
          supabase.rpc("dash_fast_sport_mix", { days }),
          supabase.rpc("dash_fast_kcal_weekday", { days }),
        ]);

        if (canceled) return;

        if (a.error) throw a.error;
        if (b.error) throw b.error;
        if (c.error) throw c.error;
        if (d.error) throw d.error;
        if (e.error) throw e.error;
        if (f.error) throw f.error;

        setDaysData((a.data ?? []) as DayRow[]);
        setWeeks((b.data ?? []) as WeekRow[]);
        setWd((c.data ?? []) as WdRow[]);
        setHours((d.data ?? []) as HourRow[]);
        setMix((e.data ?? []) as MixRow[]);
        setKcalWd((f.data ?? []) as KcalWdRow[]);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [days]);

  // KPI totals for selected period
  const kpi = useMemo(() => {
    const W = daysData.reduce((s, x) => s + (isNum(x.workouts) ? x.workouts : 0), 0);
    const T = daysData.reduce((s, x) => s + (isNum(x.time_sec) ? x.time_sec : 0), 0);
    const D = daysData.reduce((s, x) => s + Number(x.distance_m || 0), 0);
    const K = daysData.reduce((s, x) => s + Number(x.kcal || 0), 0);
    return { workouts: W, time_sec: T, distance_m: D, kcal: K };
  }, [daysData]);

  // --- “форма” (очень простая и полезная сразу): сравнение последних 7д с ожиданием из 28д ---
  // Не привязано к текущему days (чтобы home выглядело стабильно), считаем по daysData:
  // если days < 28 — fallback на то что есть
  const form = useMemo(() => {
    if (daysData.length === 0) return { score: 0, label: "нет данных", tone: "muted" as const };

    // daysData обычно отсортировано по дате? на всякий — отсортируем
    const sorted = [...daysData].sort((a, b) => String(a.d).localeCompare(String(b.d)));

    const last7 = sorted.slice(-7);
    const last28 = sorted.slice(-28);

    const km7 = last7.reduce((s, x) => s + Number(x.distance_m || 0), 0) / 1000;
    const km28 = last28.reduce((s, x) => s + Number(x.distance_m || 0), 0) / 1000;

    const expected7 = last28.length >= 14 ? (km28 / Math.max(1, last28.length)) * 7 : (km7 > 0 ? km7 : 0);

    if (expected7 <= 0.2) return { score: 35, label: "строим базу", tone: "muted" as const };

    const ratio = km7 / Math.max(0.01, expected7);
    const score = Math.max(0, Math.min(100, Math.round(55 + (ratio - 1) * 28)));

    const tone =
      score >= 80 ? ("good" as const) :
      score >= 65 ? ("ok" as const) :
      score >= 50 ? ("warn" as const) :
      ("muted" as const);

    const label =
      score >= 80 ? "готов жечь" :
      score >= 65 ? "хорошая форма" :
      score >= 50 ? "нормально" :
      "бережно";

    return { score, label, tone, km7, expected7 };
  }, [daysData]);

  const heroClass =
    form.tone === "good"
      ? "bg-gradient-to-br from-emerald-200/60 to-sky-200/40 dark:from-emerald-500/15 dark:to-sky-500/10"
      : form.tone === "ok"
      ? "bg-gradient-to-br from-sky-200/55 to-violet-200/35 dark:from-sky-500/15 dark:to-violet-500/10"
      : form.tone === "warn"
      ? "bg-gradient-to-br from-amber-200/55 to-sky-200/30 dark:from-amber-500/15 dark:to-sky-500/10"
      : "bg-gradient-to-br from-muted/60 to-muted/20";

  return (
    <section className="space-y-6">
      {/* Top bar: period switch + status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">Период</div>
          <div className="inline-flex rounded-xl border bg-background p-1">
            {PERIOD_OPTIONS.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={days === n ? "default" : "ghost"}
                onClick={() => setDays(n)}
                className="rounded-lg"
              >
                {n} дн.
              </Button>
            ))}
          </div>
          {loading ? (
            <Badge variant="secondary" className="ml-1">
              Обновляем…
            </Badge>
          ) : null}
          {err ? (
            <Badge variant="destructive" className="ml-1">
              Ошибка
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/workouts">
            <Button variant="secondary">Открыть тренировки</Button>
          </Link>
        </div>
      </div>

      {err ? (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Не удалось загрузить дашборд</CardTitle>
            <CardDescription className="text-destructive">{err}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* HERO */}
      <Card className={`relative overflow-hidden ${heroClass}`}>
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-white/30 blur-3xl dark:bg-white/10" />
        </div>

        <CardContent className="relative p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <Badge variant="secondary">Runner HQ</Badge>
                <Badge variant="outline">возможности: объём • привычки • миксы</Badge>
              </div>

              <div className="text-2xl font-extrabold leading-tight">
                Твоя форма: <span className="tabular-nums">{form.score || "—"}</span>/100 ·{" "}
                <span className="font-semibold">{form.label}</span>
              </div>

              <div className="text-sm text-muted-foreground">
                Оценка основана на объёме последних 7 дней vs ожидаемого объёма по последним ~4 неделям.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Тренировок" value={kpi.workouts} />
              <MiniStat label="Дистанция" value={fmtKm(kpi.distance_m)} />
              <MiniStat label="Время" value={fmtTime(kpi.time_sec)} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-background/55 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Рекомендация</div>
                <div className="text-sm text-muted-foreground">
                  {form.score >= 75
                    ? "Можно делать качественную работу: темп/интервалы, но держи восстановление под контролем."
                    : form.score >= 55
                    ? "Хороший момент для стабильных тренировок: Z2 + 1 акцент в неделю."
                    : "Сфокусируйся на базе: лёгкие Z2, сон и регулярность. Через 2 недели будет заметный рост."}
                </div>
              </div>
              <Link href="/workouts">
                <Button className="rounded-xl">К тренировкам →</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI STRIP + sparkline */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Динамика по дням</CardTitle>
            <CardDescription>время тренировки (часы) за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KPI label="Тренировки" value={kpi.workouts} hint="Количество сессий за период" />
              <KPI label="Время" value={fmtTime(kpi.time_sec)} hint="Суммарная длительность за период" />
              <KPI label="Дистанция" value={fmtKm(kpi.distance_m)} hint="Суммарный километраж" />
              <KPI label="Калории" value={fmtKcal(kpi.kcal)} hint="Оценка энергозатрат" />
            </div>

            <div className="mt-4 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={daysData.map((d) => ({
                    d: d.d,
                    time_h: Math.round((Number(d.time_sec || 0) / 3600) * 100) / 100,
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <Tooltip formatter={(v: any) => [`${v} ч`, "Время"]} />
                  <Area
                    type="monotone"
                    dataKey="time_h"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Недельный ритм</CardTitle>
            <CardDescription>12 недель · время по неделям</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeks.map((w) => ({
                    w: w.week_start,
                    hours: +(Number(w.time_sec || 0) / 3600).toFixed(2),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="w" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <Tooltip formatter={(v: any) => [`${v} ч`, "Время"]} />
                  <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* HABITS: weekday + start hour */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Привычка по дням недели</CardTitle>
            <CardDescription>время (ч) и количество тренировок</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={wd.map((x) => ({
                    d: DOW_RU[(x.dow - 1 + 7) % 7],
                    h: +(Number(x.time_sec || 0) / 3600).toFixed(2),
                    c: Number(x.workouts || 0),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} width={28} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    formatter={(v: any, name: any) => (name === "h" ? [`${v} ч`, "Время"] : [v, "Сессии"])}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="h" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-3))" />
                  <Bar yAxisId="right" dataKey="c" fill="hsl(var(--chart-5))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Когда ты чаще стартуешь</CardTitle>
            <CardDescription>распределение стартов по часу</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hours.map((x) => ({ h: `${x.hh}:00`, c: Number(x.workouts || 0) }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="h" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <Tooltip formatter={(v: any) => [v, "Стартов"]} />
                  <Bar dataKey="c" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MIX + kcal weekday */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Микс видов спорта</CardTitle>
            <CardDescription>по времени за период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix.map((m) => ({ name: prettySport(m.sport), value: Math.max(0, Number(m.time_sec || 0)) }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {mix.map((_, i) => (
                      <Cell
                        key={i}
                        fill={`hsl(var(--chart-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}))`}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmtTime(Number(v)), "Время"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Калории по дням недели</CardTitle>
            <CardDescription>оценка энергозатрат</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kcalWd.map((x) => ({
                    d: DOW_RU[(x.dow - 1 + 7) % 7],
                    k: Math.round(Number(x.kcal || 0)),
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <Tooltip formatter={(v: any) => [`${v} ккал`, "Калории"]} />
                  <Bar dataKey="k" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-4))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Small footer tip */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Дальше сделаем ещё круче</CardTitle>
          <CardDescription>
            Подключим цели, “умные” инсайты (PA:HR/EF), и AI-выжимку по текущей форме — уже на базе твоих кешей.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Сейчас дашборд использует быстрые RPC и выглядит красиво. Следующий шаг — добавить “что делать завтра” и прогресс к целям.
        </CardContent>
      </Card>
    </section>
  );
}

/* ---- UI bits ---- */
function KPI({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint ? <span className="text-[10px] text-muted-foreground/70">{hint}</span> : null}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-3 backdrop-blur">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ---- formatters ---- */
function fmtTime(sec: number) {
  const s = Number(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtKm(m: number) {
  const km = Number(m || 0) / 1000;
  const d = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(d).replace(".", ",")} км`;
}
function fmtKcal(k: number) {
  return `${Math.round(Number(k || 0))} ккал`;
}
function prettySport(s: string) {
  const m: Record<string, string> = {
    run: "Бег",
    ride: "Вело",
    swim: "Плавание",
    walk: "Ходьба",
    hike: "Хайк",
    row: "Гребля",
    strength: "Силовая",
    yoga: "Йога",
    aerobics: "Аэробика",
    crossfit: "Кроссфит",
    pilates: "Пилатес",
    other: "Другая",
  };
  return m[s] || s;
}