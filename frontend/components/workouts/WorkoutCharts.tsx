"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";

// ⚠️ выбери нужный импорт в зависимости от имени файла infra-компонента
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type StreamsPreview = {
  time_s: number[];
  hr: number[];
  pace_s_per_km: number[];
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function fmtPace(secPerKm?: number | null) {
  if (!isFiniteNum(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutCharts({ workoutId }: { workoutId: string }) {
  const [streams, setStreams] = React.useState<StreamsPreview>({
    time_s: [],
    hr: [],
    pace_s_per_km: [],
  });
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("workout_streams_preview")
          .select("time_s, hr, pace_s_per_km, updated_at, created_at")
          .eq("workout_id", workoutId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(); // безопасно при 0 строк

        if (error) throw error;

        if (!cancelled) {
          if (!data) {
            setStreams({ time_s: [], hr: [], pace_s_per_km: [] });
            setErr("Нет данных превью для этой тренировки.");
          } else {
            setStreams({
              time_s: data.time_s ?? [],
              hr: data.hr ?? [],
              pace_s_per_km: data.pace_s_per_km ?? [],
            });
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          const msg = String(e?.message || e);
          if (/Cannot coerce the result to a single JSON object/i.test(msg)) {
            setErr("В превью несколько строк для одной тренировки — берём последнюю.");
          } else {
            setErr("Не удалось получить превью рядов.");
          }
          setStreams({ time_s: [], hr: [], pace_s_per_km: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  // Готовим данные для чарта
  const chartData = React.useMemo(() => {
    const { time_s, hr, pace_s_per_km } = streams;
    if (!time_s?.length) return [];

    // ВАЖНО: массивы часто разной длины (особенно если один поток отсутствует).
    // Строим по минимальной длине, иначе Recharts может "сломаться" и не рисовать.
    const len = Math.min(
      time_s.length,
      Array.isArray(hr) ? hr.length : 0,
      Array.isArray(pace_s_per_km) ? pace_s_per_km.length : 0
    );

    // Если один из потоков пустой — всё равно строим по time_s,
    // но аккуратно подставляем null (и потом проверим наличие серии).
    const safeLen = len > 0 ? len : time_s.length;

    return Array.from({ length: safeLen }, (_, i) => {
      const t = time_s[i];
      const hrV = hr?.[i];
      const paceV = pace_s_per_km?.[i];
      return {
        tMin: +(t / 60).toFixed(1),
        hr: isFiniteNum(hrV) && hrV > 0 ? hrV : null,
        pace: isFiniteNum(paceV) && paceV > 0 ? paceV : null,
      };
    });
  }, [streams]);

  const hasHR = React.useMemo(() => chartData.some((d) => d.hr != null), [chartData]);
  const hasPace = React.useMemo(() => chartData.some((d) => d.pace != null), [chartData]);

  const paceDomain = React.useMemo<[number, number] | undefined>(() => {
    const vals = chartData.map((d) => d.pace).filter((v): v is number => isFiniteNum(v));
    if (!vals.length) return undefined;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // чуть воздуха, чтобы линия не упиралась
    const pad = Math.max(5, Math.round((max - min) * 0.06));
    return [Math.max(0, min - pad), max + pad];
  }, [chartData]);

  // Конфиг цветов/лейблов для ChartContainer → прокинется как CSS vars (--color-hr/--color-pace)
  const chartConfig: ChartConfig = {
    hr:   { label: "ЧСС",  color: "hsl(var(--chart-1))" },
    pace: { label: "Темп", color: "hsl(var(--chart-2))" },
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Графики</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Загружаем…</div>
        ) : !chartData.length ? (
          <div className="p-4 text-sm text-muted-foreground">
            {err ?? "Нет данных для визуализации."}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full overflow-hidden">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="tMin"
                tickFormatter={(v: number) => `${v} мин`}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              {hasHR && (
                <YAxis
                  yAxisId="hr"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
              )}
              {hasPace && (
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  domain={paceDomain}
                  reversed
                  tickFormatter={(v: number) => fmtPace(v)}
                />
              )}
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(val) => `Время: ${val} мин`}
                  />
                }
              />
              {hasHR && (
                <Area
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  stroke="var(--color-hr)"
                  fill="var(--color-hr)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                  name="ЧСС"
                  connectNulls
                />
              )}
              {hasPace && (
                <Area
                  yAxisId="pace"
                  type="monotone"
                  dataKey="pace"
                  stroke="var(--color-pace)"
                  fill="var(--color-pace)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={false}
                  name="Темп"
                  connectNulls
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}

        {err && chartData.length > 0 && (
          <p className="mt-2 text-xs text-destructive/70">{err}</p>
        )}
      </CardContent>
    </Card>
  );
}