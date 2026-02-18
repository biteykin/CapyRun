// frontend/lib/coach/context.ts
import { clamp } from "./utils";
import { PlannerOut, WorkoutFact } from "./types";
import { loadCoachMemoryV1 } from "@/lib/coach/memoryStore";

export type CoachContext = {
  userId: string;
  threadId: string;

  memory: Record<string, any> | null;

  recentMessages: {
    type: "user" | "coach";
    body: string;
    created_at: string;
  }[];

  workouts: WorkoutFact[];

  coachHome: any | null;

  now: string;
};

export async function buildCoachContext(args: {
  supabase: any;
  userId: string;
  threadId: string;
  plannerNeeds: PlannerOut["needs"];
}): Promise<CoachContext> {
  const { supabase, userId, threadId, plannerNeeds } = args;

  const now = new Date().toISOString();

  // ---- memory (optional)
  const memory = plannerNeeds?.include_thread_memory
    ? await loadCoachMemoryV1({ supabase, userId, limit: 50 })
    : null;

  // ---- recent messages
  const { data: msgs, error: msgErr } = await supabase
    .from("coach_messages")
    .select("type, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(60);

  if (msgErr) {
    console.error("coach_context: recent_messages_error", msgErr);
  }

  const recentMessages =
    (msgs ?? []).filter((m: any) => m.type === "user" || m.type === "coach");

  // ---- workouts

  const windowDays = clamp(plannerNeeds.workouts_window_days ?? 14, 1, 365);
  const limit = clamp(plannerNeeds.workouts_limit ?? 30, 1, 100);
  const fromIso = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString();

  // 1) тренировки со start_time
  const { data: withStart, error: wErr1 } = await supabase
    .from("workouts")
    .select("id, sport, start_time, uploaded_at, created_at, distance_m, duration_sec, moving_time_sec, avg_hr, max_hr")
    .eq("user_id", userId)
    .gte("start_time", fromIso)
    .order("start_time", { ascending: false })
    .limit(limit);

  if (wErr1) {
    console.error("coach_context: workouts_error(start_time)", wErr1);
  }

  // 2) тренировки без start_time (берём по uploaded_at/created_at)
  const { data: noStart, error: wErr2 } = await supabase
    .from("workouts")
    .select("id, sport, start_time, uploaded_at, created_at, distance_m, duration_sec, moving_time_sec, avg_hr, max_hr")
    .eq("user_id", userId)
    .is("start_time", null)
    .gte("created_at", fromIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (wErr2) {
    console.error("coach_context: workouts_error(no start_time)", wErr2);
  }

  // merge + sort by coalesce(start_time, uploaded_at, created_at) desc
  const merged = [...(withStart ?? []), ...(noStart ?? [])];
  const byId = new Map<string, any>();
  for (const w of merged) byId.set(w.id, w);
  const uniq = Array.from(byId.values());

  const timeKey = (w: any) => {
    const t = w.start_time ?? w.uploaded_at ?? w.created_at ?? null;
    const ms = t ? new Date(t).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
  };

  uniq.sort((a, b) => timeKey(b) - timeKey(a));
  const sliced = uniq.slice(0, limit);

  const workouts: WorkoutFact[] = sliced.map((w: any) => ({
    id: w.id,
    sport: w.sport ?? null,
    start_time: w.start_time ?? null,
    distance_m: Number.isFinite(Number(w.distance_m)) ? Number(w.distance_m) : null,
    duration_sec: w.duration_sec ?? null,
    moving_time_sec: w.moving_time_sec ?? null,
    avg_hr: w.avg_hr ?? null,
    max_hr: w.max_hr ?? null,
  }));

  // ---- coach home (optional)
  let coachHome: any | null = null;
  if (plannerNeeds.include_coach_home) {
    const { data, error } = await supabase.rpc("get_coach_home", {
      p_scope: "global",
      p_goal_id: null,
      p_include_snapshot_payload: false,
    });
    if (error) {
      console.error("coach_context: coach_home_error", error);
    }
    coachHome = data ?? null;
  }

  return {
    userId,
    threadId,
    memory,
    recentMessages,
    workouts,
    coachHome,
    now,
  };
}