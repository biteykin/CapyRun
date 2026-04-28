//frontend/app/(protected)/workouts/[id]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseBrowser";
import WorkoutAiInsight from "@/components/workouts/WorkoutAiInsight";

import WorkoutWeatherKpi from "@/components/workouts/WorkoutWeatherKpi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import { Textarea } from "@/components/ui/textarea";

import { AppTooltip } from "@/components/ui/AppTooltip";
import {
  Activity,
  Clock3,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Mountain,
  Route,
  TrendingDown,
  Zap,
} from "lucide-react";

// Charts (dynamic)
const WorkoutCharts = dynamic(() => import("@/components/workouts/WorkoutCharts"), { ssr: false });

const WorkoutMap = dynamic(() => import("@/components/workouts/WorkoutMap.client"), {
  ssr: false,
  loading: () => (
    <div className="h-[440px] w-full rounded-2xl border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
      Загружаем карту…
    </div>
  ),
});

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ================= helpers & types ================= */

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сент", "окт", "ноя", "дек"];
const WD_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const METRIC_COLORS = {
  blue: { solid: "#1B2EC9", light: "#C5CEFA" },
  purple: { solid: "#59229F", light: "#D1C1E4" },
  green: { solid: "#1A9E3A", light: "#C5EDD0" },
  red: { solid: "#E60012", light: "#FFCCCC" },
  yellow: { solid: "#B88700", light: "#FFF5B0" },
  teal: { solid: "#3AAAEF", light: "#C5E8FF" },
  navy: { solid: "#283158", light: "#D7DCE8" },
} as const;

type Weather = {
  temp_c?: number;
  wind_kph?: number;
  humidity?: number;
  pressure_hpa?: number;
  conditions?: string;
  [k: string]: unknown;
};

type HRZones = Record<string, number> | null;

