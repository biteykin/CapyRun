"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

type DayRow = { d: string; workouts: number; time_sec: number; distance_m: number; kcal: number };
type WeekRow = { week_start: string; workouts: number; time_sec: number; distance_m: number };
type WdRow = { dow: number; workouts: number; time_sec: number };
type HourRow = { hh: number; workouts: number };
type MixRow = { sport: string; workouts: number; time_sec: number };
type KcalWdRow = { dow: number; kcal: number };

const DOW_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export default function MyWorkoutsDashboard({ daysDefault = 30 }: { daysDefault?: number }) {
  const [days, setDays] = useState(daysDefault);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [daysData, setDaysData] = useState<DayRow[]>([]);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [wd, setWd] = useState<WdRow[]>([]);
  const [hours, setHours] = useState<HourRow[]>([]);
  const [mix, setMix] = useState<MixRow[]>([]);
  const [kcalWd, setKcalWd] = useState<KcalWdRow[]>([]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [a,b,c,d,e,f] = await Promise.all([
          supabase.rpc("dash_fast_days", { days }),
          supabase.rpc("dash_fast_weeks", { weeks: 12 }),
          supabase.rpc("dash_fast_weekday", { days }),
          supabase.rpc("dash_fast_starts_hour", { days }),
          supabase.rpc("dash_fast_sport_mix", { days }),
          supabase.rpc("dash_fast_kcal_weekday", { days }),
        ]);
        if (canceled) return;
        if (a.error) throw a.error; if (b.error) throw b.error; if (c.error) throw c.error;
        if (d.error) throw d.error; if (e.error) throw e.error; if (f.error) throw f.error;

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
    return () => { canceled = true; };
  }, [days]);

  // KPI
  const kpi = useMemo(() => {
    const W = daysData.reduce((s,x)=>s+x.workouts,0);
    const T = daysData.reduce((s,x)=>s+x.time_sec,0);
    const D = daysData.reduce((s,x)=>s+Number(x.distance_m||0),0);
    const K = daysData.reduce((s,x)=>s+Number(x.kcal||0),0);
    return { workouts: W, time_sec: T, distance_m: D, kcal: K };
  }, [daysData]);

  return (
    <section className="space-y-6">
      {/* Переключатель периода */}
      <div className="flex items-center gap-2">
        <div className="font-semibold">Период:</div>
        {[7,30,90].map(n => (
          <button
            key={n}
            className={`btn btn-sm ${days===n ? "btn-primary" : "btn-ghost"}`}
            onClick={()=>setDays(n)}
          >{n} дн.</button>
        ))}
        {loading && <span className="text-sm text-[var(--text-secondary)]">Обновляем…</span>}
        {err && <span className="text-sm text-red-600">Ошибка: {err}</span>}
      </div>

      {/* 1) KPI + спарклайн (время по дням) */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Тренировки" value={kpi.workouts} />
          <KPI label="Время" value={fmtTime(kpi.time_sec)} />
          <KPI label="Дистанция" value={fmtKm(kpi.distance_m)} />
          <KPI label="Калории" value={fmtKcal(kpi.kcal)} />
        </div>
        <div className="h-28 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daysData.map(d=>({ d: d.d, time_h: Math.round((d.time_sec/3600)*100)/100 }))}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:any)=>[`${v} ч`, "Время"]} />
              <Area type="monotone" dataKey="time_h" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2) Неделя за неделей (время) */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">Неделя за неделей</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks.map(w=>({ w: w.week_start, hours: +(w.time_sec/3600).toFixed(2) }))}>
              <XAxis dataKey="w" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:any)=>[`${v} ч`, "Время"]} />
              <Bar dataKey="hours" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3) Дни недели: время + количество */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">Дни недели</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wd.map(x=>({ d: DOW_RU[(x.dow-1+7)%7], h: +(x.time_sec/3600).toFixed(2), c: x.workouts }))}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:any, name:any)=> name==="h" ? [`${v} ч`, "Время"] : [v, "Сессии"]} />
              <Bar yAxisId="left" dataKey="h" radius={[6,6,0,0]} />
              <Bar yAxisId="right" dataKey="c" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4) Время суток (гистограмма стартов) */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">Время стартов</div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours.map(x=>({ h: `${x.hh}:00`, c: x.workouts }))}>
              <XAxis dataKey="h" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:any)=>[v, "Стартов"]} />
              <Bar dataKey="c" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5) Микс спорта (по времени) */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">Микс видов спорта (по времени)</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mix.map(m=>({ name: prettySport(m.sport), value: Math.max(0, m.time_sec) }))}
                   dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {mix.map((_, i) => <Cell key={i} />)}
              </Pie>
              <Tooltip formatter={(v:any)=>[fmtTime(Number(v)), "Время"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6) Калории по дням недели */}
      <div className="card p-4">
        <div className="mb-2 font-semibold">Калории по дням недели</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kcalWd.map(x=>({ d: DOW_RU[(x.dow-1+7)%7], k: Math.round(Number(x.kcal||0)) }))}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(v:any)=>[`${v} ккал`, "Калории"]} />
              <Bar dataKey="k" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

/* ---- UI bits ---- */
function KPI({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
function fmtTime(sec: number) {
  const h = Math.floor(sec/3600); const m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtKm(m: number) {
  const km = m/1000; const d = km>=100?0:km>=10?1:2;
  return `${km.toFixed(d)} км`;
}
function fmtKcal(k: number) { return `${Math.round(k)} ккал`; }
function prettySport(s: string) {
  const m: Record<string,string> = { run:"Бег", ride:"Вело", swim:"Плавание", walk:"Ходьба", hike:"Хайк", row:"Гребля", strength:"Силовая", yoga:"Йога", aerobics:"Аэробика", crossfit:"Кроссфит", pilates:"Пилатес", other:"Другая" };
  return m[s] || s;
}