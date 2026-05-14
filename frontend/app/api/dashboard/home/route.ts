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

type GoalPick = {
  is_primary?: boolean | null;
  status: string;
};

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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
