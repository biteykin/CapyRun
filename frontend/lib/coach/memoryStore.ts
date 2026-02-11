// frontend/lib/coach/memoryStore.ts
// Memory Engine v1: read/write structured coach memory via coach_memory_items + RPC.
//
// Source of truth: public.coach_memory_items
// Read: RPC get_coach_memory_top(...)
// Write: RPC upsert_coach_memory_item(...)

export type CoachMemoryV1 = {
    goal?: string;
    constraints?: string;
    injury?: string;
  
    preferred_days_per_week?: number;
    preferred_session_minutes?: number;
  
    sports_focus?: string[];
  };
  
  type RpcMemoryRow = {
    category: string;
    key: string;
    value_text: string | null;
    value_json: any | null;
    importance: number;
    confidence: string | number;
    status: string;
    source?: string | null;
    source_ref?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  };
  
  function asFiniteNumber(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  
  function normKey(s: any): string {
    return String(s ?? "").toLowerCase().trim();
  }
  
  /**
   * Loads "top" memory items for current user (auth.uid()) and converts to a compact memory object.
   * We rely on SECURITY DEFINER RPC that checks auth.uid() inside.
   */
  export async function loadCoachMemoryV1(args: {
    supabase: any;
    category?: string | null;
    goalId?: string | null;
    sport?: string | null;
    limit?: number;
    minImportance?: number;
    minConfidence?: number;
    status?: string | null;
    query?: string | null;
  }): Promise<CoachMemoryV1> {
    const {
      supabase,
      category = null,
      goalId = null,
      sport = null,
      limit = 50,
      minImportance = 1,
      minConfidence = 0,
      status = "active",
      query = null,
    } = args;
  
    const { data, error } = await supabase.rpc("get_coach_memory_top", {
      p_category: category,
      p_goal_id: goalId,
      p_sport: sport,
      p_limit: limit,
      p_min_importance: minImportance,
      p_min_confidence: minConfidence,
      p_status: status,
      p_query: query,
    });
  
    if (error) {
      console.error("loadCoachMemoryV1: rpc_failed", error);
      return {};
    }
  
    const rows: RpcMemoryRow[] = Array.isArray(data) ? data : [];
    const mem: CoachMemoryV1 = {};
  
    for (const r of rows) {
      const k = normKey(r.key);
      if (!k) continue;
  
      // text fields
      if (k === "goal" && r.value_text) mem.goal = r.value_text;
      if (k === "constraints" && r.value_text) mem.constraints = r.value_text;
      if (k === "injury" && r.value_text) mem.injury = r.value_text;
  
      // numeric fields (stored as value_json:{value:int} OR value_text)
      if (k === "preferred_days_per_week") {
        const v = r.value_json?.value ?? r.value_text;
        const n = asFiniteNumber(v);
        if (n != null) mem.preferred_days_per_week = Math.trunc(n);
      }
  
      if (k === "preferred_session_minutes") {
        const v = r.value_json?.value ?? r.value_text;
        const n = asFiniteNumber(v);
        if (n != null) mem.preferred_session_minutes = Math.trunc(n);
      }
  
      // arrays
      if (k === "sports_focus") {
        const arr = Array.isArray(r.value_json) ? r.value_json : null;
        if (arr) mem.sports_focus = arr.map((x) => String(x)).filter(Boolean);
      }
    }
  
    return mem;
  }
  
  function mapPatchKeyToStore(key: keyof CoachMemoryV1): {
    category: string;
    storeKey: string;
    importance: number;
    confidence: number;
    asJson: boolean;
  } {
    switch (key) {
      case "goal":
        return { category: "profile", storeKey: "goal", importance: 4, confidence: 0.85, asJson: false };
      case "constraints":
        return { category: "profile", storeKey: "constraints", importance: 4, confidence: 0.85, asJson: false };
      case "injury":
        return { category: "health", storeKey: "injury", importance: 5, confidence: 0.85, asJson: false };
  
      case "preferred_days_per_week":
        return {
          category: "preferences",
          storeKey: "preferred_days_per_week",
          importance: 4,
          confidence: 0.9,
          asJson: true,
        };
      case "preferred_session_minutes":
        return {
          category: "preferences",
          storeKey: "preferred_session_minutes",
          importance: 4,
          confidence: 0.9,
          asJson: true,
        };
      case "sports_focus":
        return { category: "preferences", storeKey: "sports_focus", importance: 3, confidence: 0.8, asJson: true };
  
      default:
        return { category: "profile", storeKey: String(key), importance: 3, confidence: 0.75, asJson: false };
    }
  }
  
  /**
   * Applies planner.memory_patch into coach_memory_items using RPC upsert_coach_memory_item.
   * This is an UPSERT by (user_id, category, key) enforced by DB unique index.
   */
  export async function applyPlannerMemoryPatch(args: {
    supabase: any;
    patch: any;
    sourceRef?: string | null;
    source?: string | null;
    // Optional: if you later want goal-specific memory
    goalId?: string | null;
    sport?: string | null;
  }) {
    const {
      supabase,
      patch,
      sourceRef = "planner_memory_patch",
      source = "user",
      goalId = null,
      sport = null,
    } = args;
  
    if (!patch || typeof patch !== "object") return;
  
    const keys = Object.keys(patch) as (keyof CoachMemoryV1)[];
    for (const k of keys) {
      const v = (patch as any)[k];
      if (v == null) continue;
  
      const m = mapPatchKeyToStore(k);
  
      // Build value_text/value_json according to mapping
      const value_text =
        m.asJson
          ? null
          : typeof v === "string"
            ? v.slice(0, 500)
            : String(v).slice(0, 500);
  
      let value_json: any = null;
      if (m.asJson) {
        if (k === "preferred_days_per_week" || k === "preferred_session_minutes") {
          const n = asFiniteNumber(v);
          if (n == null) continue;
          value_json = { value: Math.trunc(n) };
        } else if (k === "sports_focus") {
          value_json = Array.isArray(v) ? v : [String(v)];
        } else {
          value_json = v;
        }
      }
  
      const { error } = await supabase.rpc("upsert_coach_memory_item", {
        p_category: m.category,
        p_key: m.storeKey,
        p_value_text: value_text,
        p_value_json: value_json,
        p_importance: m.importance,
        p_confidence: m.confidence,
        p_status: "active",
        p_goal_id: goalId,
        p_sport: sport,
        p_valid_from: null,
        p_valid_to: null,
        p_last_confirmed_at: new Date().toISOString(),
        p_source: source,
        p_source_ref: sourceRef,
      });
  
      if (error) {
        console.error("applyPlannerMemoryPatch: upsert_failed", { key: k, mapped: m, error });
      }
    }
  }
  
  /**
   * Optional helper for quick debug: returns the raw rows (top memory items).
   */
  export async function debugGetCoachMemoryRows(args: {
    supabase: any;
    category?: string | null;
    limit?: number;
  }): Promise<RpcMemoryRow[]> {
    const { supabase, category = null, limit = 50 } = args;
    const { data, error } = await supabase.rpc("get_coach_memory_top", {
      p_category: category,
      p_goal_id: null,
      p_sport: null,
      p_limit: limit,
      p_min_importance: 1,
      p_min_confidence: 0,
      p_status: "active",
      p_query: null,
    });
  
    if (error) {
      console.error("debugGetCoachMemoryRows: rpc_failed", error);
      return [];
    }
    return Array.isArray(data) ? (data as RpcMemoryRow[]) : [];
  }