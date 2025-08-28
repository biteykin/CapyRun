"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const r = useRouter();
  const [row, setRow] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { r.push("/login"); return; }
      const { data, error } = await supabase.from("workouts").select("*").eq("id", id).single();
      if (error) { setErr(error.message); return; }
      setRow(data);
    })();
  }, [id, r]);

  if (err) return <div className="text-red-400">Ошибка: {err}</div>;
  if (!row) return null;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">{row.filename}</h1>
      <div className="text-sm text-neutral-400 mb-4">{row.uploaded_at}</div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-xs text-neutral-400">Вид спорта</div><div>{row.sport ?? "—"}</div></div>
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-xs text-neutral-400">Дистанция</div><div>{row.distance_m ? (row.distance_m/1000).toFixed(2)+" км" : "—"}</div></div>
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-xs text-neutral-400">Длительность</div><div>{row.duration_sec ? Math.floor(row.duration_sec/60)+" мин" : "—"}</div></div>
      </div>

      <h2 className="text-lg font-semibold mb-2">fit_summary</h2>
      <pre className="text-xs bg-neutral-900/60 border border-white/10 rounded-lg p-3 overflow-x-auto">
        {JSON.stringify(row.fit_summary ?? {}, null, 2)}
      </pre>
    </div>
  );
}
