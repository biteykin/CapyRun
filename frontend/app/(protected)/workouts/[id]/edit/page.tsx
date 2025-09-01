"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function WorkoutEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>("");
  const [type, setType] = useState("run");
  const [duration, setDuration] = useState<number | "">("");
  const [distance, setDistance] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("workouts").select("*").eq("id", id).single();
      if (error) setError(error.message);
      if (data) {
        setDate(new Date(data.date).toISOString().slice(0,16));
        setType(data.type || "run");
        setDuration(data.duration_min ?? "");
        setDistance(data.distance_km ?? "");
        setCalories(data.calories ?? "");
      }
      setLoading(false);
    })();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const { error } = await supabase.from("workouts").update({
      date: new Date(date).toISOString(),
      type,
      duration_min: duration === "" ? null : Number(duration),
      distance_km: distance === "" ? null : Number(distance),
      calories: calories === "" ? null : Number(calories),
    }).eq("id", id);
    if (error) { setError(error.message); setSaving(false); return; }
    router.replace(`/workouts/${id}`);
  }

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем…</div>;

  return (
    <main className="max-w-xl space-y-5">
      <h1 className="h-display text-2xl font-extrabold">Редактировать тренировку</h1>
      <form onSubmit={save} className="card p-5 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm">Дата и время</span>
          <input className="input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Тип</span>
          <select className="input" value={type} onChange={e=>setType(e.target.value)}>
            <option value="run">Бег</option><option value="bike">Велосипед</option><option value="swim">Плавание</option>
            <option value="strength">Силовая</option><option value="fitness">Фитнес</option><option value="padel">Падел</option>
            <option value="other">Другая</option>
          </select>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block space-y-1"><span className="text-sm">Дистанция (км)</span>
            <input className="input" type="number" step="0.01" value={distance}
              onChange={e=>setDistance(e.target.value===""? "": Number(e.target.value))} /></label>
          <label className="block space-y-1"><span className="text-sm">Время (мин)</span>
            <input className="input" type="number" step="1" value={duration}
              onChange={e=>setDuration(e.target.value===""? "": Number(e.target.value))} /></label>
          <label className="block space-y-1"><span className="text-sm">Калории</span>
            <input className="input" type="number" step="1" value={calories}
              onChange={e=>setCalories(e.target.value===""? "": Number(e.target.value))} /></label>
        </div>

        {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span><div>{error}</div></div>}

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving}>{saving? "Сохраняем…":"Сохранить"}</button>
          <button type="button" className="btn btn-ghost" onClick={()=>router.back()}>Отмена</button>
        </div>
      </form>
    </main>
  );
}