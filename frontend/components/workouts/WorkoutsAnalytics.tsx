"use client";

import { useMemo } from "react";

type WorkoutRow = {
  id: string;
  start_time: string;
  sport: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
};

type FileRow = {
  id: string;
  filename: string | null;
  uploaded_at: string;
};

export default function WorkoutsAnalytics({
  workouts,
  files,
}: {
  workouts: WorkoutRow[];
  files: FileRow[];
}) {
  const weeks = useMemo(() => bucketWeeks(workouts), [workouts]);
  const totalDuration = sumBy(workouts, r => r.duration_sec ?? 0);
  const totalDistance = sumBy(workouts, r => r.distance_m ?? 0);

  return (
    <section className="rounded-xl border p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="h-display font-semibold">Общее</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            {workouts.length} тренировок
            {totalDuration ? <> · {Math.round(totalDuration / 60)} мин</> : null}
            {totalDistance ? <> · {Math.round(totalDistance / 1000)} км</> : null}
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
      </div>
    </section>
  );
}

function bucketWeeks(rows: WorkoutRow[]) {
  // группируем по понедельникам
  const map = new Map<string,{label:string,count:number}>();
  rows.forEach(r => {
    if (!r.start_time) return;
    const d = new Date(r.start_time);
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