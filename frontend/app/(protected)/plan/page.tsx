// app/(protected)/plan/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PlansCalendarHost from "@/components/plans/PlansCalendarHost.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanSessionRow = {
  id: string;
  user_plan_id: string | null;
  planned_date: string;
  sport: string | null;
  status: string | null;
  title: string | null;
  notes?: string | null;
  link_workout_id?: string | null;
};

type WorkoutRow = {
  id: string;
  local_date: string | null;
  sport: string | null;
  name: string | null;
  distance_m: number | null;
  duration_sec: number | null;
};

function buildWorkoutTitle(w: WorkoutRow): string {
  if (w.name) return w.name;

  const parts: string[] = [];

  if (w.sport) {
    const sportLabel: Record<string, string> = {
      run: "Бег",
      ride: "Вело",
      swim: "Плавание",
      walk: "Ходьба",
      hike: "Хайк",
      strength: "Силовая",
      row: "Гребля",
      yoga: "Йога",
      aerobics: "Аэробика",
      crossfit: "Кроссфит",
      pilates: "Пилатес",
      other: "Тренировка",
    };
    parts.push(sportLabel[w.sport] ?? w.sport);
  } else {
    parts.push("Тренировка");
  }

  if (w.distance_m && w.distance_m > 0) {
    const km = w.distance_m / 1000;
    parts.push(`${km.toFixed(1)} км`);
  }

  return parts.join(" · ");
}

export default async function PlansPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/plan`)}`
      );
    }
    redirect("/login");
  }

  const today = new Date();

  // Берём широкий диапазон: -1 год от начала текущего месяца и +1 год до конца месяца
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - 1);
  from.setMonth(from.getMonth(), 1); // 1-е число

  const to = new Date(today);
  to.setFullYear(to.getFullYear() + 1);
  to.setMonth(to.getMonth() + 1, 0); // последний день месяца

  const fromISO = from.toISOString().slice(0, 10);
  const toISO = to.toISOString().slice(0, 10);

  // Плановые сессии
  const { data: planSessionsRaw, error: upsErr } = await supabase
    .from("user_plan_sessions")
    .select(
      "id, user_plan_id, user_id, planned_date, sport, status, title, notes, structure, link_workout_id"
    )
    .eq("user_id", user.id)
    .gte("planned_date", fromISO)
    .lte("planned_date", toISO);

  if (upsErr) {
    console.error("user_plan_sessions error", upsErr);
  }

  const planSessions: PlanSessionRow[] = (planSessionsRaw ?? []) as any;

  // Фактические тренировки
  const { data: workoutsRaw, error: wErr } = await supabase
    .from("workouts")
    .select(
      "id, user_id, local_date, sport, name, distance_m, duration_sec"
    )
    .eq("user_id", user.id)
    .gte("local_date", fromISO)
    .lte("local_date", toISO);

  if (wErr) {
    console.error("workouts error", wErr);
  }

  const workouts: WorkoutRow[] = (workoutsRaw ?? []) as any;

  // Нормализованный список событий для календаря
  const events = [
    // Плановые сессии
    ...planSessions.map((s) => ({
      id: s.id,
      date: s.planned_date, // "YYYY-MM-DD"
      title: s.title || "Плановая тренировка",
      kind: "planned" as const,
      status: s.status,
      sport: s.sport,
      description: s.notes ?? null,
      user_plan_id: s.user_plan_id,
      link_workout_id: s.link_workout_id,
      source: "plan" as const,
    })),
    // Фактические тренировки
    ...workouts
      .filter((w) => w.local_date)
      .map((w) => ({
        id: w.id,
        date: w.local_date as string,
        title: buildWorkoutTitle(w),
        kind: "workout" as const,
        status: "completed" as const,
        sport: w.sport,
        description: w.name,
        link_workout_id: w.id,
        source: "workout" as const,
        distance_m: w.distance_m,
        duration_sec: w.duration_sec,
      })),
  ];

  const initialMonthISO = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  ).toISOString();

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">План тренировок</h1>
      <PlansCalendarHost events={events} initialMonthISO={initialMonthISO} />
    </main>
  );
}