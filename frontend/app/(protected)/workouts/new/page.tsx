"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function NewWorkoutPage() {
  const router = useRouter();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,16)); // datetime-local
  const [type, setType] = useState("run");
  const [duration, setDuration] = useState<number | "">("");
  const [distance, setDistance] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const { data: u } = await supabase.auth.getUser();
    const user_id = u.user?.id;
    if (!user_id) { setError("Нет сессии"); setSaving(false); return; }

    const { error } = await supabase.from("workouts").insert([{
      user_id,
      date: new Date(date).toISOString(),
      type,
      duration_min: duration === "" ? null : Number(duration),
      distance_km: distance === "" ? null : Number(distance),
      calories: calories === "" ? null : Number(calories),
    }]);
    if (error) { setError(error.message); setSaving(false); return; }
    router.replace("/workouts");
  }

  return (
    <main className="max-w-xl space-y-5">
      <h1 className="h-display text-2xl font-extrabold">Новая тренировка</h1>
      <form onSubmit={save} className="card p-5 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm">Дата и время</span>
          <input className="input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Тип</span>
          <select className="input" value={type} onChange={e=>setType(e.target.value)}>
            <option value="run">Бег</option>
            <option value="bike">Велосипед</option>
            <option value="swim">Плавание</option>
            <option value="strength">Силовая</option>
            <option value="fitness">Фитнес</option>
            <option value="padel">Падел</option>
            <option value="other">Другая</option>
          </select>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">Дистанция (км)</span>
            <input className="input" type="number" step="0.01" value={distance}
                   onChange={e=>setDistance(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Время (мин)</span>
            <input className="input" type="number" step="1" value={duration}
                   onChange={e=>setDuration(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Калории</span>
            <input className="input" type="number" step="1" value={calories}
                   onChange={e=>setCalories(e.target.value===""? "": Number(e.target.value))} />
          </label>
        </div>

        {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span><div>{error}</div></div>}

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving}>{saving? "Сохраняем…":"Сохранить"}</button>
          <button type="button" className="btn btn-ghost" onClick={()=>history.back()}>Отмена</button>
        </div>
      </form>
    </main>
  );
}