// lib/coach/planWrite.ts
import type { ResponderResult, StructuredPlan } from "./types";

type PlanWriteDb = {
  from: (table: string) => {
    select: (columns: string) => any;
    insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => any;
    delete: () => any;
  };
};

type JsonMap = Record<string, unknown>;

type CoachPlanDraftMessage = {
  id: string;
  body: string | null;
  meta: JsonMap | null;
  created_at: string;
};

function normalizeDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;

  return `${m[1]}-${m[2]}-${m[3]}`;
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const m = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateOnly;

  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getTodayDateOnlyUtc(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getStructuredPlanStartsOn(plan: StructuredPlan): string {
  const explicit = normalizeDateOnly(plan.starts_on ?? null);
  if (explicit) return explicit;

  const firstDated = plan.sessions
    .map((s) => normalizeDateOnly(s.date ?? null))
    .filter((x): x is string => Boolean(x))
    .sort()[0];

  if (firstDated) return firstDated;
  return getTodayDateOnlyUtc();
}

export function materializeStructuredPlan(plan: StructuredPlan): StructuredPlan {
  const startsOn = getStructuredPlanStartsOn(plan);

  const sessions = plan.sessions.map((session, idx) => {
    const explicitDate = normalizeDateOnly(session.date ?? null);
    const dayIndex =
      typeof session.day_index === "number" && Number.isFinite(session.day_index)
        ? Math.max(0, Math.trunc(session.day_index))
        : idx;

    const date = explicitDate ?? addDaysToDateOnly(startsOn, dayIndex);

    return {
      ...session,
      day_index: dayIndex,
      date,
    };
  });

  const dated = sessions
    .map((s) => normalizeDateOnly(s.date ?? null))
    .filter((x): x is string => Boolean(x))
    .sort();

  return {
    ...plan,
    starts_on: startsOn,
    ends_on: normalizeDateOnly(plan.ends_on ?? null) ?? dated[dated.length - 1] ?? startsOn,
    sessions,
  };
}

export function getStructuredPlanOverwriteRange(plan: StructuredPlan): { from: string; to: string } {
  const materialized = materializeStructuredPlan(plan);

  const explicitFrom = normalizeDateOnly(plan.overwrite_range?.from ?? null);
  const explicitTo = normalizeDateOnly(plan.overwrite_range?.to ?? null);
  if (explicitFrom && explicitTo) {
    return { from: explicitFrom, to: explicitTo };
  }

  const dates = materialized.sessions
    .map((s) => normalizeDateOnly(s.date ?? null))
    .filter((x): x is string => Boolean(x))
    .sort();

  const from = dates[0] ?? materialized.starts_on ?? getTodayDateOnlyUtc();
  const to = dates[dates.length - 1] ?? from;

  return { from, to };
}

export function extractResponderTextAndPlan(
  result: string | ResponderResult
): { text: string; structuredPlan: StructuredPlan | null } {
  if (typeof result === "string") {
    return {
      text: result.trim(),
      structuredPlan: null,
    };
  }

  return {
    text: String(result?.text ?? "").trim(),
    structuredPlan: result?.structured_plan ?? null,
  };
}

export function isLikelyPlanConfirmAction(
  action: string | null | undefined,
  text: string
): boolean {
  const a = String(action ?? "").trim().toLowerCase();
  const t = String(text ?? "").trim().toLowerCase();

  if (a === "confirm_plan") return true;

  return /^(ок|окей|да|okay|подтверждаю|подтвердить|да,? ставим|ставим|сохрани план|сохранить план)$/i.test(
    t
  );
}

export function isLikelyPlanCancelAction(
  action: string | null | undefined,
  text: string
): boolean {
  const a = String(action ?? "").trim().toLowerCase();
  const t = String(text ?? "").trim().toLowerCase();

  if (a === "cancel_plan") return true;

  return /^(отмена|отменить|не ставим|не надо|не сохраняй|не сохранять)$/i.test(t);
}

export async function getLatestCoachPlanDraftMessage(params: {
  db: PlanWriteDb;
  threadId: string;
  beforeCreatedAt: string;
}): Promise<CoachPlanDraftMessage | null> {
  const { db, threadId, beforeCreatedAt } = params;

  const { data, error } = await db
    .from("coach_messages")
    .select("id, body, meta, created_at")
    .eq("thread_id", threadId)
    .eq("type", "coach")
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;

  for (const row of data as CoachPlanDraftMessage[]) {
    const structuredPlan = row?.meta?.structured_plan;
    if (structuredPlan && typeof structuredPlan === "object") {
      return row;
    }
  }

  return null;
}

async function loadFallbackTemplateId(params: {
  db: PlanWriteDb;
  sport: string | null | undefined;
}): Promise<string | null> {
  const { db, sport } = params;
  const desiredSport = String(sport ?? "run");

  const { data: exact } = await db
    .from("plan_templates")
    .select("id,sport,is_active")
    .eq("is_active", true)
    .eq("sport", desiredSport)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exact?.id) return String(exact.id);

  const { data: fallback } = await db
    .from("plan_templates")
    .select("id,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return fallback?.id ? String(fallback.id) : null;
}

export async function confirmStructuredPlanIntoDb(params: {
  db: PlanWriteDb;
  userId: string;
  goalId?: string | null;
  timezone?: string | null;
  plan: StructuredPlan;
}): Promise<{
  userPlanId: string;
  sessionsCount: number;
  overwriteRange: { from: string; to: string };
  startsOn: string;
  endsOn: string;
}> {
  const { db, userId, goalId, timezone, plan } = params;

  const materialized = materializeStructuredPlan(plan);
  const overwriteRange = getStructuredPlanOverwriteRange(materialized);

  const templateId = await loadFallbackTemplateId({
    db,
    sport: materialized.sessions[0]?.sport ?? "run",
  });

  if (!templateId) {
    throw new Error("No active plan template found for plan confirmation");
  }

  const startDate = normalizeDateOnly(materialized.starts_on ?? null) ?? overwriteRange.from;

  const { data: insertedPlan, error: insertPlanError } = await db
    .from("user_plans")
    .insert({
      user_id: userId,
      template_id: templateId,
      goal_id: goalId ?? null,
      start_date: startDate,
      status: "active",
      personalization: {
        source: "coach_structured_plan",
        draft_kind: materialized.kind ?? null,
        overwrite_confirmed: true,
        horizon_days: materialized.horizon_days ?? null,
        summary: materialized.summary ?? null,
      },
      timezone: timezone ?? "Europe/Berlin",
      visibility: "private",
    })
    .select("id")
    .single();

  if (insertPlanError || !insertedPlan?.id) {
    throw new Error(`Failed to insert user_plan: ${insertPlanError?.message ?? "no id"}`);
  }

  const userPlanId = String(insertedPlan.id);

  const { error: deleteSessionsError } = await db
    .from("user_plan_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("status", "planned")
    .gte("planned_date", overwriteRange.from)
    .lte("planned_date", overwriteRange.to);

  if (deleteSessionsError) {
    await db.from("user_plans").delete().eq("id", userPlanId);
    throw new Error(`Failed to clear overlapping sessions: ${deleteSessionsError.message}`);
  }

  const rows = materialized.sessions.map((session) => {
    const plannedDate = normalizeDateOnly(session.date ?? null) ?? startDate;
    const sport = String(session.sport ?? "run");

    return {
      user_plan_id: userPlanId,
      user_id: userId,
      planned_date: plannedDate,
      planned_start_time: null,
      sport,
      status: "planned",
      title: session.title,
      structure:
        session.structure ??
        {
          goal: session.goal ?? null,
          duration_min: session.duration_min ?? null,
          distance_km: session.distance_km ?? null,
          effort: session.effort ?? null,
          hr_target: session.hr_target ?? null,
          warmup: session.warmup ?? null,
          main: session.main ?? null,
          cooldown: session.cooldown ?? null,
          steps: session.steps ?? [],
          strength_block: session.strength_block ?? null,
          fueling: session.fueling ?? null,
          hydration: session.hydration ?? null,
        },
      notes: session.notes ?? null,
    };
  });

  const { error: insertSessionsError } = await db.from("user_plan_sessions").insert(rows);

  if (insertSessionsError) {
    await db.from("user_plan_sessions").delete().eq("user_plan_id", userPlanId);
    await db.from("user_plans").delete().eq("id", userPlanId);
    throw new Error(`Failed to insert user_plan_sessions: ${insertSessionsError.message}`);
  }

  return {
    userPlanId,
    sessionsCount: rows.length,
    overwriteRange,
    startsOn: startDate,
    endsOn: overwriteRange.to,
  };
}