type Workout = {
  id: string;
  user_id: string;
  name: string | null;
  description: string | null;
  source: string | null;
  sport: string | null;
  sub_sport: string | null;
  visibility: string | null;
  start_time: string | null;
  timezone_at_start: string | null;
  local_date: string | null;
  uploaded_at: string | null;
  filename: string | null;
  size_bytes: number | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  elev_gain_m: number | null;
  elev_loss_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power_w: number | null;
  max_power_w: number | null;
  np_power_w: number | null;
  avg_cadence_spm: number | null;
  avg_cadence_rpm: number | null;
  avg_pace_s_per_km: number | null;
  calories_kcal: number | null;
  trimp: number | null;
  ef: number | null;
  pa_hr_pct: number | null;
  intensity_factor: number | null;
  training_load_score: number | null;
  laps_count: number | null;
  has_gps: boolean | null;
  avg_swim_pace_s_per_100m: number | null;
  swim_pool_length_m: number | null;
  swim_stroke_primary: string | null;
  swim_swolf_avg: number | null;
  weather: Weather | null;
  hr_zone_time: HRZones;
  perceived_exertion: number | null;
  created_at: string;
  updated_at: string;
  strava_activity_url?: string | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function humanSport(s?: string | null) {
  const k = (s || "").toLowerCase();
  const map: Record<string, string> = {
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
  return map[k] || "Другая";
}

function fmtDateFancy(local_date?: string | null, start_time?: string | null, tz?: string | null) {
  let d: Date | null = null;
  if (isStr(local_date)) d = new Date(`${local_date}T00:00:00`);
  else if (isStr(start_time)) d = new Date(start_time);
  if (!d) return "—";
  const wd = WD_RU[d.getDay()];
  const day = d.getDate();
  const mon = MONTHS_RU[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const yearStr = year === new Date().getFullYear() ? String(year).slice(2) : String(year);
  return `${wd}, ${day} ${mon} ${yearStr} · ${hh}:${mm}${tz ? ` (${tz})` : ""}`;
}
function fmtKm(m?: number | null) {
  if (!isNum(m)) return "—";
  const km = m / 1000;
  const decimals = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(decimals).replace(".", ",")} км`;
}
function fmtM(m?: number | null) {
  if (!isNum(m)) return "—";
  return `${m} м`;
}
function fmtDuration(sec?: number | null) {
  if (!isNum(sec)) return "—";
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtPace(secPerKm?: number | null) {
  if (!isNum(secPerKm)) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /км`;
}
function fmtSwimPace(secPer100?: number | null) {
  if (!isNum(secPer100)) return "—";
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${String(s).padStart(2, "0")} /100м`;
}
function fmtSpeedKmh(distance_m?: number | null, time_sec?: number | null) {
  if (!isNum(distance_m) || !isNum(time_sec) || time_sec <= 0) return "—";
  const kmh = distance_m / 1000 / (time_sec / 3600);
  const decimals = kmh >= 100 ? 0 : kmh >= 10 ? 1 : 2;
  return `${kmh.toFixed(decimals).replace(".", ",")} км/ч`;
}
function fmtNumber(v?: number | null, digits = 0) {
  if (!isNum(v)) return "—";
  return v.toFixed(digits).replace(".", ",");
}
function fmtClimbRate(elev_gain_m?: number | null, moving_time_sec?: number | null) {
  if (!isNum(elev_gain_m) || !isNum(moving_time_sec) || moving_time_sec <= 0) return "—";
  const perHour = elev_gain_m / (moving_time_sec / 3600);
  return `${fmtNumber(perHour, perHour >= 100 ? 0 : 1)} м/ч`;
}
function fmtTimeOfDay(start_time?: string | null) {
  if (!isStr(start_time)) return "—";
  const d = new Date(start_time);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ================= page ================= */

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [row, setRow] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState(false);

  const [note, setNote] = useState<string>("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("workouts")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!canceled) {
            setRow(null);
            setErr(null);
          }
          return;
        }

        if (!canceled) {
          const w = data as Workout;
          setRow(w);
          setNote(w?.description || "");
          setNoteDirty(false);
        }
      } catch (e: unknown) {
        if (!canceled) setErr((e as any)?.message ?? String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [id]);

  const zonesData = useMemo(() => {
    const z = row?.hr_zone_time;
    if (!z || !isRecord(z)) return [] as Array<{ zone: string; minutes: number }>;
    const entries = Object.entries(z).filter(([, v]) => isNum(v));
    return entries.map(([k, v]) => ({
      zone: String(k),
      minutes: Math.round((v as number) / 60),
    }));
  }, [row]);

  const weather = useMemo<Weather | null>(() => {
    const w = row?.weather;
    return isRecord(w) ? (w as Weather) : null;
  }, [row]);

  const title = row?.name || humanSport(row?.sport) || "Тренировка";
  const showRunPace =
    (row?.sport || "").toLowerCase() === "run" ||
    (row?.sport || "").toLowerCase() === "walk";

  async function doDelete() {
    if (!row) return;
    const { error } = await supabase
      .from("workouts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      alert(error.message);
      return;
    }
    setRow(null);
    router.replace("/workouts");
    router.refresh();
  }

  async function saveNote() {
    if (!row) return;
    try {
      setNoteSaving(true);
      const { error } = await supabase
        .from("workouts")
        .update({ description: note })
        .eq("id", row.id);
      if (error) throw error;
      setNoteDirty(false);
      setNoteSavedAt(new Date());
      setRow({ ...row, description: note });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as any)?.message ?? "Не удалось сохранить заметку");
    } finally {
      setNoteSaving(false);
    }
  }

  const computedSpeed = fmtSpeedKmh(
    row?.distance_m ?? null,
    row?.moving_time_sec ?? row?.duration_sec ?? null
  );
  const computedClimbRate = fmtClimbRate(
    row?.elev_gain_m ?? null,
    row?.moving_time_sec ?? row?.duration_sec ?? null
  );

  type MetricItem = {
    label: string;
    value: React.ReactNode;
    present: boolean;
    hint?: string;
    icon?: React.ReactNode;
    tone?: keyof typeof METRIC_COLORS;
  };

  const metricItems: Array<MetricItem> = [
    {
      label: "Дистанция",
      value: fmtKm(row?.distance_m ?? null),
      present: isNum(row?.distance_m),
      hint: "Преодолённое расстояние. Единицы: километры.",
      icon: <Route className="h-4 w-4" />,
      tone: "blue" as const,
    },
    {
      label: "Время",
      value: fmtDuration(row?.duration_sec ?? null),
      present: isNum(row?.duration_sec),
      hint: "От старта до финиша, включая паузы.",
      icon: <Clock3 className="h-4 w-4" />,
      tone: "green" as const,
    },
    {
      label: "В движении",
      value: fmtDuration(row?.moving_time_sec ?? null),
      present: isNum(row?.moving_time_sec),
      hint: "Сумма интервалов движения (без пауз).",
      icon: <Activity className="h-4 w-4" />,
      tone: "teal" as const,
    },
    showRunPace
      ? {
          label: "Темп",
          value: fmtPace(row?.avg_pace_s_per_km ?? null),
          present: isNum(row?.avg_pace_s_per_km),
          hint: "Средний темп: мин/км.",
          icon: <Gauge className="h-4 w-4" />,
          tone: "purple" as const,
        }
      : {
          label: "Скорость",
          value: computedSpeed,
          present: computedSpeed !== "—",
          hint: "Средняя скорость: км/ч.",
          icon: <Gauge className="h-4 w-4" />,
          tone: "purple" as const,
        },
    {
      label: "Подъём",
      value: fmtM(row?.elev_gain_m ?? null),
      present: isNum(row?.elev_gain_m),
      hint: "Суммарный набор высоты.",
      icon: <Mountain className="h-4 w-4" />,
      tone: "navy" as const,
    },
    {
      label: "Время старта",
      value: fmtTimeOfDay(row?.start_time ?? null),
      present: isStr(row?.start_time),
      hint: "Локальное время начала тренировки.",
      icon: <Clock3 className="h-4 w-4" />,
      tone: "yellow" as const,
    },
    {
      label: "Спуск",
      value: fmtM(row?.elev_loss_m ?? null),
      present: isNum(row?.elev_loss_m),
      hint: "Суммарная потеря высоты.",
      icon: <TrendingDown className="h-4 w-4" />,
      tone: "navy" as const,
    },
    {
      label: "Ккал",
      value: isNum(row?.calories_kcal) ? row!.calories_kcal : "—",
      present: isNum(row?.calories_kcal),
      hint: "Оценка энергозатрат.",
      icon: <Flame className="h-4 w-4" />,
      tone: "red" as const,
    },
    {
      label: "Пульс ср/макс",
      value: `${isNum(row?.avg_hr) ? row!.avg_hr : "—"} / ${isNum(row?.max_hr) ? row!.max_hr : "—"} bpm`,
      present: isNum(row?.avg_hr) || isNum(row?.max_hr),
      hint: "Средняя и максимальная ЧСС.",
      icon: <HeartPulse className="h-4 w-4" />,
      tone: "red" as const,
    },
    {
      label: "Мощность ср/NP/макс",
      value: `${isNum(row?.avg_power_w) ? row!.avg_power_w : "—"} / ${isNum(row?.np_power_w) ? row!.np_power_w : "—"} / ${
        isNum(row?.max_power_w) ? row!.max_power_w : "—"
      } W`,
      present:
        isNum(row?.avg_power_w) || isNum(row?.np_power_w) || isNum(row?.max_power_w),
      hint: "Средняя, NP и максимальная мощность.",
      icon: <Zap className="h-4 w-4" />,
      tone: "yellow" as const,
    },
    {
      label: "Каденс (шаг)",
      value: isNum(row?.avg_cadence_spm) ? row!.avg_cadence_spm : "—",
      present: isNum(row?.avg_cadence_spm),
      hint: "SPM — шагов в минуту.",
      icon: <Footprints className="h-4 w-4" />,
      tone: "green" as const,
    },
    {
      label: "Каденс (rpm)",
      value: isNum(row?.avg_cadence_rpm) ? row!.avg_cadence_rpm : "—",
      present: isNum(row?.avg_cadence_rpm),
      hint: "RPM — оборотов в минуту.",
      icon: "🔄",
    },
    {
      label: "SWOLF ср",
      value: isNum(row?.swim_swolf_avg) ? row!.swim_swolf_avg : "—",
      present: isNum(row?.swim_swolf_avg),
      hint: "Время за дорожку + число гребков.",
    },
    {
      label: "Плав. темп",
      value: fmtSwimPace(row?.avg_swim_pace_s_per_100m ?? null),
      present: isNum(row?.avg_swim_pace_s_per_100m),
      hint: "Средний темп: мин/100м.",
    },
    {
      label: "Бассейн",
      value: isNum(row?.swim_pool_length_m) ? `${row!.swim_pool_length_m} м` : "—",
      present: isNum(row?.swim_pool_length_m),
      hint: "Длина бассейна.",
    },
    {
      label: "Стиль",
      value: isStr(row?.swim_stroke_primary) ? row!.swim_stroke_primary : "—",
      present: isStr(row?.swim_stroke_primary),
      hint: "Основной стиль плавания.",
    },
    {
      label: "RPE",
      value: isNum(row?.perceived_exertion) ? row!.perceived_exertion : "—",
      present: isNum(row?.perceived_exertion),
      hint: "Субъективная тяжесть (1–10).",
      icon: "💪",
    },
    {
      label: "TRIMP",
      value: isNum(row?.trimp) ? row!.trimp : "—",
      present: isNum(row?.trimp),
      hint: "Импульс тренировки.",
      icon: "📊",
    },
    {
      label: "EF",
      value: isNum(row?.ef) ? row!.ef : "—",
      present: isNum(row?.ef),
      hint: "Efficiency Factor.",
      icon: "🧠",
    },
    {
      label: "PA:HR",
      value: isNum(row?.pa_hr_pct) ? `${row!.pa_hr_pct}%` : "—",
      present: isNum(row?.pa_hr_pct),
      hint: "Декуплинг темпа/мощности и ЧСС.",
      icon: "📈",
    },
    {
      label: "IF",
      value: isNum(row?.intensity_factor) ? row!.intensity_factor : "—",
      present: isNum(row?.intensity_factor),
      hint: "Intensity Factor (≈ NP/FTP).",
      icon: "🎯",
    },
    {
      label: "Нагрузка",
      value: isNum(row?.training_load_score) ? row!.training_load_score : "—",
      present: isNum(row?.training_load_score),
      hint: "TSS-подобная метрика.",
      icon: "🏋️",
    },
  ].filter((i) => i.present);

  /* ================= render ================= */

  if (loading) {
    return (
      <main className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Загружаем…
          </CardContent>
        </Card>
      </main>
    );
  }

  if (err) {
    return (
      <main className="space-y-6 p-6">
        <Alert>
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
        <div>
          <Link href="/workouts">
            <Button variant="ghost">← Назад к списку</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">Не найдено</CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <div className="text-sm text-muted-foreground">
            {fmtDateFancy(row.local_date, row.start_time, row.timezone_at_start)}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {isStr(row.sport) && (
              <Badge variant="secondary">
                {humanSport(row.sport)}
                {row.sub_sport ? ` • ${row.sub_sport}` : ""}
              </Badge>
            )}
            {isStr(row.visibility) && (
              <Badge variant="outline">Видимость: {row.visibility}</Badge>
            )}
            {isStr(row.source) && (
              <Badge variant="outline">Источник: {row.source}</Badge>
            )}
            {isNum(row.laps_count) && (
              <Badge variant="outline">Круги: {row.laps_count}</Badge>
            )}
            {row.has_gps ? <Badge variant="outline">GPS</Badge> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/workouts">
            <Button variant="secondary">← Назад</Button>
          </Link>
          {isStr(row.strava_activity_url) && (
            <a href={row.strava_activity_url} target="_blank" rel="noreferrer">
              <Button variant="secondary">Открыть в Strava</Button>
            </a>
          )}
          <Link href={`/workouts/${row.id}/edit`}>
            <Button variant="primary">Редактировать</Button>
          </Link>
          <Button variant="danger" onClick={() => setPendingDelete(true)}>
            Удалить
          </Button>
        </div>
      </div>

      {/* METRICS GRID */}
      {metricItems.length > 0 && (
        <section>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricItems.map((m, idx) => (
              <AppTooltip key={`${m.label}-${idx}`} content={m.hint || m.label}>
                <Card className="cursor-help overflow-hidden border bg-background/80 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: METRIC_COLORS[m.tone ?? "blue"].light,
                          color: METRIC_COLORS[m.tone ?? "blue"].solid,
                        }}
                      >
                        {m.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">{m.label}</div>
                        <div className="mt-1 truncate text-lg font-semibold tabular-nums">
                          {m.value}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AppTooltip>
            ))}
            {weather ? (
              <WorkoutWeatherKpi
                weather={weather}
                variant="compact"
                animated
              />
            ) : null}
          </div>
        </section>
      )}

      {/* Note + AI insight (должны быть выше графика) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Заметка</CardTitle>
            <CardDescription>дополните тренировку комментариями</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); setNoteDirty(true); }}
              placeholder="Как прошло? самочувствие, погода, особенности маршрута…"
              className="min-h-[120px] resize-vertical"
            />
            <div className="flex items-center gap-2">
              <Button onClick={saveNote} disabled={!noteDirty || noteSaving}>
                {noteSaving ? "Сохраняем…" : "Сохранить"}
              </Button>
              <Button
                variant="ghost"
                disabled={!noteDirty || noteSaving}
                onClick={() => { setNote(row.description || ""); setNoteDirty(false); }}
              >
                Отмена
              </Button>
              {noteSavedAt && !noteDirty && (
                <span className="text-xs text-muted-foreground">
                  Сохранено {noteSavedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI insight */}
        <WorkoutAiInsight workoutId={row.id} />
      </section>

      {/* Charts (пульс/темп) — сразу под картой (после инсайтов+заметки) */}
      <section>
        <WorkoutCharts workoutId={row.id} />
      </section>

      {/* HR ZONES + WEATHER */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {zonesData.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Время в HR-зонах</CardTitle>
              <CardDescription>минуты по зонам</CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zonesData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="zone" tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip
                      cursor={false}
                      formatter={(v: any) => [`${v} мин`, "Время"]}
                      labelFormatter={(l: any) => `Зона: ${l}`}
                    />
                    <Bar dataKey="minutes" radius={8} fill="hsl(var(--chart-1))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* MAP (перенесли в самый низ) */}
      <section>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Маршрут</CardTitle>
            <CardDescription>
              Интерактивная карта: градиент, play, клик по треку, follow и т.д.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkoutMap workoutId={row.id} />
          </CardContent>
        </Card>
      </section>

      <ConfirmActionDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Удалить тренировку?"
        description="Это действие необратимо."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        onConfirm={doDelete}
      />
    </main>
  );
}
