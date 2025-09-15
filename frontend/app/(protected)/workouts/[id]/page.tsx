"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import WorkoutCharts from "@/components/workouts/WorkoutCharts";
import NoteInline from "@/components/workouts/NoteInline";
import DeviceFileBlock from "@/components/workouts/DeviceFileBlock";
import { AppTooltip } from "@/components/ui/AppTooltip";

/* ================= helpers & types ================= */

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сент","окт","ноя","дек"];
const WD_RU = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

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
  perceived_exertion: number | null; // <- добавлено для RPE
  created_at: string;
  updated_at: string;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function humanSport(s?: string | null) {
  const k = (s || "").toLowerCase();
  const map: Record<string, string> = {
    run: "Бег", ride: "Вело", swim: "Плавание", walk: "Ходьба", hike: "Хайк", row: "Гребля",
    strength: "Силовая", yoga: "Йога", aerobics: "Аэробика", crossfit: "Кроссфит", pilates: "Пилатес", other: "Другая",
  };
  return map[k] || "Другая";
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-xl border px-2 py-1 text-xs leading-none">{children}</span>;
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
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
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
  return `${m}:${String(s).padStart(2,"0")} /км`;
}
function fmtSwimPace(secPer100?: number | null) {
  if (!isNum(secPer100)) return "—";
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${String(s).padStart(2,"0")} /100м`;
}
function fmtSpeedKmh(distance_m?: number | null, time_sec?: number | null) {
  if (!isNum(distance_m) || !isNum(time_sec) || time_sec <= 0) return "—";
  const kmh = (distance_m / 1000) / (time_sec / 3600);
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
  const [pendingDelete, setPendingDelete] = useState(false);

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
        if (!canceled) setRow(data as Workout);
      } catch (e: unknown) {
        if (!canceled) setErr((e as any)?.message ?? String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [id]);

  const zonesData = useMemo(() => {
    const z = row?.hr_zone_time;
    if (!z || !isRecord(z)) return [];
    const entries = Object.entries(z).filter(([, v]) => isNum(v));
    return entries.map(([k, v]) => ({ zone: String(k), min: Math.round((v as number) / 60) }));
  }, [row]);

  const weather = useMemo<Weather | null>(() => {
    const w = row?.weather;
    return isRecord(w) ? (w as Weather) : null;
  }, [row]);

  async function doDelete() {
    if (!row) return;
    const { error } = await supabase.from("workouts").delete().eq("id", row.id);
    if (error) { alert(error.message); return; }
    router.replace("/workouts");
  }

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем…</div>;
  if (err) return (
    <div className="p-6">
      <div className="alert alert-error"><span className="alert-icon">⚠️</span><div>{err}</div></div>
      <div className="mt-4">
        <Link className="btn btn-ghost" href="/workouts">← Назад к списку</Link>
      </div>
    </div>
  );
  if (!row) return <div className="p-6">Не найдено</div>;

  const title = row.name || humanSport(row.sport) || "Тренировка";
  const workoutId = row.id;

  /* ================= render ================= */

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="h-display text-2xl font-extrabold">{title}</h1>
          <div className="text-sm text-[var(--text-secondary)]">
            {fmtDateFancy(row.local_date, row.start_time, row.timezone_at_start)}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {isStr(row.sport) && <Badge>{humanSport(row.sport)}{row.sub_sport ? ` • ${row.sub_sport}` : ""}</Badge>}
            {isStr(row.visibility) && <Badge>Видимость: {row.visibility}</Badge>}
            {isStr(row.source) && <Badge>Источник: {row.source}</Badge>}
            {isNum(row.laps_count) && <Badge>Круги: {row.laps_count}</Badge>}
            {row.has_gps ? <Badge>GPS</Badge> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn btn-ghost" href="/workouts">← Назад</Link>
          <Link className="btn btn-primary" href={`/workouts/${row.id}/edit`}>Редактировать</Link>
          <button className="btn btn-ghost text-red-600" onClick={() => setPendingDelete(true)}>Удалить</button>
        </div>
      </div>

      {/* METRICS GRID */}
      {(() => {
        const showRunPace = (row.sport || "").toLowerCase() === "run" || (row.sport || "").toLowerCase() === "walk";
        const computedSpeed = fmtSpeedKmh(row.distance_m, row.moving_time_sec ?? row.duration_sec);

        type MetricItem = { label: string; value: React.ReactNode; present: boolean; hint?: string };

        const items: Array<MetricItem> = [
          { label: "Дистанция", value: fmtKm(row.distance_m), present: isNum(row.distance_m), hint: "Преодолённое расстояние по GPS/датчикам. Единицы: километры." },
          { label: "Время", value: fmtDuration(row.duration_sec), present: isNum(row.duration_sec), hint: "Общее время от старта до финиша, включая паузы." },
          { label: "В движении", value: fmtDuration(row.moving_time_sec), present: isNum(row.moving_time_sec), hint: "Сумма интервалов, когда устройство фиксировало движение (без пауз)." },
          showRunPace
            ? { label: "Темп", value: fmtPace(row.avg_pace_s_per_km), present: isNum(row.avg_pace_s_per_km), hint: "Средний темп: мин/км. Рассчитан по времени в движении." }
            : { label: "Скорость", value: computedSpeed, present: computedSpeed !== "—", hint: "Средняя скорость: км/ч. По дистанции и времени в движении." },
          { label: "Подъём", value: fmtM(row.elev_gain_m), present: isNum(row.elev_gain_m), hint: "Суммарный набор высоты по данным альтиметра/GPS." },
          { label: "Спуск", value: fmtM(row.elev_loss_m), present: isNum(row.elev_loss_m), hint: "Суммарная потеря высоты." },
          { label: "Ккал", value: isNum(row.calories_kcal) ? row.calories_kcal : "—", present: isNum(row.calories_kcal), hint: "Оценка энергозатрат по ЧСС/мощности/модели устройства." },
          {
            label: "Пульс ср/макс",
            value: `${isNum(row.avg_hr) ? row.avg_hr : "—"} / ${isNum(row.max_hr) ? row.max_hr : "—"} bpm`,
            present: isNum(row.avg_hr) || isNum(row.max_hr),
            hint: "Средняя и максимальная частота сердечных сокращений (уд/мин)."
          },
          {
            label: "Мощность ср/NP/макс",
            value: `${isNum(row.avg_power_w) ? row.avg_power_w : "—"} / ${isNum(row.np_power_w) ? row.np_power_w : "—"} / ${isNum(row.max_power_w) ? row.max_power_w : "—"} W`,
            present: isNum(row.avg_power_w) || isNum(row.np_power_w) || isNum(row.max_power_w),
            hint: "Средняя мощность, Normalized Power (NP) и максимальная мощность (Вт)."
          },
          { label: "Каденс (шаг)", value: isNum(row.avg_cadence_spm) ? row.avg_cadence_spm : "—", present: isNum(row.avg_cadence_spm), hint: "Средний шаговый каденс: шагов в минуту (SPM)." },
          { label: "Каденс (rpm)", value: isNum(row.avg_cadence_rpm) ? row.avg_cadence_rpm : "—", present: isNum(row.avg_cadence_rpm), hint: "Средний каденс педалирования: оборотов в минуту (RPM)." },
          { label: "SWOLF ср", value: isNum(row.swim_swolf_avg) ? row.swim_swolf_avg : "—", present: isNum(row.swim_swolf_avg), hint: "SWOLF = время за дорожку + число гребков. Ниже — лучше." },
          { label: "Плав. темп", value: fmtSwimPace(row.avg_swim_pace_s_per_100m), present: isNum(row.avg_swim_pace_s_per_100m), hint: "Средний темп плавания: мин/100м." },
          { label: "Бассейн", value: isNum(row.swim_pool_length_m) ? `${row.swim_pool_length_m} м` : "—", present: isNum(row.swim_pool_length_m), hint: "Длина бассейна, использованная для расчётов." },
          { label: "Стиль", value: isStr(row.swim_stroke_primary) ? row.swim_stroke_primary : "—", present: isStr(row.swim_stroke_primary), hint: "Основной стиль плавания, распознанный устройством." },
          { label: "RPE", value: isNum(row.perceived_exertion) ? row.perceived_exertion : "—", present: isNum(row.perceived_exertion), hint: "Rating of Perceived Exertion (1–10) — субъективная тяжесть тренировки." },
          { label: "TRIMP", value: isNum(row.trimp) ? row.trimp : "—", present: isNum(row.trimp), hint: "Training Impulse — нагрузка на основе времени и ЧСС." },
          { label: "EF", value: isNum(row.ef) ? row.ef : "—", present: isNum(row.ef), hint: "Efficiency Factor — соотношение скорости/мощности к ЧСС; рост EF = лучшая экономичность." },
          { label: "PA:HR", value: isNum(row.pa_hr_pct) ? `${row.pa_hr_pct}%` : "—", present: isNum(row.pa_hr_pct), hint: "Декуплинг темпа/мощности и ЧСС; >~5% может указывать на падение устойчивости." },
          { label: "IF", value: isNum(row.intensity_factor) ? row.intensity_factor : "—", present: isNum(row.intensity_factor), hint: "Intensity Factor: отношение интенсивности к порогу (≈ NP/FTP). 0.6 восстановл., 0.85–0.95 темповая, ~1.0 соревновательная." },
          { label: "Нагрузка", value: isNum(row.training_load_score) ? row.training_load_score : "—", present: isNum(row.training_load_score), hint: "Training Load Score / TSS-подобная метрика суммарной нагрузки." },
        ];

        const visible = items.filter(i => i.present);
        if (visible.length === 0) return null;
        return (
          <section className="card p-4 overflow-visible">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visible.map((i, idx) => (
                <Metric key={`${i.label}-${idx}`} label={i.label} value={i.value} hint={i.hint} />
              ))}
            </div>
          </section>
        );
      })()}

      {/* HR ZONES + WEATHER (без Device/File — он ниже отдельным блоком) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {zonesData.length > 0 && (
          <div className="card p-4 overflow-visible">
            <div className="mb-3 font-semibold">Время в HR-зонах</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zonesData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <XAxis dataKey="zone" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: unknown) => [`${v as number} мин`, "Время"]} />
                  <Bar dataKey="min" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {weather && (
          <div className="card p-4 overflow-visible">
            <div className="mb-3 font-semibold">Погода</div>
            <div className="text-sm grid grid-cols-2 gap-2">
              {isNum(weather.temp_c) && <KV k="Температура" v={`${weather.temp_c} °C`} />}
              {isNum(weather.wind_kph) && <KV k="Ветер" v={`${weather.wind_kph} км/ч`} />}
              {isNum(weather.humidity) && <KV k="Влажность" v={`${weather.humidity}%`} />}
              {isNum(weather.pressure_hpa) && <KV k="Давление" v={`${weather.pressure_hpa} гПа`} />}
              {isStr(weather.conditions) && <KV k="Условия" v={weather.conditions} />}
            </div>
          </div>
        )}
      </section>

      {/* Note + Device/File */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NoteInline workoutId={workoutId} initial={row.description} />
        <DeviceFileBlock workoutId={workoutId} />
      </section>

      {/* Charts */}
      <WorkoutCharts workoutId={workoutId} />

      {/* Delete modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setPendingDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e)=>e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Удалить тренировку?</div>
            <div className="text-sm text-[var(--text-secondary)] mb-4">Это действие необратимо.</div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={()=>setPendingDelete(false)}>Отмена</button>
              <button className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={doDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ============ tiny ui parts ============ */
function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <AppTooltip content={hint || label}>
      <div className="group relative rounded-xl border p-3 overflow-visible cursor-help">
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
        <div className="mt-1 text-base font-semibold">{value}</div>
      </div>
    </AppTooltip>
  );
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)]">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}