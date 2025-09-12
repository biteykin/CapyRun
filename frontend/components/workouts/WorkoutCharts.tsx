"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Brush,
  ReferenceLine,
  Legend,
} from "recharts";

// ---------- helpers ----------
function secToHMS(total: number): string {
  if (!Number.isFinite(total)) return "";
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function secPerKmToPace(secs: number | null): string {
  if (secs == null || !Number.isFinite(secs)) return "—";
  const v = Math.max(0, Math.round(secs));
  const m = Math.floor(v / 60);
  const s = v % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function movingAvg(arr: (number | null)[], w: number): (number | null)[] {
  if (!arr?.length || w <= 1) return arr;
  const out: (number | null)[] = new Array(arr.length).fill(null);
  let sum = 0, cnt = 0;
  const q: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null || !Number.isFinite(v)) {
      sum = 0; cnt = 0; q.length = 0;
      out[i] = null;
      continue;
    }
    q.push(v); sum += v; cnt += 1;
    if (q.length > w) { sum -= q.shift()!; cnt -= 1; }
    out[i] = cnt ? sum / cnt : null;
  }
  return out;
}

// тики внутри произвольного диапазона [x0,x1]
function buildTicksRange(x0: number, x1: number): number[] {
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) return [];
  const durationSec = x1 - x0;
  const minutes = durationSec / 60;
  let step = 120; // 2 min
  if (minutes <= 20) step = 60;          // 1 min
  else if (minutes <= 60) step = 300;    // 5 min
  else if (minutes <= 120) step = 600;   // 10 min
  else step = 1200;                      // 20 min
  const ticks: number[] = [];
  const first = Math.ceil(x0 / step) * step;
  for (let t = first; t < x1; t += step) ticks.push(t);
  if (!ticks.length || ticks[0] !== x0) ticks.unshift(x0);
  if (ticks[ticks.length - 1] !== x1) ticks.push(x1);
  return ticks;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// ---------- component ----------
