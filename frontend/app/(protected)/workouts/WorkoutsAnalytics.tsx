"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

type W = { id: string; date?: string | null; calories?: number | null; duration_min?: number | null };

export default function WorkoutsAnalytics() {
  const [rows, setRows] = useState<W[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { setRows([]); setLoading(false); return; }
      // последние ~60 дней
      const since = new Date(); since.setDate(since.getDate() - 60);
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", uid)
        .gte("date", since.toISOString())
        .order("date", { ascending: true });
      setRows((data as W[]) || []);
      setLoading(false);
    })();
  }, []);

  const weeks = useMemo(() => bucketWeeks(rows), [rows]);
  const calories = sumBy(rows, r => r.calories ?? 0);
  const minutes = sumBy(rows, r => r.duration_min ?? 0);

  if (loading) return <div className="card p-6 text-sm text-[var(--text-secondary)]">Аналитика загружается…</div>;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="card p-5">
        <div className="h-display font-semibold">Общее</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">
          Последние 60 дней: {rows.length} тренировок
          {minutes ? <> · {minutes} мин</> : null}
          {calories ? <> · {calories} ккал</> : null}
        </div>
        <MiniBars data={weeks.map(w => ({ label: w.label, value: w.count }))} unit="трен." />
      </div>

      <div className="card p-5">
        <div className="h-display font-semibold">Мини-прогресс</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">Неделя за неделей</div>
        <MiniBars data={weeks.map(w => ({ label: w.label, value: w.count }))} />
      </div>

      <div className="card p-5">
        <div className="h-display font-semibold">Фокус</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">
          Дальше подключим VO₂max, пульс и силовые метрики из файлов <code>.fit</code>
        </div>
      </div>
    </section>
  );
}

function bucketWeeks(rows: W[]) {
  // группируем по понедельникам
  const map = new Map<string,{label:string,count:number}>();
  rows.forEach(r => {
    if (!r.date) return;
    const d = new Date(r.date);
    const monday = startOfISOWeek(d); // YYYY-MM-DD
    const label = fmtWeekLabel(new Date(monday));
    const prev = map.get(monday)?.count ?? 0;
    map.set(monday, { label, count: prev + 1 });
  });
  // последние 8 недель
  return Array.from(map.entries()).sort((a,b)=>a[0]<b[0]? -1:1).slice(-8).map(([,v])=>v);
}

function startOfISOWeek(d: Date) {
  const day = d.getDay(); // 0..6, 1=Mon
  const diff = (day === 0 ? -6 : 1 - day);
  const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()+diff);
  return x.toISOString().slice(0,10);
}
function fmtWeekLabel(d: Date) {
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = ["01","02","03","04","05","06","07","08","09","10","11","12"][d.getMonth()];
  return `${dd}.${mm}`;
}
function sumBy<T>(arr: T[], pick: (x:T)=>number) { return Math.round(arr.reduce((s,x)=>s+pick(x),0)); }

function MiniBars({ data, unit }: { data: {label:string; value:number}[]; unit?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="mt-4">
      <div className="flex items-end gap-2 h-28">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="w-6 rounded-t-md"
              style={{
                height: `${Math.max(4, Math.round((d.value/max)*100))}%`,
                background: "linear-gradient(180deg,#FFD699,#DF6133)"
              }}
              title={`${d.value}${unit?` ${unit}`:""}`}
            />
            <div className="text-[10px] text-[var(--text-secondary)]">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}