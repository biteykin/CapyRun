"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

// используем ВАШ рабочий shadcn select
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SubOpt = { value: string; label: string };

const SUB_FALLBACKS: Record<string, string[]> = {
  run: ["road","trail","treadmill","track","indoor"],
  ride: ["road","gravel","mtb","indoor","trainer"],
  swim: ["pool","open_water"],
  walk: ["outdoor","indoor","treadmill"],
  hike: ["trail","mountain"],
  row: ["indoor","water"],
  strength: ["barbell","dumbbell","machine","bodyweight"],
  yoga: ["hatha","vinyasa","yin","ashtanga"],
  aerobics: ["step","dance","hi-lo"],
  crossfit: ["metcon","amrap","emom"],
  pilates: ["mat","reformer"],
  other: [],
};

const SPORT_LABEL: Record<string,string> = {
  run:"Бег", ride:"Вело", swim:"Плавание", walk:"Ходьба", hike:"Хайк", row:"Гребля",
  strength:"Силовая", yoga:"Йога", aerobics:"Аэробика", crossfit:"Кроссфит", pilates:"Пилатес", other:"Другая",
};

// Radix запрещает пустую строку в value у SelectItem
// используем служебный маркер и мапим его <-> "" в состоянии
const NONE_VALUE = "__none__";

function localInputToISO(v: string) {
  if (!v) return null;
  const d = new Date(v); // local
  return d.toISOString(); // store UTC in start_time
}

