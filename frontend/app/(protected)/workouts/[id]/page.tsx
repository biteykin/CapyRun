"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import WorkoutCharts from "@/components/workouts/WorkoutCharts";

// ===== helpers: форматирование =====
const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сент","окт","ноя","дек"];
const WD_RU = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

function fmtDateFancy(local_date?: string | null, start_time?: string | null, tz?: string | null) {
  let d: Date | null = null;
  if (local_date) d = new Date(`${local_date}T00:00:00`);
  else if (start_time) d = new Date(start_time);
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
  if (m == null) return "—";
  const km = m / 1000;
  const decimals = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(decimals).replace(".", ",")} км`;
}
function fmtM(m?: number | null) {
  if (m == null) return "—";
  return `${m} м`;
}
function fmtDuration(sec?: number | null) {
  if (sec == null) return "—";
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtPace(secPerKm?: number | null) {
  if (!secPerKm) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2,"0")} /км`;
}
function fmtSwimPace(secPer100?: number | null) {
  if (!secPer100) return "—";
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${String(s).padStart(2,"0")} /100м`;
}
function fmtSpeedKmh(distance_m?: number | null, time_sec?: number | null) {
  if (!distance_m || !time_sec || time_sec <= 0) return "—";
  const kmh = (distance_m / 1000) / (time_sec / 3600);
  const decimals = kmh >= 100 ? 0 : kmh >= 10 ? 1 : 2;
  return `${kmh.toFixed(decimals).replace(".", ",")} км/ч`;
}
function bytesHuman(b?: number | null) {
  if (!b) return "—";
  const u = ["Б","КБ","МБ","ГБ"];
  let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  const dec = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(dec)} ${u[i]}`;
}
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

// --- presence helpers ---
const isNum = (v: any) => typeof v === "number" && !Number.isNaN(v);
const isBool = (v: any) => typeof v === "boolean";
const isStr = (v: any) => typeof v === "string" && v.trim().length > 0;
const isObjNonEmpty = (v: any) => v && typeof v === "object" && Object.keys(v).length > 0;

// --- default hints (fallback) ---
const DEFAULT_HINTS: Record<string, { title: string; content: string }> = {
  distance_m: { title: "Дистанция", content: "Полная длина маршрута. Показывается в километрах." },
  duration_sec: { title: "Время", content: "Полная длительность сессии (включая остановки, если не указано иное)." },
  moving_time_sec: { title: "Время в движении", content: "Суммарное время, когда устройство фиксировало движение." },
  avg_pace_s_per_km: { title: "Темп", content: "Среднее время на 1 км (м:с/км). Актуально для бега/ходьбы." },
  speed_kmh: { title: "Скорость", content: "Средняя скорость (км/ч), считается по дистанции и времени." },
  elev_gain_m: { title: "Подъём", content: "Сумма набранной высоты за тренировку." },
  elev_loss_m: { title: "Спуск", content: "Сумма потерянной высоты за тренировку." },
  calories_kcal: { title: "Калории", content: "Оценка энергозатрат по устройству/алгоритму." },
  hr_avg_max: { title: "Пульс", content: "Средний и максимальный ЧСС (уд/мин)." },
  power_triplet: { title: "Мощность", content: "Средняя / Нормализованная (NP) / Максимальная мощность (Вт)." },
  cadence_spm: { title: "Каденс (шаг)", content: "Средняя частота шага, шагов в минуту (бег/ходьба)." },
  cadence_rpm: { title: "Каденс (rpm)", content: "Средняя частота педалирования, оборотов в минуту (вело)." },
  swim_pace_100m: { title: "Плав. темп", content: "Среднее время на 100 м (м:с/100м)." },
  pool_length_m: { title: "Бассейн", content: "Длина бассейна (м) для расчётов." },
  swim_stroke_primary: { title: "Стиль", content: "Основной стиль плавания: вольный, баттерфляй и т.д." },
  swim_swolf_avg: { title: "SWOLF", content: "Индекс эффективности плавания: время дорожки + число гребков." },
  perceived_exertion: { title: "RPE", content: "Субъективная оценка усилия по шкале 1–10." },
  trimp: { title: "TRIMP", content: "Тренировочный импульс по ЧСС: длительность×интенсивность." },
  ef: { title: "EF", content: "Efficiency Factor: соотношение темпа/мощности к ЧСС." },
  pa_hr_pct: { title: "PA:HR", content: "Aerobic decoupling — рост темпа/мощности относительно ЧСС (%)." },
  intensity_factor: { title: "IF", content: "Интенсивность относительно функционального порога (FTP/LTHR)." },
  training_load_score: { title: "Нагрузка", content: "Обобщённый TSS-подобный показатель нагрузки." },
  hr_zone_time: { title: "HR-зоны", content: "Суммарное время в ЧСС-зонах, мин." },
  weather: { title: "Погода", content: "Температура, ветер, влажность, и др. на момент тренировки." },
  device_info: { title: "Устройства", content: "Источник данных: часы, датчики, файл FIT." },
  fit_summary: { title: "FIT-сводка", content: "Техническая сводка парсинга FIT/импорта." },
};

