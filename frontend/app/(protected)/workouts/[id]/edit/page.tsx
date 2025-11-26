export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

import WorkoutEditForm from "@/components/workouts/WorkoutEditForm.client";

// Фоллбеки подтипов на сервере (совпадает с клиентом)
const SUB_FALLBACKS: Record<string, string[]> = {
  run: ["road", "trail", "treadmill", "track", "indoor"],
  ride: ["road", "gravel", "mtb", "indoor", "trainer"],
  swim: ["pool", "open_water"],
  walk: ["outdoor", "indoor", "treadmill"],
  hike: ["trail", "mountain"],
  row: ["indoor", "water"],
  strength: ["barbell", "dumbbell", "machine", "bodyweight"],
  yoga: ["hatha", "vinyasa", "yin", "ashtanga"],
  aerobics: ["step", "dance", "hi-lo"],
  crossfit: ["metcon", "amrap", "emom"],
  pilates: ["mat", "reformer"],
  other: [],
};

async function loadSubOptionsServer(supabase: any, sport: string) {
  // 1) справочник
  let opts: { value: string; label: string }[] = [];
  try {
    const { data } = await supabase
      .from("sport_subtypes")
      .select("*")
      .eq("sport", sport)
      .order("order", { ascending: true });
    if (Array.isArray(data) && data.length) {
      opts = data
        .map((r: any) => {
          const value =
            r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
          const label =
            r.name_ru ??
            r.label_ru ??
            r.title_ru ??
            r.label ??
            r.title ??
            r.name ??
            value;
          return value ? { value: String(value), label: String(label) } : null;
        })
        .filter(Boolean) as any[];
    }
  } catch {}

  // 2) distinct из тренировок
  if (!opts.length) {
    try {
      const { data } = await supabase
        .from("workouts")
        .select("sub_sport")
        .eq("sport", sport)
        .not("sub_sport", "is", null)
        .limit(1000);
      if (data) {
        const uniq = Array.from(
          new Set((data as any[]).map((x) => x.sub_sport).filter(Boolean))
        );
        opts = uniq.map((v) => ({ value: String(v), label: String(v) }));
      }
    } catch {}
  }

  // 3) фоллбек
  if (!opts.length && SUB_FALLBACKS[sport]) {
    opts = SUB_FALLBACKS[sport].map((v) => ({ value: v, label: v }));
  }

  return opts;
}

type PageProps = { params: { id: string } };

export default async function EditWorkoutPage({ params }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(
          `/workouts/${params.id}/edit`
        )}`
      );
    }
    redirect("/login");
  }

  const workoutId = params.id;

  // БАЗОВЫЕ поля тренировки — без вложенных связей
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .select(
      `
      id,
      user_id,
      start_time,
      local_date,
      uploaded_at,
      sport,
      sub_sport,
      duration_sec,
      distance_m,
      avg_hr,
      calories_kcal,
      name,
      description,
      visibility,
      weekday_iso
    `
    )
    .eq("id", workoutId)
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle(); // ВАЖНО: а не .single()

  if (wErr || !workout) {
    redirect("/workouts"); // или notFound()
  }

  // Подтипы под стартовый спорт (чтобы форма не мигала)
  const initialSubOptions = await loadSubOptionsServer(
    supabase,
    (workout.sport || "run").toLowerCase()
  );

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">Редактировать тренировку</h1>
      {/* WorkoutEditForm теперь использует Button (primary/secondary) для submit/cancel */}
      <WorkoutEditForm workout={workout} initialSubOptions={initialSubOptions} />
    </main>
  );
}