function localDateFromInput(v: string) {
  if (!v) return null;
  const d = new Date(v);
  const pad = (n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export default function NewWorkoutPage() {
  const router = useRouter();

  // core fields (match new DB)
  const [name, setName] = useState("");
  const [sport, setSport] = useState("run");
  const [subSport, setSubSport] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,16)); // datetime-local
  const [distanceKm, setDistanceKm] = useState<number | "">("");
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const [description, setDescription] = useState("");

  // sport-specific optional fields
  const [poolLen, setPoolLen] = useState<number | "">(""); // swim_pool_length_m
  const [gymExercises, setGymExercises] = useState<number | "">("");
  const [gymSets, setGymSets] = useState<number | "">("");
  const [gymReps, setGymReps] = useState<number | "">("");
  const [gymVolume, setGymVolume] = useState<number | "">("");

  // sub-sport options
  const [subOptions, setSubOptions] = useState<SubOpt[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSubOptions(s: string) {
    setSubsLoading(true);
    let opts: SubOpt[] = [];

    // 1) reference table (adjust table/columns if your schema differs)
    try {
      const { data, error } = await supabase
        .from("sport_subtypes")
        .select("*")
        .eq("sport", s)
        .order("order", { ascending: true });
      if (!error && data?.length) {
        opts = (data as any[]).map(r => {
          const value = r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
          const label = r.name_ru ?? r.label_ru ?? r.title_ru ?? r.label ?? r.title ?? r.name ?? value;
          return { value: String(value), label: String(label) };
        }).filter(o => o.value);
      }
    } catch { /* ignore */ }

    // 2) distinct from existing workouts
    if (!opts.length) {
      const { data } = await supabase
        .from("workouts")
        .select("sub_sport")
        .eq("sport", s)
        .not("sub_sport", "is", null)
        .limit(500);
      if (data) {
        const uniq = Array.from(new Set((data as any[]).map(x => x.sub_sport).filter(Boolean)));
        opts = uniq.map(v => ({ value: String(v), label: String(v) }));
      }
    }

    // 3) fallbacks
    if (!opts.length) {
      opts = (SUB_FALLBACKS[s] || []).map(v => ({ value: v, label: v }));
    }

    setSubOptions(opts);
    setSubSport(curr => (curr && !opts.find(o => o.value === curr) ? "" : curr));
    setSubsLoading(false);
  }

  useEffect(() => { loadSubOptions(sport); }, [sport]);

  function SportSpecific() {
    if (sport === "swim") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">Дистанция (км)</span>
            <input className="input" type="number" step="0.01" value={distanceKm}
                   onChange={e=>setDistanceKm(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Время (мин)</span>
            <input className="input" type="number" step="1" value={durationMin}
                   onChange={e=>setDurationMin(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Калории (ккал)</span>
            <input className="input" type="number" step="1" value={calories}
                   onChange={e=>setCalories(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1 md:col-span-3">
            <span className="text-sm">Длина бассейна (м)</span>
            <input className="input" type="number" step="1" value={poolLen}
                   onChange={e=>setPoolLen(e.target.value===""? "": Number(e.target.value))} />
          </label>
        </div>
      );
    }

    if (sport === "strength" || sport === "crossfit") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">Время (мин)</span>
            <input className="input" type="number" step="1" value={durationMin}
                   onChange={e=>setDurationMin(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Калории (ккал)</span>
            <input className="input" type="number" step="1" value={calories}
                   onChange={e=>setCalories(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Упражнений</span>
            <input className="input" type="number" step="1" value={gymExercises}
                   onChange={e=>setGymExercises(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Подходов</span>
            <input className="input" type="number" step="1" value={gymSets}
                   onChange={e=>setGymSets(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Повторений (всего)</span>
            <input className="input" type="number" step="1" value={gymReps}
                   onChange={e=>setGymReps(e.target.value===""? "": Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Объём (кг)</span>
            <input className="input" type="number" step="1" value={gymVolume}
                   onChange={e=>setGymVolume(e.target.value===""? "": Number(e.target.value))} />
          </label>
        </div>
      );
    }

    // default (run/ride/walk/hike/row/yoga/aerobics/pilates/other)
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-sm">Дистанция (км)</span>
          <input className="input" type="number" step="0.01" value={distanceKm}
                 onChange={e=>setDistanceKm(e.target.value===""? "": Number(e.target.value))} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Время (мин)</span>
          <input className="input" type="number" step="1" value={durationMin}
                 onChange={e=>setDurationMin(e.target.value===""? "": Number(e.target.value))} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Калории (ккал)</span>
          <input className="input" type="number" step="1" value={calories}
                 onChange={e=>setCalories(e.target.value===""? "": Number(e.target.value))} />
        </label>
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);

    const { data: u } = await supabase.auth.getUser();
    const user_id = u.user?.id;
    if (!user_id) { setError("Нет сессии"); setSaving(false); return; }

    const patch: any = {
      user_id,
      name: name || null,
      description: description || null,
      sport: sport || null,
      sub_sport: subSport || null,
      start_time: localInputToISO(date),
      local_date: localDateFromInput(date),
      distance_m: distanceKm === "" ? null : Math.round(Number(distanceKm) * 1000),
      duration_sec: durationMin === "" ? null : Number(durationMin) * 60,
      calories_kcal: calories === "" ? null : Number(calories),
    };

    if (sport === "swim") {
      patch.swim_pool_length_m = poolLen === "" ? null : Number(poolLen);
    }
    if (sport === "strength" || sport === "crossfit") {
      patch.gym_exercises_count = gymExercises === "" ? null : Number(gymExercises);
      patch.gym_sets_count = gymSets === "" ? null : Number(gymSets);
      patch.gym_reps_total = gymReps === "" ? null : Number(gymReps);
      patch.gym_volume_kg = gymVolume === "" ? null : Number(gymVolume);
    }

    const { error } = await supabase.from("workouts").insert([patch]);
    if (error) { setError(error.message); setSaving(false); return; }
    router.replace("/workouts");
  }

  return (
    <main className="w-full space-y-5">
      <h1 className="h-display text-2xl font-extrabold">Новая тренировка</h1>

      <form onSubmit={save} className="card p-5 space-y-4 w-full">
        {/* Title */}
        <label className="block space-y-1">
          <span className="text-sm">Название</span>
          <input className="input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Лёгкий бег" />
        </label>

        {/* Date and sport */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-sm">Дата и время начала</span>
            <input className="input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-sm">Вид спорта</span>
              {/* стиль как в фильтре: h-9 w-44 + side="top" */}
              <Select value={sport} onValueChange={(v)=>setSport(v)}>
                <SelectTrigger className="h-9 w-44" aria-label="Вид спорта">
                  <SelectValue placeholder="Выберите вид спорта" />
                </SelectTrigger>
                <SelectContent side="top">
                  {Object.keys(SPORT_LABEL).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SPORT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm">Подтип</span>
              {/* стиль как в фильтре: h-9 w-44 + side="top" + безопасный NONE_VALUE */}
              <Select
                value={subSport === "" ? NONE_VALUE : subSport}
                onValueChange={(v)=>setSubSport(v === NONE_VALUE ? "" : v)}
              >
                <SelectTrigger className="h-9 w-44" aria-label="Подтип">
                  <SelectValue placeholder="— Не указан —" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                  {subOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subsLoading && <div className="text-xs text-[var(--text-secondary)]">Загружаем подтипы…</div>}
            </label>
          </div>
        </div>

        {/* Sport-specific inputs */}
        <SportSpecific />

        {/* Note */}
        <label className="block space-y-1">
          <span className="text-sm">Заметка</span>
          <textarea className="input min-h-[90px]" value={description}
            onChange={(e)=>setDescription(e.target.value)} placeholder="Как прошло, ощущения и т.п." />
        </label>

        {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span><div>{error}</div></div>}

        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button variant="secondary" type="button" onClick={() => history.back()}>
            Отмена
          </Button>
        </div>
      </form>
    </main>
  );
}