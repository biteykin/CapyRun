//frontend/app/api/plan/calendar/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActiveGoal = {
  id: string;
  title: string | null;
  type: string | null;
  sport: string | null;
  date_to: string | null;
} | null;

type PlanSessionRow = {
  id: string;
  user_plan_id: string | null;
  planned_date: string;
  sport: string | null;
  status: string | null;
  title: string | null;
  structure?: {
    goal?: string | null;
    main?: string | null;
    notes?: string | null;
    steps?: unknown[] | null;
    effort?: string | null;
    warmup?: string | null;
    cooldown?: string | null;
    hr_target?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
    strength_block?: string | null;
    hydration?: string | null;
    fueling?: string | null;
  } | null;
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

type GoalRow = {
  id: string;
  title: string | null;
  type: string | null;
  sport: string | null;
  date_to: string | null;
  status: string | null;
  target_json: Record<string, unknown> | null;
};

type PlanCalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "goal" | "planned" | "workout";
  status: string | null;
  sport: string | null;
  source: "goal" | "plan" | "workout";
  [key: string]: unknown;
};

function formatPlannedDescription(s: PlanSessionRow): string | null {
  const st = s.structure ?? null;
  return st?.notes ?? s.notes ?? st?.main ?? null;
}

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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  // Wide range: -1 year from month start, +1 year to month end
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - 1);
  from.setMonth(from.getMonth(), 1);

  const to = new Date(today);
  to.setFullYear(to.getFullYear() + 1);
  to.setMonth(to.getMonth() + 1, 0);

  const fromISO = from.toISOString().slice(0, 10);
  const toISO = to.toISOString().slice(0, 10);

  const { data: planSessionsRaw, error: upsErr } = await supabase
    .from("user_plan_sessions")
    .select(
      "id, user_plan_id, user_id, planned_date, sport, status, title, notes, structure, link_workout_id"
    )
    .eq("user_id", user.id)
    .neq("status", "canceled")
    .gte("planned_date", fromISO)
    .lte("planned_date", toISO);

  if (upsErr) {
    console.error("user_plan_sessions error", upsErr);
  }

  const planSessions: PlanSessionRow[] = (planSessionsRaw ?? []) as PlanSessionRow[];

  const { data: workoutsRaw, error: wErr } = await supabase
    .from("workouts")
    .select("id, user_id, local_date, sport, name, distance_m, duration_sec")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("local_date", fromISO)
    .lte("local_date", toISO);

  if (wErr) {
    console.error("workouts error", wErr);
  }

  const workouts: WorkoutRow[] = (workoutsRaw ?? []) as WorkoutRow[];
  const workoutDates = new Set(
    workouts.map((w) => w.local_date).filter(Boolean) as string[]
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  function resolvePlanSessionStatus(s: PlanSessionRow): string | null {
    const status = s.status ?? "planned";
    if (status === "planned" && workoutDates.has(s.planned_date)) return "completed";
    if (status === "planned" && s.planned_date < todayISO && !workoutDates.has(s.planned_date)) {
      return "missed";
    }
    return status;
  }

  const { data: activeGoalRaw, error: goalErr } = await supabase
    .from("goals")
    .select("id, title, type, sport, date_to")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (goalErr) {
    console.error("goals error", goalErr);
  }

  const activeGoal: ActiveGoal = (activeGoalRaw as ActiveGoal) ?? null;

  const { data: goalsRaw, error: goalsErr } = await supabase
    .from("goals")
    .select("id, title, type, sport, date_to, status, target_json")
    .eq("user_id", user.id)
    .eq("status", "active")
    .not("date_to", "is", null)
    .gte("date_to", fromISO)
    .lte("date_to", toISO);

  if (goalsErr) {
    console.error("goals calendar fetch error", goalsErr);
  }

  const goals: GoalRow[] = (goalsRaw ?? []) as GoalRow[];
  const raceGoalTypes = new Set(["5k", "10k", "HM", "M"]);

  const events: PlanCalendarEvent[] = [
    ...goals
      .filter((g) => !!g.date_to)
      .map((g) => {
        const isRace =
          raceGoalTypes.has(String(g.type)) ||
          raceGoalTypes.has(String(g.target_json?.distance_type ?? ""));

        return {
          id: `goal-${g.id}`,
          date: g.date_to as string,
          title: g.title || "Цель",
          kind: "goal",
          status: "goal",
          sport: g.sport,
          source: "goal",
          goal_id: g.id,
          goal_type: g.type,
          goal_icon: isRace ? "🏆" : "🎯",
          description: isRace ? "Финал беговой цели" : "Дата завершения цели",
          target_json: g.target_json ?? null,
        };
      }),
    ...planSessions.map((s) => ({
      id: s.id,
      date: s.planned_date,
      title: s.title || "Плановая тренировка",
      kind: "planned",
      status: resolvePlanSessionStatus(s),
      sport: s.sport,
      description: formatPlannedDescription(s),
      user_plan_id: s.user_plan_id,
      link_workout_id: s.link_workout_id,
      structure: s.structure ?? null,
      notes: s.notes ?? s.structure?.notes ?? null,
      goal: s.structure?.goal ?? null,
      main: s.structure?.main ?? null,
      warmup: s.structure?.warmup ?? null,
      cooldown: s.structure?.cooldown ?? null,
      effort: s.structure?.effort ?? null,
      hr_target: s.structure?.hr_target ?? null,
      strength_block: s.structure?.strength_block ?? null,
      steps: s.structure?.steps ?? null,
      planned_distance_km: s.structure?.distance_km ?? null,
      planned_duration_min: s.structure?.duration_min ?? null,
      planned_date: s.planned_date,
      source: "plan",
    })),
    ...workouts
      .filter((w) => w.local_date)
      .map((w) => ({
        id: w.id,
        date: w.local_date as string,
        title: buildWorkoutTitle(w),
        kind: "workout",
        status: "completed",
        sport: w.sport,
        description: w.name,
        link_workout_id: w.id,
        source: "workout",
        distance_m: w.distance_m,
        duration_sec: w.duration_sec,
      })),
  ];

  const initialMonthISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  return NextResponse.json({ events, activeGoal, initialMonthISO });
}

