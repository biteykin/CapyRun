"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

import { AppTooltip } from "@/components/ui/AppTooltip";
import WorkoutCharts from "@/components/workouts/WorkoutCharts";
import DeviceFileBlock from "@/components/workouts/DeviceFileBlock";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis } from "recharts";

/* ================= helpers & types ================= */

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сент", "окт", "ноя", "дек"];
const WD_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

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

/* ================= page ================= */

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // delete dialog
  const [pendingDelete, setPendingDelete] = useState(false);

  // note (textarea) state
  const [note, setNote] = useState<string>("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);

  // fetch workout
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("workouts")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
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
    const { error } = await supabase.from("workouts").delete().eq("id", row.id);
    if (error) {
      // eslint-disable-next-line no-alert
      alert(error.message);
      return;
    }
    router.replace("/workouts");
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

  const computedSpeed = fmtSpeedKmh(
    row.distance_m,
    row.moving_time_sec ?? row.duration_sec
  );

  type MetricItem = {
    label: string;
    value: React.ReactNode;
    present: boolean;
    hint?: string;
  };

  const metricItems: Array<MetricItem> = [
    {
      label: "Дистанция",
      value: fmtKm(row.distance_m),
      present: isNum(row.distance_m),
      hint: "Преодолённое расстояние. Единицы: километры.",
    },
    {
      label: "Время",
      value: fmtDuration(row.duration_sec),
      present: isNum(row.duration_sec),
      hint: "От старта до финиша, включая паузы.",
    },
    {
      label: "В движении",
      value: fmtDuration(row.moving_time_sec),
      present: isNum(row.moving_time_sec),
      hint: "Сумма интервалов движения (без пауз).",
    },
    showRunPace
      ? {
          label: "Темп",
          value: fmtPace(row.avg_pace_s_per_km),
          present: isNum(row.avg_pace_s_per_km),
          hint: "Средний темп: мин/км.",
        }
      : {
          label: "Скорость",
          value: computedSpeed,
          present: computedSpeed !== "—",
          hint: "Средняя скорость: км/ч.",
        },
    {
      label: "Подъём",
      value: fmtM(row.elev_gain_m),
      present: isNum(row.elev_gain_m),
      hint: "Суммарный набор высоты.",
    },
    {
      label: "Спуск",
      value: fmtM(row.elev_loss_m),
      present: isNum(row.elev_loss_m),
      hint: "Суммарная потеря высоты.",
    },
    {
      label: "Ккал",
      value: isNum(row.calories_kcal) ? row.calories_kcal : "—",
      present: isNum(row.calories_kcal),
      hint: "Оценка энергозатрат.",
    },
    {
      label: "Пульс ср/макс",
      value: `${isNum(row.avg_hr) ? row.avg_hr : "—"} / ${
        isNum(row.max_hr) ? row.max_hr : "—"
      } bpm`,
      present: isNum(row.avg_hr) || isNum(row.max_hr),
      hint: "Средняя и максимальная ЧСС.",
    },
    {
      label: "Мощность ср/NP/макс",
      value: `${isNum(row.avg_power_w) ? row.avg_power_w : "—"} / ${
        isNum(row.np_power_w) ? row.np_power_w : "—"
      } / ${isNum(row.max_power_w) ? row.max_power_w : "—"} W`,
      present:
        isNum(row.avg_power_w) || isNum(row.np_power_w) || isNum(row.max_power_w),
      hint: "Средняя, NP и максимальная мощность.",
    },
    {
      label: "Каденс (шаг)",
      value: isNum(row.avg_cadence_spm) ? row.avg_cadence_spm : "—",
      present: isNum(row.avg_cadence_spm),
      hint: "SPM — шагов в минуту.",
    },
    {
      label: "Каденс (rpm)",
      value: isNum(row.avg_cadence_rpm) ? row.avg_cadence_rpm : "—",
      present: isNum(row.avg_cadence_rpm),
      hint: "RPM — оборотов в минуту.",
    },
    {
      label: "SWOLF ср",
      value: isNum(row.swim_swolf_avg) ? row.swim_swolf_avg : "—",
      present: isNum(row.swim_swolf_avg),
      hint: "Время за дорожку + число гребков.",
    },
    {
      label: "Плав. темп",
      value: fmtSwimPace(row.avg_swim_pace_s_per_100m),
      present: isNum(row.avg_swim_pace_s_per_100m),
      hint: "Средний темп: мин/100м.",
    },
    {
      label: "Бассейн",
      value: isNum(row.swim_pool_length_m) ? `${row.swim_pool_length_m} м` : "—",
      present: isNum(row.swim_pool_length_m),
      hint: "Длина бассейна.",
    },
    {
      label: "Стиль",
      value: isStr(row.swim_stroke_primary) ? row.swim_stroke_primary : "—",
      present: isStr(row.swim_stroke_primary),
      hint: "Основной стиль плавания.",
    },
    {
      label: "RPE",
      value: isNum(row.perceived_exertion) ? row.perceived_exertion : "—",
      present: isNum(row.perceived_exertion),
      hint: "Субъективная тяжесть (1–10).",
    },
    {
      label: "TRIMP",
      value: isNum(row.trimp) ? row.trimp : "—",
      present: isNum(row.trimp),
      hint: "Импульс тренировки.",
    },
    {
      label: "EF",
      value: isNum(row.ef) ? row.ef : "—",
      present: isNum(row.ef),
      hint: "Efficiency Factor.",
    },
    {
      label: "PA:HR",
      value: isNum(row.pa_hr_pct) ? `${row.pa_hr_pct}%` : "—",
      present: isNum(row.pa_hr_pct),
      hint: "Декуплинг темпа/мощности и ЧСС.",
    },
    {
      label: "IF",
      value: isNum(row.intensity_factor) ? row.intensity_factor : "—",
      present: isNum(row.intensity_factor),
      hint: "Intensity Factor (≈ NP/FTP).",
    },
    {
      label: "Нагрузка",
      value: isNum(row.training_load_score) ? row.training_load_score : "—",
      present: isNum(row.training_load_score),
      hint: "TSS-подобная метрика.",
    },
  ].filter((i) => i.present);

  const chartConfig: ChartConfig = {
    minutes: {
      label: "Минуты",
      color: "var(--chart-1)",
    },
  };

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
          <Link href={`/workouts/${row.id}/edit`}>
            <Button variant="primary">Редактировать</Button>
          </Link>
          <Button variant="danger" onClick={() => setPendingDelete(true)}>
            Удалить
          </Button>
        </div>
      </div>

      {/* METRICS GRID (каждый пункт — shadcn Card) */}
      {metricItems.length > 0 && (
        <section>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {metricItems.map((m, idx) => (
              <AppTooltip key={`${m.label}-${idx}`} content={m.hint || m.label}>
                <Card className="cursor-help">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="mt-1 text-base font-semibold">{m.value}</div>
                  </CardContent>
                </Card>
              </AppTooltip>
            ))}
          </div>
        </section>
      )}

      {/* HR ZONES + WEATHER */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {zonesData.length > 0 && (
          <Card className="overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Время в HR-зонах</CardTitle>
              <CardDescription>минуты по зонам</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-56">
                <BarChart accessibilityLayer data={zonesData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="minutes" radius={8} fill="var(--color-minutes)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {weather && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Погода</CardTitle>
              <CardDescription>условия в момент тренировки</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                {isNum(weather.temp_c) && <KV k="Температура" v={`${weather.temp_c} °C`} />}
                {isNum(weather.wind_kph) && <KV k="Ветер" v={`${weather.wind_kph} км/ч`} />}
                {isNum(weather.humidity) && <KV k="Влажность" v={`${weather.humidity}%`} />}
                {isNum(weather.pressure_hpa) && <KV k="Давление" v={`${weather.pressure_hpa} гПа`} />}
                {isStr(weather.conditions) && <KV k="Условия" v={weather.conditions} />}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Note + Device/File */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* NOTE (Textarea внутри shadcn Card) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Заметка</CardTitle>
            <CardDescription>дополните тренировку комментариями</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteDirty(true);
              }}
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
                onClick={() => {
                  setNote(row.description || "");
                  setNoteDirty(false);
                }}
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

        {/* DEVICE / FILES */}
        <DeviceFileBlock workoutId={row.id} />
      </section>

      {/* Charts */}
      <WorkoutCharts workoutId={row.id} />

      {/* Delete modal - shadcn AlertDialog */}
      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={doDelete}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

/* ============ tiny ui parts ============ */
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}