export default function WorkoutCharts({ workoutId }: { workoutId: string }) {
  const [rows, setRows] = useState<Array<{ t: number; pace: number | null; hr: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smooth, setSmooth] = useState(false);
  const [pinnedX, setPinnedX] = useState<number | null>(null);

  // контролируемый диапазон кисти (индексы массива)
  const totalLen = rows.length;
  const [brush, setBrush] = useState<{ startIndex: number; endIndex: number }>({ startIndex: 0, endIndex: 0 });

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from("workout_streams_preview")
        .select("s")
        .eq("workout_id", workoutId)
        .maybeSingle();
      if (canceled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const s: any = data?.s || {};
      const t: number[] = Array.isArray(s?.time_s) ? s.time_s : [];
      const pace: (number | null)[] = Array.isArray(s?.pace_s_per_km) ? s.pace_s_per_km : [];
      const hr: (number | null)[] = Array.isArray(s?.hr) ? s.hr : [];
      const len = Math.min(t.length, pace.length || t.length, hr.length || t.length);
      const r = new Array(len).fill(0).map((_, i) => ({ t: t[i], pace: pace[i] ?? null, hr: hr[i] ?? null }));
      setRows(r);
      setLoading(false);
    })();
    return () => { canceled = true; };
  }, [workoutId]);

  // инициализируем кисть по данным
  useEffect(() => {
    if (totalLen > 1) setBrush({ startIndex: 0, endIndex: totalLen - 1 });
  }, [totalLen]);

  // сглаженные ряды (полные)
  const paced = useMemo(() => {
    const vals = rows.map(r => r.pace);
    const arr = smooth ? movingAvg(vals, 5) : vals;
    return rows.map((r, i) => ({ ...r, pace: arr[i] }));
  }, [rows, smooth]);

  const hrd = useMemo(() => {
    const vals = rows.map(r => r.hr);
    const arr = smooth ? movingAvg(vals, 5) : vals;
    return rows.map((r, i) => ({ ...r, hr: arr[i] }));
  }, [rows, smooth]);

  // текущая видимая зона по кисти
  const visStartIdx = clamp(brush.startIndex, 0, Math.max(0, totalLen - 2));
  const visEndIdx   = clamp(brush.endIndex,   visStartIdx + 1, Math.max(1, totalLen - 1));
  const xMin = totalLen ? rows[visStartIdx].t : 0;
  const xMax = totalLen ? rows[visEndIdx].t   : 0;

  // тики и домены по видимой зоне
  const ticks = useMemo(() => buildTicksRange(xMin, xMax), [xMin, xMax]);

  const yPaceDomain = useMemo<[number, number] | undefined>(() => {
    if (!totalLen) return undefined;
    const slice = paced.slice(visStartIdx, visEndIdx + 1).map(r => r.pace).filter((v): v is number => v != null && Number.isFinite(v));
    if (!slice.length) return undefined;
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const pad = Math.max(3, (max - min) * 0.05);
    return [Math.max(0, min - pad), max + pad];
  }, [paced, visStartIdx, visEndIdx, totalLen]);

  const yHrDomain = useMemo<[number, number] | undefined>(() => {
    if (!totalLen) return undefined;
    const slice = hrd.slice(visStartIdx, visEndIdx + 1).map(r => r.hr).filter((v): v is number => v != null && Number.isFinite(v));
    if (!slice.length) return undefined;
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const pad = Math.max(2, (max - min) * 0.08);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [hrd, visStartIdx, visEndIdx, totalLen]);

  // min/max для заголовков (видимая зона)
  const paceMinMax = useMemo(() => {
    const vals = paced.slice(visStartIdx, visEndIdx + 1).map(r => r.pace).filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { min: null as number|null, max: null as number|null };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [paced, visStartIdx, visEndIdx]);

  const hrMinMax = useMemo(() => {
    const vals = hrd.slice(visStartIdx, visEndIdx + 1).map(r => r.hr).filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { min: null as number|null, max: null as number|null };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [hrd, visStartIdx, visEndIdx]);

  // пин-линия
  const handleChartClick = (e: any) => {
    const x = e?.activeLabel; // seconds
    if (typeof x === "number") {
      // если клик вне видимой зоны — проигнорить
      if (x < xMin || x > xMax) return;
      setPinnedX(prev => (prev === x ? null : x));
    }
  };

  const tooltipFormatter = (value: any, name: string) => {
    if (name === "Темп") return [secPerKmToPace(value as number | null), name];
    if (name === "Пульс") return [value == null ? "—" : Math.round(value as number), name];
    return [value, name];
  };

  const labelFormatter = (label: any) => secToHMS(Number(label) || 0);

  if (loading) return <div className="text-sm text-[var(--text-secondary)]">Загружаем графики…</div>;
  if (error) return <div className="text-sm text-red-600">Ошибка: {error}</div>;
  if (!rows.length) return <div className="text-sm text-[var(--text-secondary)]">Нет данных для графиков.</div>;

  // общий обработчик кисти для обоих чартов
  const handleBrushChange = (range: any) => {
    const si = clamp(Number(range?.startIndex ?? visStartIdx), 0, Math.max(0, totalLen - 2));
    const ei = clamp(Number(range?.endIndex ?? visEndIdx), si + 1, Math.max(1, totalLen - 1));
    setBrush({ startIndex: si, endIndex: ei });
    // если пин ушёл за пределы — отпинить
    if (pinnedX != null && (pinnedX < rows[si].t || pinnedX > rows[ei].t)) {
      setPinnedX(null);
    }
  };

  return (
    <section className="space-y-6 pt-2">
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="accent-current" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
          Сгладить (MA×5)
        </label>
        {pinnedX != null && (
          <div>
            Метка: <span className="font-medium">{secToHMS(pinnedX)}</span>
            {(() => {
              // показать значения, ближайшие к pinnedX
              const idx = rows.findIndex(r => r.t === pinnedX);
              if (idx >= 0) {
                const p = rows[idx].pace;
                const h = rows[idx].hr;
                return (
                  <>
                    , Темп: <span className="font-medium">{secPerKmToPace(p)}</span>
                    , Пульс: <span className="font-medium">{h == null ? "—" : Math.round(h)}</span>
                  </>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* Pace chart */}
      <div className="card p-4">
        <div className="mb-2 font-medium">
          Темп (сек/км)
          {" "}
          <span className="text-[var(--text-secondary)] text-xs">
            {paceMinMax.min != null && paceMinMax.max != null
              ? ` · Мин: ${secPerKmToPace(paceMinMax.min)} · Макс: ${secPerKmToPace(paceMinMax.max)}`
              : ""}
          </span>
        </div>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <LineChart data={paced} syncId="workout-sync" onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="t"
                domain={[xMin, xMax]}
                ticks={ticks}
                tickFormatter={secToHMS}
              />
              <YAxis domain={yPaceDomain} tickFormatter={secPerKmToPace} />
              <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" name="Темп" dataKey="pace" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
              {pinnedX != null && <ReferenceLine x={pinnedX} strokeDasharray="3 3" />}
              <Brush
                dataKey="t"
                height={22}
                travellerWidth={8}
                tickFormatter={secToHMS}
                startIndex={visStartIdx}
                endIndex={visEndIdx}
                onChange={handleBrushChange}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heart rate chart */}
      <div className="card p-4">
        <div className="mb-2 font-medium">
          Пульс (bpm)
          {" "}
          <span className="text-[var(--text-secondary)] text-xs">
            {hrMinMax.min != null && hrMinMax.max != null
              ? ` · Мин: ${Math.round(hrMinMax.min)} · Макс: ${Math.round(hrMinMax.max)}`
              : ""}
          </span>
        </div>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <LineChart data={hrd} syncId="workout-sync" onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="t"
                domain={[xMin, xMax]}
                ticks={ticks}
                tickFormatter={secToHMS}
              />
              <YAxis domain={yHrDomain} allowDecimals={false} />
              <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
              <Legend verticalAlign="top" height={24} />
              <Line type="monotone" name="Пульс" dataKey="hr" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
              {pinnedX != null && <ReferenceLine x={pinnedX} strokeDasharray="3 3" />}
              <Brush
                dataKey="t"
                height={22}
                travellerWidth={8}
                tickFormatter={secToHMS}
                startIndex={visStartIdx}
                endIndex={visEndIdx}
                onChange={handleBrushChange}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}