//frontend/app/api/dashboard/home/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
}

function dateDaysAhead(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, days));
  return d.toISOString().slice(0, 10);
}

type GoalPick = {
  id?: string;
  title?: string | null;
  type?: string | null;
  date_to?: string | null;
  target_json?: unknown;
  is_primary?: boolean | null;
  status: string;
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  const daysRaw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
  const fromISO = dateDaysAgo(days);

  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      fastDaysRes,
      fastWeeksRes,
      weekdayRes,
      sportMixRes,
      zonesRes,
      nextPlannedRes,
      goalsRes,
      threadRes,
    ] = await Promise.all([
      supabase.rpc("dash_fast_days", { days }),
      supabase.rpc("dash_fast_weeks", { weeks: 12 }),
      supabase.rpc("dash_fast_weekday", { days }),
      supabase.rpc("dash_fast_sport_mix", { days }),
      supabase
        .from("workouts")
        .select("local_date, hr_zone_time")
        .eq("user_id", user.id)
        .gte("local_date", fromISO)
        .is("deleted_at", null),
      supabase
        .from("user_plan_sessions")
        .select("id, user_plan_id, planned_date, title, sport, status, structure")
        .eq("user_id", user.id)
        .gte("planned_date", todayISO())
        .in("status", ["planned", "moved"])
        .order("planned_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("coach_threads")
        .select("id")
        .eq("user_id", user.id)
        .eq("scope", "general")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const errors = [
      fastDaysRes.error,
      fastWeeksRes.error,
      weekdayRes.error,
      sportMixRes.error,
      zonesRes.error,
      nextPlannedRes.error,
      goalsRes.error,
      threadRes.error,
    ].filter(Boolean);

    if (errors.length) {
      return NextResponse.json(
        { error: errors[0]?.message ?? "Dashboard load failed" },
        { status: 500 }
      );
    }

    let latestCoachMessage = null;

    if (threadRes.data?.id) {
      const { data: coachMsg, error } = await supabase
        .from("coach_messages")
        .select("id, body, created_at, meta")
        .eq("thread_id", threadRes.data.id)
        .eq("type", "coach")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      latestCoachMessage = coachMsg ?? null;
    }

    const goalsList = (goalsRes.data ?? []) as GoalPick[];
    const primaryGoal =
      goalsList.find((x) => x.is_primary && x.status === "active") ??
      goalsList.find((x) => x.status === "active") ??
      null;

    const forecastFromISO = dateDaysAgo(28);
    const forecastToISO = dateDaysAhead(28);

    const { data: forecastWorkouts, error: forecastWorkoutsError } = await supabase
      .from("workouts")
      .select("distance_m,start_time,local_date")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("local_date", forecastFromISO)
      .lte("local_date", todayISO());

    if (forecastWorkoutsError) {
      return NextResponse.json({ error: forecastWorkoutsError.message }, { status: 500 });
    }

    const { data: forecastPlan, error: forecastPlanError } = await supabase
      .from("user_plan_sessions")
      .select("planned_date,status,structure")
      .eq("user_id", user.id)
      .gte("planned_date", todayISO())
      .lte("planned_date", forecastToISO)
      .in("status", ["planned", "moved"])
      .order("planned_date", { ascending: true });

    if (forecastPlanError) {
      return NextResponse.json({ error: forecastPlanError.message }, { status: 500 });
    }

    const past4wKm = (forecastWorkouts ?? []).reduce(
      (s: number, x: { distance_m?: unknown }) => s + num(x.distance_m) / 1000,
      0
    );

    const currentWeeklyKm = past4wKm / 4;

    const plannedKm4w = (forecastPlan ?? []).reduce(
      (s: number, x: { structure?: { distance_km?: unknown } | null }) =>
        s + num(x.structure?.distance_km),
      0
    );

    const projectedWeeklyKm =
      plannedKm4w > 0 ? plannedKm4w / 4 : currentWeeklyKm;

    const goalDaysLeft = primaryGoal?.date_to
      ? Math.ceil((new Date(primaryGoal.date_to).getTime() - Date.now()) / 86400000)
      : null;

    const targetKmByGoalType: Record<string, number> = {
      "10k": 10,
      HM: 21.1,
      M: 42.2,
    };

    const targetJson = primaryGoal?.target_json as { distance_km?: unknown } | null | undefined;
    const targetKm =
      num(targetJson?.distance_km) ||
      targetKmByGoalType[String(primaryGoal?.type ?? "")] ||
      null;

    const recommendedWeeklyKm =
      targetKm && goalDaysLeft && goalDaysLeft > 0
        ? Math.max(
            targetKm * 1.2,
            targetKm * 0.45 * Math.min(8, Math.max(1, goalDaysLeft / 7))
          )
        : null;

    const goalForecast =
      primaryGoal && goalDaysLeft != null
        ? {
            title: primaryGoal.title ?? "Главная цель",
            days_left: goalDaysLeft,
            current_weekly_km: Math.round(currentWeeklyKm * 10) / 10,
            projected_weekly_km: Math.round(projectedWeeklyKm * 10) / 10,
            recommended_weekly_km:
              recommendedWeeklyKm != null ? Math.round(recommendedWeeklyKm * 10) / 10 : null,
            pct_of_recommended:
              recommendedWeeklyKm && recommendedWeeklyKm > 0
                ? Math.round((projectedWeeklyKm / recommendedWeeklyKm) * 100)
                : null,
            status:
              recommendedWeeklyKm == null
                ? "unknown"
                : projectedWeeklyKm >= recommendedWeeklyKm * 0.95
                  ? "on_track"
                  : projectedWeeklyKm >= recommendedWeeklyKm * 0.75
                    ? "watch"
                    : "behind",
          }
        : null;

    const formForecast = {
      current_weekly_km: Math.round(currentWeeklyKm * 10) / 10,
      projected_weekly_km: Math.round(projectedWeeklyKm * 10) / 10,
      projected_4w_km: Math.round(projectedWeeklyKm * 4 * 10) / 10,
      growth_pct:
        currentWeeklyKm > 0
          ? Math.round(((projectedWeeklyKm - currentWeeklyKm) / currentWeeklyKm) * 100)
          : 0,
      recommendation:
        projectedWeeklyKm > currentWeeklyKm * 1.15
          ? "Рост нагрузки заметный. Держи большую часть пробежек в Z1–Z2 и не добавляй интенсивность без восстановления."
          : projectedWeeklyKm < currentWeeklyKm * 0.85
            ? "Нагрузка снижается. Если цель актуальна — добавь одну лёгкую тренировку или чуть увеличь длительность спокойного бега."
            : "Темп подготовки выглядит ровным. Продолжай выполнять план и следи за восстановлением.",
    };

    return NextResponse.json({
      data: {
        days: fastDaysRes.data ?? [],
        weeks: fastWeeksRes.data ?? [],
        weekday: weekdayRes.data ?? [],
        sportMix: sportMixRes.data ?? [],
        hrZones: zonesRes.data ?? [],
        nextPlanned: nextPlannedRes.data ?? null,
        primaryGoal,
        latestCoachMessage,
        goalForecast,
        formForecast,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
