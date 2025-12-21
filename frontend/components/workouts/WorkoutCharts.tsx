"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type StreamsPreview = {
  time_s: number[];
  hr: number[];
  pace_s_per_km: number[];
};

function fmtMmSs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
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
            setErr("Нет данных превью для этой тренировки (workout_streams_preview).");
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
            setErr("В превью несколько строк для одной тренировки — берём последнюю. (Проверь уникальность по workout_id)");
          } else {
            // важнее показать реальную ошибку (RLS / таблица / колонки / etc)
            setErr(msg);
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
    return time_s.map((t, i) => ({
      tMin: +(t / 60).toFixed(1),
      hr: hr?.[i] ?? null,
      pace: pace_s_per_km?.[i] ?? null,
    }));
  }, [streams]);

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
            {err ? `Не удалось получить данные: ${err}` : "Нет данных для визуализации."}
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="tMin"
                  tickFormatter={(v: number) => `${v} мин`}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="hr"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (typeof v === "number" ? fmtMmSs(v) : "")}
                />
                <Tooltip
                  cursor={false}
                  formatter={(value: any, name: any) => {
                    if (name === "hr") return [`${value ?? "—"} bpm`, "ЧСС"];
                    if (name === "pace") return [value != null ? `${fmtMmSs(Number(value))} /км` : "—", "Темп"];
                    return [value, name];
                  }}
                  labelFormatter={(label: any) => `Время: ${label} мин`}
                />
                <Area
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  yAxisId="pace"
                  type="monotone"
                  dataKey="pace"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {err && chartData.length > 0 && <p className="mt-2 text-xs text-destructive/70">{err}</p>}
      </CardContent>
    </Card>
  );
}