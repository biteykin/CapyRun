// components/workouts/WorkoutEditForm.client.tsx
"use client";

// ⚠️ ВАЖНО: не трогаем импорты shadcn Select, как у вас уже подключено
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

// Служебное значение для пункта «— Не указан —»
// (Radix запрещает value="" у SelectItem)
const NONE_VALUE = "__none__";

function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToISO(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return d.toISOString();
}

type Workout = {
  id: string;
  user_id: string;
  start_time: string | null;
  local_date: string | null;
  uploaded_at: string | null;
  sport: string | null;
  sub_sport: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  calories_kcal: number | null;
  name: string | null;
  description?: string | null;
  visibility: string | null;
  weekday_iso: number | null;
};

export default function WorkoutEditForm({
  workout,
  initialSubOptions,
}: {
  workout: Workout;
  initialSubOptions: SubOpt[];
}) {
  const router = useRouter();

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Поля формы (инициализируем из props)
  const [name, setName] = useState<string>(workout.name ?? "");
  const [sport, setSport] = useState<string>((workout.sport || "run").toLowerCase());
  const [subSport, setSubSport] = useState<string>(workout.sub_sport ?? "");
  const [date, setDate] = useState<string>(isoToLocalInput(workout.start_time));
  const [distanceKm, setDistanceKm] = useState<number | "">(workout.distance_m != null ? +(workout.distance_m / 1000) : "");
  const [durationMin, setDurationMin] = useState<number | "">(workout.duration_sec != null ? Math.round(workout.duration_sec / 60) : "");
  const [calories, setCalories] = useState<number | "">(workout.calories_kcal ?? "");
  const [description, setDescription] = useState<string>(workout.description ?? "");

  const [subOptions, setSubOptions] = useState<SubOpt[]>(initialSubOptions || []);
  const [subsLoading, setSubsLoading] = useState(false);

  // Подгрузка подтипов при смене вида спорта
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSubsLoading(true);
      let opts: SubOpt[] = [];

      try {
        const { data, error } = await supabase
          .from("sport_subtypes")
          .select("*")
          .eq("sport", sport)
          .order("order", { ascending: true });

        if (!error && Array.isArray(data) && data.length) {
          opts = (data as any[]).map((r) => {
            const value =
              r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
            const label =
              r.name_ru ?? r.label_ru ?? r.title_ru ?? r.label ?? r.title ?? r.name ?? value;
            return value ? { value: String(value), label: String(label) } : null;
          }).filter(Boolean) as any[];
        }

        if (!opts.length) {
          const { data: d2 } = await supabase
            .from("workouts")
            .select("sub_sport")
            .eq("sport", sport)
            .not("sub_sport", "is", null)
            .limit(1000);
          if (d2) {
            const uniq = Array.from(new Set((d2 as any[]).map((x) => x.sub_sport).filter(Boolean)));
            opts = uniq.map((v) => ({ value: String(v), label: String(v) }));
          }
        }
      } catch {}

      if (!opts.length && SUB_FALLBACKS[sport]) {
        opts = SUB_FALLBACKS[sport].map((v) => ({ value: v, label: v }));
      }

      if (!cancelled) {
        setSubOptions(opts);
        setSubSport((curr) => (curr && !opts.find((o) => o.value === curr) ? "" : curr));
        setSubsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sport]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const patch: any = {
      name: name || null,
      sport: sport || null,
      sub_sport: subSport || null,
      start_time: localInputToISO(date),
      distance_m: distanceKm === "" ? null : Math.round(Number(distanceKm) * 1000),
      duration_sec: durationMin === "" ? null : Number(durationMin) * 60,
      calories_kcal: calories === "" ? null : Number(calories),
      description: description || null,
    };

    const { error } = await supabase.from("workouts").update(patch).eq("id", workout.id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.replace(`/workouts/${workout.id}`);
  }

  function onCancel() {
    router.back();
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4">
      {/* Название */}
      <label className="block space-y-1">
        <span className="text-sm">Название</span>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          placeholder="Лёгкий бег"
        />
      </label>

      {/* Дата и спорт */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm">Дата и время начала</span>
          <input
            className="input"
            type="datetime-local"
            value={date}
            onChange={(e)=>setDate(e.target.value)}
            required
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">Вид спорта</span>
            {/* стиль как в фильтре: h-9 w-44 + side="top" */}
            <Select value={sport} onValueChange={(v) => setSport(v)}>
              <SelectTrigger className="h-9 w-44" aria-label="Вид спорта">
                <SelectValue placeholder="Выберите вид спорта" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="run">Бег</SelectItem>
                <SelectItem value="ride">Вело</SelectItem>
                <SelectItem value="swim">Плавание</SelectItem>
                <SelectItem value="walk">Ходьба</SelectItem>
                <SelectItem value="hike">Хайк</SelectItem>
                <SelectItem value="row">Гребля</SelectItem>
                <SelectItem value="strength">Силовая</SelectItem>
                <SelectItem value="yoga">Йога</SelectItem>
                <SelectItem value="aerobics">Аэробика</SelectItem>
                <SelectItem value="crossfit">Кроссфит</SelectItem>
                <SelectItem value="pilates">Пилатес</SelectItem>
                <SelectItem value="other">Другая</SelectItem>
              </SelectContent>
            </Select>
          </label>

          {/* Подтип */}
          <label className="block space-y-1">
            <span className="text-sm">Подтип</span>
            {/* стиль как в фильтре: h-9 w-44 + side="top" */}
            {/* Мапим служебный NONE_VALUE <-> "" для соблюдения требований Radix */}
            <Select
              value={subSport === "" ? NONE_VALUE : subSport}
              onValueChange={(v) => setSubSport(v === NONE_VALUE ? "" : v)}
            >
              <SelectTrigger className="h-9 w-44" aria-label="Подтип">
                <SelectValue placeholder="— Не указан —" />
              </SelectTrigger>
              <SelectContent side="top">
                {/* ВАЖНО: value НЕ может быть пустой строкой */}
                <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                {subOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {subsLoading && <div className="text-xs text-[var(--text-secondary)]">Загружаем подтипы…</div>}
          </label>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-sm">Дистанция (км)</span>
          <input
            className="input"
            type="number"
            step="0.01"
            value={distanceKm}
            onChange={(e)=>setDistanceKm(e.target.value==="" ? "" : Number(e.target.value))}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Время (мин)</span>
          <input
            className="input"
            type="number"
            step="1"
            value={durationMin}
            onChange={(e)=>setDurationMin(e.target.value==="" ? "" : Number(e.target.value))}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Калории (ккал)</span>
          <input
            className="input"
            type="number"
            step="1"
            value={calories}
            onChange={(e)=>setCalories(e.target.value==="" ? "" : Number(e.target.value))}
          />
        </label>
      </div>

      {/* Заметка */}
      <label className="block space-y-1">
        <span className="text-sm">Заметка</span>
        <textarea
          className="input min-h-[90px]"
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
          placeholder="Как прошло, ощущения и т.п."
        />
      </label>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="flex items-center justify-start gap-2">
        <Button
          type="submit"
          variant="primary"
          className="h-10 px-4"
          disabled={saving}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-10 px-4"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}