// --- hints from DB (optional) ---
type HintRow = { key: string; title: string; content: string; lang?: string | null };

// ===== тип (минимальный) =====
type Workout = {
  id: string;
  user_id: string;
  name: string | null;
  description: string | null;
  source: string | null;            // fit | manual | strava | ...
  sport: string | null;
  sub_sport: string | null;
  visibility: string | null;        // private | unlisted | public
  start_time: string | null;
  timezone_at_start: string | null;
  local_date: string | null;
  uploaded_at: string | null;
  storage_path: string | null;
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
  device_info: any | null; // jsonb
  weather: any | null;     // jsonb
  hr_zone_time: any | null; // jsonb e.g. {"Z1":1200,"Z2":1800}
  fit_summary: any | null;
  perceived_exertion: number | null;
  has_gps: boolean | null;
  avg_swim_pace_s_per_100m: number | null;
  swim_pool_length_m: number | null;
  swim_stroke_primary: string | null;
  swim_swolf_avg: number | null;
  created_at: string;
  updated_at: string;
};

// ===== страница =====
export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const [hints, setHints] = useState<Record<string, { title: string; content: string }>>(DEFAULT_HINTS);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("workouts")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        setRow(data as Workout);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id || null;
        const { data, error } = await supabase
          .from("hints")
          .select("key,title,content,lang,user_id,visibility")
          .in("visibility", ["public"])
          .eq("lang", "ru");
        if (!error && data) {
          const map: Record<string, { title: string; content: string }> = { ...DEFAULT_HINTS };
          for (const h of data as any as HintRow[]) {
            map[h.key] = { title: h.title, content: h.content };
          }
          setHints(map);
        }
        // (опционально) затем подтянуть персональные override:
        if (uid) {
          const { data: mine } = await supabase
            .from("hints")
            .select("key,title,content,lang,user_id,visibility")
            .eq("lang", "ru")
            .eq("user_id", uid)
            .in("visibility", ["private"]);
          if (mine) {
            setHints(prev => {
              const m = { ...prev };
              for (const h of mine as any as HintRow[]) m[h.key] = { title: h.title, content: h.content };
              return m;
            });
          }
        }
      } catch { /* no-op */ }
    })();
  }, []);

  const zonesData = useMemo(() => {
    const z = row?.hr_zone_time || null;
    if (!z || typeof z !== "object") return [];
    // в минутах
    return Object.entries(z).map(([k, v]) => ({
      zone: String(k),
      min: Math.round(Number(v as any) / 60),
    }));
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
            {row.sport && <Badge>{humanSport(row.sport)}{row.sub_sport ? ` • ${row.sub_sport}` : ""}</Badge>}
            {row.visibility && <Badge>Видимость: {row.visibility}</Badge>}
            {row.source && <Badge>Источник: {row.source}</Badge>}
            {row.laps_count != null && <Badge>Круги: {row.laps_count}</Badge>}
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
        const computedSpeed = fmtSpeedKmh(row.distance_m ?? undefined, (row.moving_time_sec ?? row.duration_sec) ?? undefined);

        const items: Array<{ label: string; value: React.ReactNode; present: boolean; hint: string }> = [
          { label: "Дистанция", value: fmtKm(row.distance_m), present: isNum(row.distance_m), hint: "distance_m" },
          { label: "Время", value: fmtDuration(row.duration_sec), present: isNum(row.duration_sec), hint: "duration_sec" },
          { label: "В движении", value: fmtDuration(row.moving_time_sec), present: isNum(row.moving_time_sec), hint: "moving_time_sec" },
          { label: showRunPace ? "Темп" : "Скорость", value: showRunPace ? fmtPace(row.avg_pace_s_per_km ?? undefined) : computedSpeed,
            present: showRunPace ? isNum(row.avg_pace_s_per_km) : (computedSpeed !== "—"), hint: showRunPace ? "avg_pace_s_per_km" : "speed_kmh" },
          { label: "Подъём", value: fmtM(row.elev_gain_m), present: isNum(row.elev_gain_m), hint: "elev_gain_m" },
          { label: "Спуск", value: fmtM(row.elev_loss_m), present: isNum(row.elev_loss_m), hint: "elev_loss_m" },
          { label: "Ккал", value: row.calories_kcal ?? "—", present: isNum(row.calories_kcal), hint: "calories_kcal" },
          { label: "Пульс ср/макс", value: `${row.avg_hr ?? "—"} / ${row.max_hr ?? "—"} bpm`, present: isNum(row.avg_hr) || isNum(row.max_hr), hint: "hr_avg_max" },
          { label: "Мощность ср/NP/макс",
            value: `${row.avg_power_w ?? "—"} / ${row.np_power_w ?? "—"} / ${row.max_power_w ?? "—"} W`,
            present: isNum(row.avg_power_w) || isNum(row.np_power_w) || isNum(row.max_power_w), hint: "power_triplet" },
          { label: "Каденс (шаг)", value: row.avg_cadence_spm ?? "—", present: isNum(row.avg_cadence_spm), hint: "cadence_spm" },
          { label: "Каденс (rpm)", value: row.avg_cadence_rpm ?? "—", present: isNum(row.avg_cadence_rpm), hint: "cadence_rpm" },
          { label: "SWOLF ср", value: row.swim_swolf_avg ?? "—", present: isNum(row.swim_swolf_avg), hint: "swim_swolf_avg" },
          { label: "Плав. темп", value: fmtSwimPace(row.avg_swim_pace_s_per_100m ?? undefined), present: isNum(row.avg_swim_pace_s_per_100m), hint: "swim_pace_100m" },
          { label: "Бассейн", value: row.swim_pool_length_m ? `${row.swim_pool_length_m} м` : "—", present: isNum(row.swim_pool_length_m), hint: "pool_length_m" },
          { label: "Стиль", value: row.swim_stroke_primary ?? "—", present: isStr(row.swim_stroke_primary), hint: "swim_stroke_primary" },
          { label: "RPE", value: row.perceived_exertion ?? "—", present: isNum(row.perceived_exertion), hint: "perceived_exertion" },
          { label: "TRIMP", value: row.trimp ?? "—", present: isNum(row.trimp), hint: "trimp" },
          { label: "EF", value: row.ef ?? "—", present: isNum(row.ef), hint: "ef" },
          { label: "PA:HR", value: row.pa_hr_pct != null ? `${row.pa_hr_pct}%` : "—", present: isNum(row.pa_hr_pct), hint: "pa_hr_pct" },
          { label: "IF", value: row.intensity_factor ?? "—", present: isNum(row.intensity_factor), hint: "intensity_factor" },
          { label: "Нагрузка", value: row.training_load_score ?? "—", present: isNum(row.training_load_score), hint: "training_load_score" },
        ];

        const visible = items.filter(i => i.present);
        if (visible.length === 0) return null;

        return (
          <section className="card p-4 overflow-visible">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visible.map(i => (
                <Metric key={i.hint} label={i.label} value={i.value} hint={hints[i.hint]} />
              ))}
            </div>
          </section>
        );
      })()}

      {/* HR ZONES + WEATHER/DEVICE */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HR Zones */}
        {zonesData.length > 0 && (
          <div className="card p-4 relative group overflow-visible">
            {/* тултип при наведении на карточку */}
            {hints.hr_zone_time && (
              <div className="pointer-events-none absolute right-3 top-3 z-50 hidden w-72 rounded-xl border bg-white p-2 text-xs text-[var(--text)] shadow group-hover:block">
                <div className="font-semibold mb-1">{hints.hr_zone_time.title}</div>
                <div className="opacity-80">{hints.hr_zone_time.content}</div>
              </div>
            )}
            <div className="mb-3 font-semibold">Время в HR-зонах</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zonesData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <XAxis dataKey="zone" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: any) => [`${v} мин`, "Время"]} />
                  <Bar dataKey="min" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weather */}
        {isObjNonEmpty(row.weather) && (
          <div className="card p-4 relative group overflow-visible">
            {hints.weather && (
              <div className="pointer-events-none absolute right-3 top-3 z-50 hidden w-72 rounded-xl border bg-white p-2 text-xs text-[var(--text)] shadow group-hover:block">
                <div className="font-semibold mb-1">{hints.weather.title}</div>
                <div className="opacity-80">{hints.weather.content}</div>
              </div>
            )}
            <div className="mb-3 font-semibold">Погода</div>
            <div className="text-sm grid grid-cols-2 gap-2">
              {"temp_c" in row.weather && <KV k="Температура" v={`${row.weather.temp_c} °C`} />}
              {"wind_kph" in row.weather && <KV k="Ветер" v={`${row.weather.wind_kph} км/ч`} />}
              {"humidity" in row.weather && <KV k="Влажность" v={`${row.weather.humidity}%`} />}
              {"pressure_hpa" in row.weather && <KV k="Давление" v={`${row.weather.pressure_hpa} гПа`} />}
              {"conditions" in row.weather && <KV k="Условия" v={`${row.weather.conditions}`} />}
            </div>
          </div>
        )}

        {/* Device / File */}
        {(isObjNonEmpty(row.device_info) || isStr(row.filename) || isNum(row.size_bytes) || isStr(row.storage_path) || isStr(row.uploaded_at)) && (
          <div className="card p-4 relative group overflow-visible">
            {hints.device_info && (
              <div className="pointer-events-none absolute right-3 top-3 z-50 hidden w-72 rounded-xl border bg-white p-2 text-xs text-[var(--text)] shadow group-hover:block">
                <div className="font-semibold mb-1">{hints.device_info.title}</div>
                <div className="opacity-80">{hints.device_info.content}</div>
              </div>
            )}
            <div className="mb-3 font-semibold">Устройство и файл</div>
            <div className="text-sm grid grid-cols-2 gap-2">
              {row.device_info?.watch && <KV k="Устройство" v={row.device_info.watch} />}
              {row.device_info?.hrm && <KV k="HRM" v={row.device_info.hrm} />}
              {row.uploaded_at && <KV k="Загружено" v={new Date(row.uploaded_at).toLocaleString()} />}
              {row.filename && <KV k="Файл" v={row.filename} />}
              {isNum(row.size_bytes) && <KV k="Размер" v={bytesHuman(row.size_bytes)} />}
              {row.storage_path && <KV k="Путь" v={row.storage_path} />}
            </div>
          </div>
        )}
      </section>

      {/* Description / Notes / FIT summary */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <div className="mb-2 font-semibold">Заметка</div>
          <div className="text-sm whitespace-pre-wrap">{row.description || "—"}</div>
        </div>
        {isObjNonEmpty(row.fit_summary) && (
          <div className="card p-4 relative group">
            {hints.fit_summary && (
              <div className="pointer-events-none absolute right-3 top-3 z-10 hidden w-72 rounded-xl border bg-white p-2 text-xs text-[var(--text)] shadow group-hover:block">
                <div className="font-semibold mb-1">{hints.fit_summary.title}</div>
                <div className="opacity-80">{hints.fit_summary.content}</div>
              </div>
            )}
            <div className="mb-2 font-semibold">FIT / сводка импорта</div>
            <pre className="text-xs overflow-auto max-h-64 bg-[var(--color-bg-fill-tertiary)] rounded-xl p-3">
              {JSON.stringify(row.fit_summary, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* WorkoutCharts block */}
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
// ===== мелкие компоненты =====
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: { title: string; content: string } | null;
}) {
  return (
    <div className="group relative rounded-xl border p-3 overflow-visible">
      {/* тултип появляется РЯДОМ с блоком при наведении на блок */}
      {hint && (
        <div className="pointer-events-none absolute left-full top-1/2 z-50 hidden w-64 -translate-y-1/2 ml-2 rounded-xl border bg-white p-2 text-xs text-[var(--text)] shadow group-hover:block">
          <div className="font-semibold mb-1">{hint.title}</div>
          <div className="opacity-80">{hint.content}</div>
        </div>
      )}
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
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
