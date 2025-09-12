"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

// ===== Типы и дефолты для подтипов =====
type SubOpt = { value: string; label: string };

// Если таблица с подтипами временно недоступна — разумные дефолты
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

// ⇢ Хелпер: ISO → значение для <input type="datetime-local"> (локальное время)
function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ⇢ Хелпер: str из input → ISO (UTC)
function localInputToISO(v: string) {
  if (!v) return null;
  const d = new Date(v); // трактуется как локальное время
  return d.toISOString(); // сохраняем в UTC в колонку start_time
}

export default function WorkoutEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ⇢ Поля под нашу схему
  const [name, setName] = useState<string>("");
  const [sport, setSport] = useState<string>("run");
  const [subSport, setSubSport] = useState<string>("");
  const [date, setDate] = useState<string>("");          // datetime-local
  const [distanceKm, setDistanceKm] = useState<number | "">("");
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const [description, setDescription] = useState<string>(""); // опционально

  // --- State and loading subtypes ---
  const [subOptions, setSubOptions] = useState<SubOpt[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // универсальная загрузка подтипов из БД с fallback'ами
  async function loadSubOptions(s: string) {
    setSubsLoading(true);
    let opts: SubOpt[] = [];

    // 1) пробуем вашу справочную таблицу подтипов
    try {
      // 👇 если у вас другое имя — поменяйте 'sport_subtypes' один раз тут
      const { data, error } = await supabase
        .from("sport_subtypes")
        .select("*")
        .eq("sport", s)
        .order("order", { ascending: true }); // если нет колонки order — PostgREST проигнорит

      if (!error && Array.isArray(data) && data.length) {
        opts = (data as any[]).map((r) => {
          // максимально гибкое сопоставление колонок
          const value =
            r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
          const label =
            r.name_ru ?? r.label_ru ?? r.title_ru ?? r.label ?? r.title ?? r.name ?? value;
          return { value: String(value), label: String(label) };
        }).filter(o => o.value);
      }
    } catch { /* no-op */ }

    // 2) если справочник пуст, берём distinct из ваших тренировок
    if (!opts.length) {
      const { data } = await supabase
        .from("workouts")
        .select("sub_sport")
        .eq("sport", s)
        .not("sub_sport", "is", null)
        .limit(1000);
      if (data) {
        const uniq = Array.from(new Set((data as any[]).map((x) => x.sub_sport).filter(Boolean)));
        opts = uniq.map((v) => ({ value: String(v), label: String(v) }));
      }
    }

    // 3) дефолты на всякий
    if (!opts.length && SUB_FALLBACKS[s]) {
      opts = SUB_FALLBACKS[s].map((v) => ({ value: v, label: v }));
    }

    setSubOptions(opts);
    // если текущий подтип не входит в список — сбросим
    setSubSport((curr) => (curr && !opts.find((o) => o.value === curr) ? "" : curr));
    setSubsLoading(false);
  }

  // грузим при первой отрисовке и при смене вида спорта
  useEffect(() => { loadSubOptions(sport); /* eslint-disable-next-line */ }, [sport]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("workouts")
        .select("id, name, description, sport, sub_sport, start_time, distance_m, duration_sec, calories_kcal")
        .eq("id", id)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Пре-заполняем
      setName(data.name ?? "");
      setSport((data.sport || "run").toLowerCase());
      setSubSport(data.sub_sport ?? "");
      setDate(isoToLocalInput(data.start_time));

      setDistanceKm(data.distance_m != null ? +(data.distance_m / 1000) : "");
      setDurationMin(data.duration_sec != null ? Math.round(data.duration_sec / 60) : "");
      setCalories(data.calories_kcal ?? "");
      setDescription(data.description ?? "");
      setLoading(false);
    })();
  }, [id]);

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

    const { error } = await supabase.from("workouts").update(patch).eq("id", id);
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.replace(`/workouts/${id}`);
  }

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем…</div>;

  return (
    <main className="max-w-2xl space-y-5">
      <h1 className="h-display text-2xl font-extrabold">Редактировать тренировку</h1>

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
              <select className="input" value={sport} onChange={(e)=>setSport(e.target.value)}>
                <option value="run">Бег</option>
                <option value="ride">Вело</option>
                <option value="swim">Плавание</option>
                <option value="walk">Ходьба</option>
                <option value="hike">Хайк</option>
                <option value="row">Гребля</option>
                <option value="strength">Силовая</option>
                <option value="yoga">Йога</option>
                <option value="aerobics">Аэробика</option>
                <option value="crossfit">Кроссфит</option>
                <option value="pilates">Пилатес</option>
                <option value="other">Другая</option>
              </select>
            </label>

            {/* Подтип */}
            <label className="block space-y-1">
              <span className="text-sm">Подтип</span>
              <select
                className="input"
                value={subSport}
                onChange={(e)=>setSubSport(e.target.value)}
              >
                <option value="">— Не указан —</option>
                {subOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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

        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
          <button type="button" className="btn btn-ghost" onClick={()=>router.back()}>Отмена</button>
        </div>
      </form>
    </main>
  );
}