"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseBrowser";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import {
  CartesianGrid,
} from "recharts";

/** ===== Types ===== */
type Props = { workoutId: string };

type PreviewRow = {
  workout_id: string;
  points_count: number;
  s: {
    time_s: number[]; // общая ось X (сек от старта)
    pace_s_per_km?: Array<number | null>; // темп в сек/км
    hr?: Array<number | null>; // пульс bpm
  };
};

type PacePoint = { x: number; pace: number | null };
type HrPoint = { x: number; hr: number | null };

/** ===== Utils ===== */
function fmtSecToMinSec(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTimeTick(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Новая функция для форматирования темпа в десятичном формате (мин.сек)
function fmtPaceDecimal(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const totalMinutes = sec / 60;
  return `${totalMinutes.toFixed(2)}`;
}

function minMax(arr: Array<number | null | undefined>): { min?: number; max?: number } {
  const vals = arr.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return {};
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

/** ===== Component ===== */
export default function WorkoutCharts({ workoutId }: Props) {
  const [row, setRow] = useState<PreviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<Array<{ zone: string; minutes: number }>>([]);
  const [workoutStats, setWorkoutStats] = useState<{ avgPace?: number; avgHr?: number }>({});

  // fetch preview row
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("workout_streams_preview")
          .select("workout_id, points_count, s")
          .eq("workout_id", workoutId)
          .single();

        if (error) throw error;

        if (!canceled) setRow(data as unknown as PreviewRow);
      } catch (e: any) {
        if (!canceled) setError(e?.message ?? String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [workoutId]);

  // тянем агрегат зон из workouts.hr_zone_time и средние значения
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("workouts")
          .select("hr_zone_time, avg_pace_s_per_km, avg_hr")
          .eq("id", workoutId)
          .single();

        if (error) throw error;

        const z = (data?.hr_zone_time ?? {}) as Record<string, unknown>;
        const items = Object.entries(z)
          .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
          .map(([k, v]) => ({ zone: k, minutes: Math.round((v as number) / 60) }));

        // стабильный порядок Z1..Z5..Z7, если есть
        items.sort((a, b) => a.zone.localeCompare(b.zone, undefined, { numeric: true }));

        if (!canceled) {
          setZones(items);
          
          // Сохраняем средние значения из базы данных (оставляем в секундах для темпа)
          setWorkoutStats({
            avgPace: data?.avg_pace_s_per_km || undefined, // оставляем в секундах
            avgHr: data?.avg_hr || undefined
          });
        }
      } catch {
        if (!canceled) {
          setZones([]);
          setWorkoutStats({});
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [workoutId]);

  // normalize to chart points
  const { paceData, hrData, paceMM, hrMM } = useMemo(() => {
    if (!row?.s?.time_s?.length) {
      return {
        paceData: [] as PacePoint[],
        hrData: [] as HrPoint[],
        paceMM: {} as { min?: number; max?: number },
        hrMM: {} as { min?: number; max?: number },
      };
    }

    const time = row.s.time_s;
    const paceArr = row.s.pace_s_per_km ?? [];
    const hrArr = row.s.hr ?? [];

    const n = time.length;
    const safePace = paceArr.length === n ? paceArr : new Array(n).fill(null);
    const safeHr = hrArr.length === n ? hrArr : new Array(n).fill(null);

    const paceData: PacePoint[] = new Array(n);
    const hrData: HrPoint[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const x = time[i];
      // Конвертируем секунды в минуты для темпа
      const paceInSeconds = typeof safePace[i] === "number" && (safePace[i] as number) >= 0 ? (safePace[i] as number) : null;
      const p = paceInSeconds !== null ? paceInSeconds / 60 : null; // переводим в минуты
      const h = typeof safeHr[i] === "number" && (safeHr[i] as number) > 0 ? (safeHr[i] as number) : null;

      paceData[i] = { x, pace: p };
      hrData[i] = { x, hr: h };
    }

    const paceMM = minMax(paceData.map(d => d.pace));
    const hrMM = minMax(hrData.map(d => d.hr));

    return { paceData, hrData, paceMM, hrMM };
  }, [row]);

  const hasAny =
    (paceData?.some((p) => typeof p.pace === "number") ?? false) ||
    (hrData?.some((p) => typeof p.hr === "number") ?? false);

  const paceConfig: ChartConfig = { pace: { label: "Темп", color: "var(--chart-1)" } };
  const hrConfig: ChartConfig = { hr: { label: "Пульс", color: "var(--chart-2)" } };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Темп (мин/км)</CardTitle>
            <CardDescription>Загружаем…</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Пульс (уд/мин)</CardTitle>
            <CardDescription>Загружаем…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Графики</CardTitle>
            <CardDescription className="text-red-600">
              Не удалось получить превью рядов: {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ожидаем таблицу <code>public.workout_streams_preview</code> с JSON-полем
            <code className="ml-1">s</code>, содержащим массивы
            <code className="mx-1">time_s</code>,
            <code className="mx-1">pace_s_per_km</code>,
            <code className="mx-1">hr</code>.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Графики</CardTitle>
            <CardDescription>Нет данных для визуализации</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Для этой тренировки в превью отсутствуют ряды темпа и/или пульса.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Обновленные описания с правильным форматированием темпа
  const paceDesc =
    paceMM.max != null && paceMM.min != null && workoutStats.avgPace != null
      ? `Макс: ${fmtSecToMinSec(paceMM.max * 60)} мин/км · Среднее: ${fmtSecToMinSec(workoutStats.avgPace)} мин/км · Мин: ${fmtSecToMinSec(paceMM.min * 60)} мин/км`
      : "—";

  const hrDesc =
    hrMM.max != null && hrMM.min != null && workoutStats.avgHr != null 
      ? `Макс: ${Math.round(hrMM.max)} уд/мин · Среднее: ${Math.round(workoutStats.avgHr)} уд/мин · Мин: ${Math.round(hrMM.min)} уд/мин` 
      : "—";

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pace (мин/км) */}
      <Card>
        <CardHeader>
          <CardTitle>Темп (мин/км)</CardTitle>
          <CardDescription>{paceDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={paceConfig}>
            <LineChart
              accessibilityLayer
              data={paceData}
              syncId="workout-sync"
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => fmtTimeTick(Number(v))}
              />
              <ChartTooltip
                // показываем кросс-хэйр, чтобы было видно момент во времени
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) => `Время: ${fmtTimeTick(Number(label))}`}
                    valueFormatter={(v) => `Темп: ${fmtSecToMinSec(Number(v) * 60)} мин/км`}
                  />
                }
              />
              <Line
                dataKey="pace"
                type="natural"
                stroke="var(--color-pace, var(--chart-1))"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Heart Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Пульс (bpm)</CardTitle>
          <CardDescription>{hrDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={hrConfig}>
            <LineChart
              accessibilityLayer
              data={hrData}
              syncId="workout-sync"
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) => `Время: ${fmtTimeTick(Number(label))}`}
                    valueFormatter={(v) => `Пульс: ${Math.round(Number(v))} уд/мин`}
                  />
                }
              />
              <Line
                dataKey="hr"
                type="natural"
                stroke="var(--color-hr, var(--chart-2))"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* HR Zones bar chart */}
      {zones.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Время в HR-зонах</CardTitle>
            <CardDescription>
              Всего: {zones.reduce((s, x) => s + x.minutes, 0)} мин
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ minutes: { label: "Минуты", color: "var(--chart-3, var(--chart-1))" } }}
              className="h-44"
            >
              <BarChart accessibilityLayer data={zones} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="zone"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel valueFormatter={(v)=>`${v} мин`} />}
                />
                <Bar dataKey="minutes" fill="var(--color-minutes, var(--chart-1))" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </section>
  );
}