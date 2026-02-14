// frontend/lib/coach/memoryStore.ts

type MemoryTopItem = {
  id: string;
  category: string;
  key: string;
  value_text: string | null;
  value_json: any | null;
  importance: number;
  confidence: number;
  status: string;
  source: string;
  source_ref: string | null;
  updated_at: string;
};

export function normalizeMemoryForLLM(items: MemoryTopItem[]) {
  const out: Record<string, any> = {};
  for (const it of items ?? []) {
    const cat = (it.category ?? "other").toLowerCase();
    const key = (it.key ?? "").toString();
    if (!key) continue;
    out[cat] = out[cat] ?? {};
    out[cat][key] = it.value_json ?? it.value_text ?? null;
  }
  return out;
}

// Backward-compat: used by lib/coach/context.ts
// Returns normalized memory object suitable for LLM context
export async function loadCoachMemoryV1(args: {
  supabase: any;
  userId: string;
  limit?: number;
  category?: string | null;
  goalId?: string | null;
  sport?: string | null;
  minImportance?: number;
}) {
  const { supabase, userId, limit = 50, category = null, goalId = null, sport = null, minImportance = 1 } = args;

  const { items, error } = await loadMemoryTopDirect({
    supabase,
    userId,
    category,
    goalId,
    sport,
    limit,
    minImportance,
  });

  if (error) return null;
  return normalizeMemoryForLLM(items);
}

export async function loadMemoryTopDirect(args: {
  supabase: any;
  userId: string;
  category?: string | null;
  goalId?: string | null;
  sport?: string | null;
  limit?: number;
  minImportance?: number;
}) {
  try {
    const {
      supabase,
      userId,
      category = null,
      goalId = null,
      sport = null,
      limit = 30,
      minImportance = 1,
    } = args;

    let q = supabase
      .from("coach_memory_items")
      .select("id, category, key, value_text, value_json, importance, confidence, status, source, source_ref, updated_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("importance", Math.max(1, Math.min(5, Number(minImportance) || 1)))
      .order("importance", { ascending: false })
      .order("confidence", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, Number(limit) || 30)));

    if (category && String(category).trim()) q = q.eq("category", String(category).trim().toLowerCase());
    if (goalId) q = q.eq("goal_id", goalId);
    if (sport && String(sport).trim()) q = q.eq("sport", String(sport).trim());

    const { data, error } = await q;

    if (error) {
      console.error("memoryStore: loadMemoryTopDirect_failed", error);
      return { items: [], error };
    }

    return { items: data ?? [], error: null };
  } catch (e) {
    console.error("memoryStore: loadMemoryTopDirect_crash", e);
    return { items: [], error: e };
  }
}

export function mergeLegacyMemory(typed: any, legacy: any | null) {
  // typed имеет приоритет, legacy — как fallback/добавка
  const a = typed && typeof typed === "object" ? typed : {};
  const b = legacy && typeof legacy === "object" ? legacy : {};
  return { ...b, ...a };
}

export async function applyMemoryPatch(args: {
  supabase: any;
  patch: any;
  sourceRef?: string | null;
}) {
  const { supabase, patch, sourceRef = null } = args;
  const p = patch ?? {};
  const calls: Array<Promise<any>> = [];

  const upsert = (category: string, key: string, valueText?: string | null, valueJson?: any, importance = 4) => {
    calls.push(
      supabase.rpc("upsert_coach_memory_item", {
        p_category: category,
        p_key: key,
        p_value_text: valueText ?? null,
        p_value_json: valueJson ?? null,
        p_importance: importance,
        p_confidence: 0.85,
        p_status: "active",
        p_goal_id: null,
        p_sport: null,
        p_valid_from: new Date().toISOString(),
        p_valid_to: null,
        p_last_confirmed_at: new Date().toISOString(),
        p_source: "user",
        p_source_ref: sourceRef,
      })
    );
  };

  if (typeof p.goal === "string" && p.goal.trim()) upsert("profile", "goal", p.goal.trim(), null, 5);
  if (typeof p.constraints === "string" && p.constraints.trim()) upsert("profile", "constraints", p.constraints.trim(), null, 4);
  if (typeof p.injury === "string" && p.injury.trim()) upsert("health", "injury", p.injury.trim(), null, 5);

  if (Number.isFinite(Number(p.preferred_days_per_week))) {
    upsert("preferences", "preferred_days_per_week", null, { value: Number(p.preferred_days_per_week) }, 4);
  }
  if (Number.isFinite(Number(p.preferred_session_minutes))) {
    upsert("preferences", "preferred_session_minutes", null, { value: Number(p.preferred_session_minutes) }, 4);
  }
  if (Array.isArray(p.sports_focus) && p.sports_focus.length) {
    upsert("preferences", "sports_focus", null, p.sports_focus.slice(0, 10), 3);
  }

  // weekly_schedule (если когда-то научим planner вытаскивать)
  if (p.weekly_schedule && typeof p.weekly_schedule === "object") {
    upsert("preferences", "weekly_schedule", null, p.weekly_schedule, 5);
  }

  if (!calls.length) return { ok: true };
  const results = await Promise.allSettled(calls);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    console.error("memoryStore: applyMemoryPatch_failed", failed);
    return { ok: false };
  }
  return { ok: true };
}