// lib/coach/goal.ts

export type GoalRow = {
    id: string;
    user_id: string;
    title: string | null;
    type: string | null;
    sport: string | null;
    date_from: string | null;
    date_to: string | null;
    status: string | null;
    target_json: Record<string, any> | null;
    progress_cache: Record<string, any> | null;
    notes: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  
  export type GoalTarget = {
    time_s?: number | null;
    pace_s_per_km?: number | null;
    hr_ceiling?: number | null;
    distance_km?: number | null;
    [key: string]: any;
  };
  
  export type NormalizedGoal = {
    id: string;
    title: string | null;
    type: string | null;
    sport: string | null;
    status: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    daysToGoal: number | null;
    isExpired: boolean;
    target: GoalTarget;
    progress: Record<string, any>;
    notes: string | null;
    source: GoalRow;
  };
  
  function toDateOnly(value: string | null | undefined): string | null {
    if (!value) return null;
    const s = String(value).trim();
    if (!s) return null;
    return s.slice(0, 10);
  }
  
  function startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  
  function parseDateOnlyToUtc(value: string | null | undefined): Date | null {
    const d = toDateOnly(value);
    if (!d) return null;
  
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
  
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
  
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }
  
  function calcDaysToGoal(dateTo: string | null | undefined): number | null {
    const end = parseDateOnlyToUtc(dateTo);
    if (!end) return null;
  
    const today = startOfTodayUtc();
    const diffMs = end.getTime() - today.getTime();
    return Math.ceil(diffMs / (24 * 3600 * 1000));
  }
  
  function normalizeTarget(targetJson: Record<string, any> | null | undefined): GoalTarget {
    if (!targetJson || typeof targetJson !== "object") return {};
  
    const out: GoalTarget = {};
  
    const timeS = Number(targetJson.time_s);
    const paceS = Number(targetJson.pace_s_per_km);
    const hrCeiling = Number(targetJson.hr_ceiling);
    const distanceKm = Number(targetJson.distance_km);
  
    if (Number.isFinite(timeS)) out.time_s = timeS;
    if (Number.isFinite(paceS)) out.pace_s_per_km = paceS;
    if (Number.isFinite(hrCeiling)) out.hr_ceiling = hrCeiling;
    if (Number.isFinite(distanceKm)) out.distance_km = distanceKm;
  
    for (const [key, value] of Object.entries(targetJson)) {
      if (!(key in out)) out[key] = value;
    }
  
    return out;
  }
  
  export function normalizeGoal(row: GoalRow): NormalizedGoal {
    const dateFrom = toDateOnly(row.date_from);
    const dateTo = toDateOnly(row.date_to);
    const daysToGoal = calcDaysToGoal(dateTo);
  
    return {
      id: row.id,
      title: row.title ?? null,
      type: row.type ?? null,
      sport: row.sport ?? null,
      status: row.status ?? null,
      dateFrom,
      dateTo,
      daysToGoal,
      isExpired: daysToGoal != null ? daysToGoal < 0 : false,
      target: normalizeTarget(row.target_json),
      progress: row.progress_cache && typeof row.progress_cache === "object" ? row.progress_cache : {},
      notes: row.notes ?? null,
      source: row,
    };
  }
  
  function scoreGoal(row: GoalRow): number {
    let score = 0;
  
    const status = String(row.status ?? "").toLowerCase();
    const dateTo = toDateOnly(row.date_to);
    const daysToGoal = calcDaysToGoal(dateTo);
  
    if (status.includes("active")) score += 1000;
    if (status.includes("current")) score += 900;
    if (status.includes("progress")) score += 800;
    if (status.includes("planned")) score += 300;
  
    if (daysToGoal != null) {
      if (daysToGoal >= 0) {
        score += 500;
        score += Math.max(0, 365 - Math.min(daysToGoal, 365));
      } else {
        score -= 5000;
      }
    }
  
    if (row.date_to) score += 50;
    if (row.target_json && typeof row.target_json === "object") score += 25;
    if (row.title) score += 10;
  
    return score;
  }
  
  export function pickPrimaryGoal(rows: GoalRow[]): GoalRow | null {
    if (!rows.length) return null;
  
    const sorted = [...rows].sort((a, b) => {
      const scoreDiff = scoreGoal(b) - scoreGoal(a);
      if (scoreDiff !== 0) return scoreDiff;
  
      const aDate = toDateOnly(a.date_to) ?? "9999-12-31";
      const bDate = toDateOnly(b.date_to) ?? "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
  
      const aCreated = String(a.created_at ?? "");
      const bCreated = String(b.created_at ?? "");
      return bCreated.localeCompare(aCreated);
    });
  
    return sorted[0] ?? null;
  }
  
  export async function loadUserGoals(params: {
    supabase: any;
    userId: string;
    limit?: number;
  }): Promise<GoalRow[]> {
    const { supabase, userId, limit = 20 } = params;
  
    const { data, error } = await supabase
      .from("goals")
      .select(
        [
          "id",
          "user_id",
          "title",
          "type",
          "sport",
          "date_from",
          "date_to",
          "status",
          "target_json",
          "progress_cache",
          "notes",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .order("date_to", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
  
    if (error || !data) return [];
    return data as GoalRow[];
  }
  
  export async function loadPrimaryGoal(params: {
    supabase: any;
    userId: string;
  }): Promise<NormalizedGoal | null> {
    const rows = await loadUserGoals(params);
    const picked = pickPrimaryGoal(rows);
    if (!picked) return null;
    return normalizeGoal(picked);
  }
  
  export function formatGoalForLLM(goal: NormalizedGoal | null) {
    if (!goal) return null;
  
    return {
      id: goal.id,
      title: goal.title,
      type: goal.type,
      sport: goal.sport,
      status: goal.status,
      date_from: goal.dateFrom,
      date_to: goal.dateTo,
      days_to_goal: goal.daysToGoal,
      is_expired: goal.isExpired,
      target: goal.target,
      progress: goal.progress,
      notes: goal.notes,
    };
  }