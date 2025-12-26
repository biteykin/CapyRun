"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceArea,
  ReferenceDot,
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StreamsPreview = {
  time_s: number[];
  hr: number[];
  pace_s_per_km: Array<number | null>;
};

type PreviewRow = {
  s: any; // jsonb
  updated_at?: string | null;
  created_at?: string | null;
};

type HrZone = { name: string; from: number; to: number };

const HR_COLOR = "#EF3707"; // bg-red
const PACE_COLOR = "#F6B021"; // bg-yellow
const SERIES_OPACITY = 0.75;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtMmSsFromSeconds(sec?: number | null) {
  if (!isNum(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDurationFromSeconds(sec?: number | null) {
  if (!isNum(sec) || sec <= 0) return "—";
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function downsampleEvenly<T>(arr: T[], maxPoints: number) {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function avg(values: Array<number | null | undefined>) {
  const xs = values.filter((v): v is number => isNum(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function maxv(values: Array<number | null | undefined>) {
  const xs = values.filter((v): v is number => isNum(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => Math.max(a, b), -Infinity);
}

// пытаемся вытащить зоны из profile.hr_zones в разных форматах
function parseHrZones(raw: any, hrMaxFallback?: number | null): HrZone[] {
  if (!raw || typeof raw !== "object") return [];

  // Формат A: { Z1: [120, 140], Z2: [141, 155], ... }
  const keys = Object.keys(raw);
  if (keys.some((k) => /^z\d+$/i.test(k))) {
    const zones: HrZone[] = [];
    for (const k of keys.sort((a, b) => a.localeCompare(b))) {
      const v = raw[k];
      if (Array.isArray(v) && v.length >= 2 && isNum(v[0]) && isNum(v[1])) {
        zones.push({ name: k.toUpperCase(), from: Number(v[0]), to: Number(v[1]) });
      }
    }
    return zones;
  }

  // Формат B: { zones: [{name,min,max}] }
  if (Array.isArray(raw.zones)) {
    const zones: HrZone[] = raw.zones
      .map((z: any, i: number) => {
        const name = String(z?.name ?? `Z${i + 1}`).toUpperCase();
        const from = isNum(z?.min) ? Number(z.min) : null;
        const to = isNum(z?.max) ? Number(z.max) : null;
        if (from == null || to == null) return null;
        return { name, from, to };
      })
      .filter(Boolean) as HrZone[];
    return zones;
  }

  // Формат C (проценты): { Z1: [0.6, 0.7], ... } + hrMax
  const hrMax = isNum(raw.hr_max) ? Number(raw.hr_max) : hrMaxFallback;
  if (hrMax && keys.some((k) => /^z\d+$/i.test(k))) {
    const zones: HrZone[] = [];
    for (const k of keys.sort((a, b) => a.localeCompare(b))) {
      const v = raw[k];
      if (Array.isArray(v) && v.length >= 2 && isNum(v[0]) && isNum(v[1])) {
        const from = Math.round(Number(v[0]) * hrMax);
        const to = Math.round(Number(v[1]) * hrMax);
        zones.push({ name: k.toUpperCase(), from, to });
      }
    }
    return zones;
  }

  return [];
}

// интегрируем дистанцию из темпа: speed(m/s)=1000/pace(sec/km), distance += speed*dt
function buildDistanceFromPace(time_s: number[], pace_s_per_km: Array<number | null>) {
  const dist_m: number[] = [];
  let cum = 0;
  for (let i = 0; i < time_s.length; i++) {
    const t = time_s[i];
    const tPrev = i === 0 ? 0 : time_s[i - 1];
    const dt = Math.max(0, t - tPrev);

    const pace = pace_s_per_km[i];
    if (isNum(pace) && pace > 0 && dt > 0) {
      const speed = 1000 / pace; // m/s
      cum += speed * dt;
    }
    dist_m.push(cum);
  }
  return dist_m;
}

function pickKmMarkers(
  t: number[],
  dist_m: number[],
  hr: Array<number | null>,
  pace: Array<number | null>,
  kmStep = 1
) {
  if (!t.length || !dist_m.length) return [];
  const out: Array<{ km: number; idx: number; t: number; hr: number | null; pace: number | null }> =
    [];

  const maxKm = Math.floor(dist_m[dist_m.length - 1] / 1000);
  if (maxKm <= 0) return out;

  let targetKm = kmStep;
  for (let i = 0; i < dist_m.length; i++) {
    const km = dist_m[i] / 1000;
    if (km >= targetKm - 1e-9) {
      out.push({
        km: targetKm,
        idx: i,
        t: t[i],
        hr: isNum(hr[i]) ? (hr[i] as number) : null,
        pace: isNum(pace[i]) ? (pace[i] as number) : null,
      });
      targetKm += kmStep;
      if (targetKm > maxKm) break;
    }
  }
  return out;
}

type Mode = "both" | "hr" | "pace";

export default function WorkoutCharts({ workoutId }: { workoutId: string }) {
  const [streams, setStreams] = React.useState<StreamsPreview>({
    time_s: [],
    hr: [],
    pace_s_per_km: [],
  });
  const [hrMax, setHrMax] = React.useState<number | null>(null);
  const [hrZones, setHrZones] = React.useState<HrZone[]>([]);
  const [mode, setMode] = React.useState<Mode>("both");

  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // ✅ НОВЫЙ зум: храним диапазон по ИНДЕКСАМ в chartData (полной серии)
  const [brush, setBrush] = React.useState<{ startIndex: number; endIndex: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) превью стримов
        const { data, error } = await supabase
          .from("workout_streams_preview")
          .select("s, updated_at, created_at")
          .eq("workout_id", workoutId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!cancelled) {
            setStreams({ time_s: [], hr: [], pace_s_per_km: [] });
            setErr("Нет данных превью для этой тренировки.");
          }
          return;
        }

        const row = data as PreviewRow;
        const s = row?.s ?? null;

        const time_s = Array.isArray(s?.time_s) ? s.time_s : [];
        const hr = Array.isArray(s?.hr) ? s.hr : [];
        const pace_s_per_km = Array.isArray(s?.pace_s_per_km) ? s.pace_s_per_km : [];

        const n = Math.min(time_s.length, hr.length, pace_s_per_km.length);
        if (!n) {
          if (!cancelled) {
            setStreams({ time_s: [], hr: [], pace_s_per_km: [] });
            setErr("Превью есть, но внутри s нет рядов time_s/hr/pace_s_per_km.");
          }
          return;
        }

        if (!cancelled) {
          setStreams({
            time_s: time_s.slice(0, n),
            hr: hr.slice(0, n),
            pace_s_per_km: pace_s_per_km.slice(0, n),
          });
          // сбрасываем зум при смене тренировки/данных
          setBrush(null);
        }

        // 2) подтянуть hr_max + hr_zones из профиля (для раскраски зон)
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) return;

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("hr_max, hr_zones")
          .eq("user_id", uid)
          .maybeSingle();

        if (profErr) return;

        if (!cancelled) {
          const maxHr = prof?.hr_max != null ? Number(prof.hr_max) : null;
          setHrMax(isNum(maxHr) ? maxHr : null);

          const zones = parseHrZones(prof?.hr_zones, isNum(maxHr) ? maxHr : null);
          setHrZones(zones);
        }
      } catch (e: any) {
        if (!cancelled) {
          const msg = String(e?.message || e);
          setErr(`Не удалось получить превью рядов: ${msg}`);
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

  const chartData = React.useMemo(() => {
    const { time_s, hr, pace_s_per_km } = streams;
    if (!time_s?.length) return [];

    const raw = time_s.map((t, i) => ({
      t, // seconds
      tMin: t / 60,
      hr: isNum(hr?.[i]) ? hr[i] : null,
      pace: isNum(pace_s_per_km?.[i]) ? (pace_s_per_km[i] as number) : null, // sec/km
    }));

    // чтобы всё летало + красивее по плотности
    const MAX_POINTS = 1200;
    return downsampleEvenly(raw, MAX_POINTS);
  }, [streams]);

  // фиксируем brush, чтобы он не выходил за пределы при изменении данных
  React.useEffect(() => {
    if (!brush) return;
    if (!chartData.length) return;
    const maxIdx = Math.max(0, chartData.length - 1);
    const s = clamp(brush.startIndex, 0, maxIdx);
    const e = clamp(brush.endIndex, 0, maxIdx);
    if (s !== brush.startIndex || e !== brush.endIndex) {
      setBrush({ startIndex: s, endIndex: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData.length]);

  // X-domain для “зумнутого” окна (✅ вместо того, чтобы резать data и ломать Brush)
  const xDomain = React.useMemo(() => {
    if (!chartData.length) return [0, "dataMax"] as any;
    if (!brush) return [0, "dataMax"] as any;

    const maxIdx = chartData.length - 1;
    const a = clamp(Math.min(brush.startIndex, brush.endIndex), 0, maxIdx);
    const b = clamp(Math.max(brush.startIndex, brush.endIndex), 0, maxIdx);

    const x1 = chartData[a]?.tMin ?? 0;
    const x2 = chartData[b]?.tMin ?? chartData[maxIdx]?.tMin ?? "dataMax";
    return [x1, x2] as any;
  }, [chartData, brush]);

  // derived (для KPI, маркеров, best splits) — считаем по полной серии (это ок)
  const derived = React.useMemo(() => {
    if (!chartData.length) return null;

    const time_s = chartData.map((d) => d.t);
    const hr = chartData.map((d) => d.hr);
    const pace = chartData.map((d) => d.pace);

    const dist_m = buildDistanceFromPace(time_s, pace);
    const kmMarkers = pickKmMarkers(time_s, dist_m, hr, pace, 1);

    const best = (km: number) => {
      const target = km * 1000;
      let bestDt = Infinity;
      let bestI = -1;
      let bestJ = -1;

      let j = 0;
      for (let i = 0; i < dist_m.length; i++) {
        while (j < dist_m.length && dist_m[j] - dist_m[i] < target) j++;
        if (j < dist_m.length) {
          const dt = time_s[j] - time_s[i];
          if (dt > 0 && dt < bestDt) {
            bestDt = dt;
            bestI = i;
            bestJ = j;
          }
        } else break;
      }
      if (!Number.isFinite(bestDt) || bestI < 0) return null;
      return {
        km,
        i: bestI,
        j: bestJ,
        dt: bestDt,
        startMin: time_s[bestI] / 60,
        endMin: time_s[bestJ] / 60,
      };
    };

    return {
      time_s,
      hr,
      pace,
      dist_m,
      kmMarkers,
      best1k: best(1),
      best5k: best(5),
      best10k: best(10),
    };
  }, [chartData]);

  const kpi = React.useMemo(() => {
    if (!derived || !chartData.length) return null;
    const durationSec = chartData[chartData.length - 1]?.t ?? null;

    const hrAvg = avg(chartData.map((d) => d.hr));
    const hrMaxLocal = maxv(chartData.map((d) => d.hr));
    const paceAvg = avg(chartData.map((d) => d.pace));

    const distKm = derived.dist_m.length ? derived.dist_m[derived.dist_m.length - 1] / 1000 : null;

    return {
      durationSec,
      distKm,
      hrAvg: hrAvg != null ? Math.round(hrAvg) : null,
      hrMax: hrMaxLocal != null ? Math.round(hrMaxLocal) : null,
      paceAvgSec: paceAvg != null ? Math.round(paceAvg) : null,
    };
  }, [chartData, derived]);

  // Домены лучше считать из “видимого” окна, иначе шкала прыгает странно.
  // Но т.к. мы не режем data, берём points, попадающие в xDomain.
  const visible = React.useMemo(() => {
    if (!chartData.length) return [];
    if (!brush) return chartData;

    const maxIdx = chartData.length - 1;
    const a = clamp(Math.min(brush.startIndex, brush.endIndex), 0, maxIdx);
    const b = clamp(Math.max(brush.startIndex, brush.endIndex), 0, maxIdx);
    return chartData.slice(a, b + 1);
  }, [chartData, brush]);

  const paceValues = React.useMemo(
    () => visible.map((d) => d.pace).filter((v): v is number => isNum(v)),
    [visible]
  );

  const paceDomain = React.useMemo(() => {
    if (!paceValues.length) return null;
    const minP = Math.min(...paceValues); // fastest
    const maxP = Math.max(...paceValues); // slowest
    const pad = Math.max(6, Math.round((maxP - minP) * 0.12));
    return [maxP + pad, Math.max(1, minP - pad)] as [number, number]; // reversed
  }, [paceValues]);

  const hrValues = React.useMemo(
    () => visible.map((d) => d.hr).filter((v): v is number => isNum(v)),
    [visible]
  );

  const hrDomain = React.useMemo(() => {
    if (!hrValues.length) return [0, 200] as [number, number];
    const minH = Math.min(...hrValues);
    const maxH = Math.max(...hrValues);
    const pad = Math.max(4, Math.round((maxH - minH) * 0.16));
    return [Math.max(0, minH - pad), maxH + pad] as [number, number];
  }, [hrValues]);

  const SexyTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    // payload может содержать разные серии, берём исходный payload у первой
    const p = payload?.[0]?.payload;
    const tSec = p?.t;
    const hr = p?.hr;
    const pace = p?.pace;

    return (
      <div className="rounded-2xl border bg-background/95 backdrop-blur px-3 py-2 shadow-sm">
        <div className="text-xs text-muted-foreground">
          {isNum(tSec) ? `Время: ${fmtDurationFromSeconds(tSec)}` : "—"}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {mode !== "pace" && (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-muted-foreground">ЧСС</span>
              <span className="text-sm font-semibold">{isNum(hr) ? `${hr} bpm` : "—"}</span>
            </span>
          )}
          {mode === "both" && <span className="text-muted-foreground">•</span>}
          {mode !== "hr" && (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Темп</span>
              <span className="text-sm font-semibold">
                {isNum(pace) ? `${fmtMmSsFromSeconds(pace)} /км` : "—"}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const cursorStyle = {
    stroke: "hsl(var(--border))",
    strokeWidth: 1,
    strokeDasharray: "4 6",
  } as const;

  // зоны рисуем как полупрозрачные полосы по HR оси (если есть hr_zones)
  const zoneBands = React.useMemo(() => {
    if (!hrZones?.length) return [];
    const fills = [
      "rgba(19,128,229,0.12)",
      "rgba(62,134,30,0.12)",
      "rgba(246,175,33,0.12)",
      "rgba(241,64,10,0.12)",
      "rgba(250,0,77,0.12)",
    ];
    return hrZones.map((z, i) => ({
      ...z,
      fill: fills[i % fills.length],
    }));
  }, [hrZones]);

  const showBrush = chartData.length > 120;

  // ✅ маркеры “каждый км” в режиме both рисуем по темпу И по пульсу (две точки)
  const kmDots = React.useMemo(() => {
    const ms = derived?.kmMarkers ?? [];
    if (!ms.length) return [];
    // ограничим, чтобы не заспамить
    return ms.slice(0, 40);
  }, [derived]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Аналитика тренировки</CardTitle>
            <div className="text-xs text-muted-foreground">
              Пульс + темп, зоны, сплиты и зум — “elite view”
            </div>
          </div>

          {kpi && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                ⏱ {fmtDurationFromSeconds(kpi.durationSec)}
              </Badge>
              {kpi.distKm != null && (
                <Badge variant="secondary" className="rounded-full">
                  🛣 {kpi.distKm.toFixed(kpi.distKm >= 10 ? 1 : 2).replace(".", ",")} км (≈)
                </Badge>
              )}
              <Badge variant="secondary" className="rounded-full">
                ❤️ {kpi.hrAvg ?? "—"} ср / {kpi.hrMax ?? "—"} макс
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                🏃 {kpi.paceAvgSec != null ? `${fmtMmSsFromSeconds(kpi.paceAvgSec)} /км` : "—"} ср
              </Badge>
            </div>
          )}
        </div>

        {/* режимы */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === "both" ? "primary" : "secondary"}
              onClick={() => setMode("both")}
            >
              Пульс + Темп
            </Button>
            <Button
              size="sm"
              variant={mode === "hr" ? "primary" : "secondary"}
              onClick={() => setMode("hr")}
            >
              Только пульс
            </Button>
            <Button
              size="sm"
              variant={mode === "pace" ? "primary" : "secondary"}
              onClick={() => setMode("pace")}
            >
              Только темп
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            {showBrush ? "Выделяй диапазон снизу, чтобы приблизить" : "Наведись на график для значений"}
          </div>
        </div>

        {/* best splits */}
        {derived && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {derived.best1k && (
              <Badge variant="outline" className="rounded-full">
                Best 1k: {fmtDurationFromSeconds(derived.best1k.dt)} ({fmtMmSsFromSeconds(derived.best1k.dt)}{" "}
                /км)
              </Badge>
            )}
            {derived.best5k && (
              <Badge variant="outline" className="rounded-full">
                Best 5k: {fmtDurationFromSeconds(derived.best5k.dt)}
              </Badge>
            )}
            {derived.best10k && (
              <Badge variant="outline" className="rounded-full">
                Best 10k: {fmtDurationFromSeconds(derived.best10k.dt)}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Загружаем…</div>
        ) : !chartData.length ? (
          <div className="p-4 text-sm text-muted-foreground">{err ?? "Нет данных для визуализации."}</div>
        ) : (
          <div className="rounded-2xl border bg-card/30">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 18, right: 18, left: 12, bottom: showBrush ? 10 : 14 }}
                >
                  <defs>
                    {/* glow (оставим лёгкий, он не “подложка”) */}
                    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.2" result="blur" />
                      <feColorMatrix
                        in="blur"
                        type="matrix"
                        values="
                          1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 0.28 0"
                        result="glow"
                      />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid strokeDasharray="3 7" vertical={false} />

                  <XAxis
                    dataKey="tMin"
                    type="number"
                    domain={xDomain}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                    tickFormatter={(v: number) => `${Math.round(v)}м`}
                    tick={{ fontSize: 12 }}
                  />

                  {/* HR */}
                  <YAxis
                    yAxisId="hr"
                    domain={hrDomain}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `${v}`}
                    hide={mode === "pace"}
                  />

                  {/* Pace */}
                  <YAxis
                    yAxisId="pace"
                    orientation="right"
                    domain={paceDomain ?? ["auto", "auto"]}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => fmtMmSsFromSeconds(v)}
                    hide={mode === "hr"}
                  />

                  <Tooltip cursor={cursorStyle as any} content={<SexyTooltip />} />

                  {/* HR zones bands (оставляем) */}
                  {mode !== "pace" &&
                    zoneBands.map((z) => (
                      <ReferenceArea
                        key={z.name}
                        yAxisId="hr"
                        y1={z.from}
                        y2={z.to}
                        fill={z.fill}
                        fillOpacity={1}
                        ifOverflow="extendDomain"
                      />
                    ))}

                  {/* Best split windows highlight (оставляем) */}
                  {derived?.best1k && (
                    <ReferenceArea
                      x1={derived.best1k.startMin}
                      x2={derived.best1k.endMin}
                      fill="rgba(246,176,33,0.08)"
                      ifOverflow="extendDomain"
                    />
                  )}
                  {derived?.best5k && (
                    <ReferenceArea
                      x1={derived.best5k.startMin}
                      x2={derived.best5k.endMin}
                      fill="rgba(251,87,141,0.06)"
                      ifOverflow="extendDomain"
                    />
                  )}

                  {/* KM markers: ✅ в both показываем обе точки (HR и Pace) */}
                  {kmDots.map((m) => (
                    <React.Fragment key={`km-${m.km}`}>
                      {mode !== "pace" && (
                        <ReferenceDot
                          x={m.t / 60}
                          y={m.hr ?? null}
                          yAxisId="hr"
                          r={3}
                          fill={HR_COLOR}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          ifOverflow="discard"
                          label={{
                            value: `${m.km}к`,
                            position: "top",
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                        />
                      )}

                      {mode !== "hr" && (
                        <ReferenceDot
                          x={m.t / 60}
                          y={m.pace ?? null}
                          yAxisId="pace"
                          r={3}
                          fill={PACE_COLOR}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          ifOverflow="discard"
                        />
                      )}
                    </React.Fragment>
                  ))}

                  {/* ✅ 3) УБРАЛИ “подложку” (градиентные заливки): теперь только линии */}
                  {/* HR series */}
                  {mode !== "pace" && (
                    <Line
                      yAxisId="hr"
                      type="natural"
                      dataKey="hr"
                      stroke={HR_COLOR}
                      strokeWidth={2.2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      //filter="url(#softGlow)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={SERIES_OPACITY}
                      activeDot={{
                        r: 5,
                        stroke: "hsl(var(--background))",
                        strokeWidth: 2,
                        fill: HR_COLOR,
                      }}
                      name="ЧСС"
                    />
                  )}

                  {/* ✅ 2) Темп — полноценная линия (а не только точки) */}
                  {mode !== "hr" && (
                    <Line
                      yAxisId="pace"
                      type="natural"
                      dataKey="pace"
                      stroke={PACE_COLOR}
                      strokeWidth={2.2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      //filter="url(#softGlow)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={SERIES_OPACITY}
                      activeDot={{
                        r: 5,
                        stroke: "hsl(var(--background))",
                        strokeWidth: 2,
                        fill: PACE_COLOR,
                      }}
                      name="Темп"
                    />
                  )}

                  {/* ✅ 1) Переписанный Brush: теперь он работает по полной серии, а зум делаем через XAxis domain */}
                  {showBrush && (
                    <Brush
                      dataKey="tMin"
                      height={26}
                      stroke="hsl(var(--muted-foreground))"
                      travellerWidth={10}
                      startIndex={brush ? brush.startIndex : 0}
                      endIndex={brush ? brush.endIndex : Math.max(0, chartData.length - 1)}
                      onChange={(v: any) => {
                        if (!v) return;

                        const maxIdx = Math.max(0, chartData.length - 1);
                        const s = clamp(Number(v.startIndex ?? 0), 0, maxIdx);
                        const e = clamp(Number(v.endIndex ?? maxIdx), 0, maxIdx);

                        // если выбрано почти всё — считаем, что зума нет
                        const full =
                          Math.min(s, e) <= 0 && Math.max(s, e) >= Math.max(0, maxIdx - 1);

                        setBrush(full ? null : { startIndex: s, endIndex: e });
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {mode !== "pace" && (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: HR_COLOR }} />
                    ЧСС (bpm)
                  </span>
                )}
                {mode !== "hr" && (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PACE_COLOR }} />
                    Темп (мин/км)
                  </span>
                )}
                {hrZones.length > 0 && mode !== "pace" && (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm border" />
                    HR-зоны
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setBrush(null)} disabled={!brush}>
                  Сбросить зум
                </Button>
              </div>
            </div>
          </div>
        )}

        {err && chartData.length > 0 && <p className="mt-2 text-xs text-destructive/70">{err}</p>}
      </CardContent>
    </Card>
  );
}