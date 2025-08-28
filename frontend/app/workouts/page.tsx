"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { fmtKm, fmtMin } from "@/utils/fmt";

type Workout = {
  id: string;
  filename: string | null;
  sport: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  uploaded_at: string | null;
};

export default function WorkoutsPage() {
  const r = useRouter();
  const [rows, setRows] = useState<Workout[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { r.push("/login"); return; }
      const { data, error } = await supabase
        .from("workouts")
        .select("id, filename, sport, duration_sec, distance_m, uploaded_at")
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (error) { setErr(error.message); return; }
      setRows(data || []);
    })();
  }, [r]);

  if (err) return <div className="text-red-400">Ошибка: {err}</div>;
  if (rows === null) return null;
  if (!rows.length) return <div className="text-neutral-400">Пока нет сохранённых тренировок.</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Мои тренировки</h1>
      <div className="divide-y divide-white/10 rounded-lg border border-white/10">
        {rows.map((w) => (
          <a
            key={w.id}
            href={`/workouts/${w.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
          >
            <div className="font-medium">{w.filename}</div>
            <div className="text-sm text-neutral-400 flex gap-4">
              <span>{w.sport ?? "—"}</span>
              <span>{fmtKm(w.distance_m)}</span>
              <span>{fmtMin(w.duration_sec)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
