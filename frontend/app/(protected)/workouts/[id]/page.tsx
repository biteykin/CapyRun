import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PHTrack from "@/components/analytics/PHTrack";
import Link from "next/link";

function humanType(t?: string | null) {
  const m: Record<string,string> = {
    run: "Бег", bike: "Велосипед", swim: "Плавание",
    strength: "Силовая", fitness: "Фитнес", padel: "Падел", other: "Другая",
  };
  return m[(t||"").toLowerCase()] || "Другая";
}
const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function fmtDateRu(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso); const dd = d.getDate(); const mon = MONTHS[d.getMonth()]; const yy = String(d.getFullYear()).slice(2);
  return `${dd} ${mon} ${yy}`;
}

export default async function WorkoutDetails({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) return notFound();

  const w: any = data;

  return (
    <main className="space-y-6">
      <PHTrack event="workout_opened" />

      {/* Хедер */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="h-display text-2xl font-extrabold">
            {humanType(w.type)} · {fmtDateRu(w.date)}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Дистанция: {w.distance_km ? `${w.distance_km.toFixed?.(2) ?? w.distance_km} км` : "—"} ·
            {" "}Время: {w.duration_min ?? "—"} мин · Ккал: {w.calories ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/workouts/${w.id}/edit`} className="btn btn-ghost">Редактировать</Link>
          <Link href="/workouts" className="btn btn-primary">К списку</Link>
        </div>
      </div>

      {/* Карточки метрик */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="h-display font-semibold">Нагрузка</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">Суммарно</div>
          <div className="mt-3 flex items-baseline gap-6">
            <div><div className="text-2xl font-bold">{w.duration_min ?? "—"}</div><div className="text-xs text-[var(--text-secondary)]">мин</div></div>
            <div><div className="text-2xl font-bold">{w.distance_km ?? "—"}</div><div className="text-xs text-[var(--text-secondary)]">км</div></div>
            <div><div className="text-2xl font-bold">{w.calories ?? "—"}</div><div className="text-xs text-[var(--text-secondary)]">ккал</div></div>
          </div>
        </div>

        <div className="card p-5">
          <div className="h-display font-semibold">Пульс/темп</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">Подключим из .fit</div>
          <div className="mt-4 h-24 rounded-md" style={{background:"linear-gradient(180deg,#FFD699,#DF6133)"}} />
        </div>

        <div className="card p-5">
          <div className="h-display font-semibold">Заметки</div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Добавим позже поле заметок и теги.</p>
        </div>
      </section>
    </main>
  );
}