import type { SupabaseClient } from "@supabase/supabase-js";

export type MultiWorkoutRequestedWindow =
  | "4w"
  | "8w"
  | "16w"
  | "3m"
  | "6m"
  | "12m"
  | "all_time";

export type MultiWorkoutQuestionKind =
  | "factual_summary"
  | "trend_analysis"
  | "progress_analysis";

export type DetailedWorkoutRow = {
  id: string;
  sport: string | null;
  name: string | null;
  start_time: string | null;
  created_at: string | null;
  distance_m: number | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  calories_kcal: number | null;
  description: string | null;
};

export type SummaryWindowMetrics = {
  label: MultiWorkoutRequestedWindow;
  title: string;
  workouts_count: number;
  run_count: number;
  total_distance_km: number;
  total_duration_h: number;
  avg_distance_km: number | null;
  avg_duration_min: number | null;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  longest_distance_km: number | null;
  active_days: number;
};

export type MonthlyBucket = {
  month: string;
  workouts_count: number;
  run_count: number;
  total_distance_km: number;
  total_duration_h: number;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  longest_distance_km: number | null;
};

export type WeeklyBucket = {
  week_start: string;
  workouts_count: number;
  run_count: number;
  total_distance_km: number;
  total_duration_h: number;
  avg_hr: number | null;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  longest_distance_km: number | null;
};

export type SportBreakdownItem = {
  sport: string;
  workouts_count: number;
  total_distance_km: number;
  total_duration_h: number;
};

export type RunBenchmark = {
  workout_id: string;
  start_time: string | null;
  distance_km: number;
  avg_pace_s_per_km: number;
  avg_speed_kmh: number | null;
  avg_hr: number | null;
};

export type BestsSummary = {
  longest_workout: {
    workout_id: string | null;
    start_time: string | null;
    distance_km: number | null;
    sport: string | null;
  };
  longest_run: {
    workout_id: string | null;
    start_time: string | null;
    distance_km: number | null;
  };
  fastest_run: RunBenchmark | null;
};

export type BiggestVolumePoint = {
  label: string | null;
  total_distance_km: number | null;
  workouts_count: number | null;
};

export type TrendComparison = {
  current_label: string;
  previous_label: string;
  workouts_diff: number;
  distance_diff_km: number;
  duration_diff_h: number;
  avg_hr_diff: number | null;
  avg_pace_diff_s_per_km: number | null;
  avg_speed_diff_kmh: number | null;
};

export type ConsistencySummary = {
  active_days_last_4w: number;
  active_days_last_8w: number;
  active_days_last_16w: number;
  avg_workouts_per_week_last_4w: number;
  avg_workouts_per_week_last_8w: number;
  avg_workouts_per_week_last_16w: number;
};

export type MultiWorkoutPayload = {
  requested_window: MultiWorkoutRequestedWindow;
  question_kind: MultiWorkoutQuestionKind;
  summary_windows: SummaryWindowMetrics[];
  monthly_buckets: MonthlyBucket[];
  weekly_buckets: WeeklyBucket[];
  detailed_recent_workouts: DetailedWorkoutRow[];
  detailed_recent_runs: DetailedWorkoutRow[];
  sport_breakdown_all_time: SportBreakdownItem[];
  sport_breakdown_requested_window: SportBreakdownItem[];
  bests: BestsSummary;
  biggest_week: BiggestVolumePoint;
  biggest_month: BiggestVolumePoint;
  comparisons: {
    last4w_vs_prev4w: TrendComparison | null;
    last8w_vs_prev8w: TrendComparison | null;
    last16w_vs_prev16w: TrendComparison | null;
  };
  consistency: ConsistencySummary;
  facts_only_recommended: boolean;
  user_text_normalized: string;
};

type MetricsAccumulator = {
  workouts_count: number;
  run_count: number;
  total_distance_m: number;
  total_duration_sec: number;
  hr_weighted_sum: number;
  hr_weighted_weight: number;
  pace_weighted_sum: number;
  pace_weighted_weight: number;
  speed_weighted_sum: number;
  speed_weighted_weight: number;
  longest_distance_m: number;
  active_days: Set<string>;
};

const WINDOW_TITLES: Record<MultiWorkoutRequestedWindow, string> = {
  "4w": "последние 4 недели",
  "8w": "последние 8 недель",
  "16w": "последние 16 недель",
  "3m": "последние 3 месяца",
  "6m": "последние 6 месяцев",
  "12m": "последние 12 месяцев",
  all_time: "всё время",
};

const DETAILED_WEEKS = 16;
const WEEKLY_BUCKETS_WEEKS = 16;
const MONTHLY_BUCKETS_MONTHS = 12;
const MAX_ALL_TIME_WORKOUTS = 5000;
const MAX_DETAILED_WORKOUTS = 120;

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRunSport(sport: string | null | undefined) {
  return normalizeText(String(sport ?? "")) === "run";
}

function workoutDate(row: DetailedWorkoutRow) {
  const raw = row.start_time ?? row.created_at;
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function startOfDayIso(dateLike: string | null | undefined) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(dateLike: string | null | undefined) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfUtcWeek(dateLike: string | null | undefined) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;

  const day = d.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day; // monday-based week
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + delta);

  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dayStr = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function isoDateTime(date: Date) {
  return date.toISOString();
}

function createAccumulator(): MetricsAccumulator {
  return {
    workouts_count: 0,
    run_count: 0,
    total_distance_m: 0,
    total_duration_sec: 0,
    hr_weighted_sum: 0,
    hr_weighted_weight: 0,
    pace_weighted_sum: 0,
    pace_weighted_weight: 0,
    speed_weighted_sum: 0,
    speed_weighted_weight: 0,
    longest_distance_m: 0,
    active_days: new Set<string>(),
  };
}

function applyWorkoutToAccumulator(acc: MetricsAccumulator, row: DetailedWorkoutRow) {
  const distance = Number(row.distance_m ?? 0);
  const duration = Number(row.duration_sec ?? 0);
  const avgHr = row.avg_hr != null ? Number(row.avg_hr) : null;
  const avgPace = row.avg_pace_s_per_km != null ? Number(row.avg_pace_s_per_km) : null;
  const avgSpeed = row.avg_speed_kmh != null ? Number(row.avg_speed_kmh) : null;
  const dayKey = startOfDayIso(row.start_time ?? row.created_at);

  acc.workouts_count += 1;
  if (isRunSport(row.sport)) acc.run_count += 1;

  if (distance > 0) {
    acc.total_distance_m += distance;
    acc.longest_distance_m = Math.max(acc.longest_distance_m, distance);
  }

  if (duration > 0) {
    acc.total_duration_sec += duration;
  }

  if (avgHr != null && Number.isFinite(avgHr) && duration > 0) {
    acc.hr_weighted_sum += avgHr * duration;
    acc.hr_weighted_weight += duration;
  }

  if (avgPace != null && Number.isFinite(avgPace) && distance > 0) {
    acc.pace_weighted_sum += avgPace * distance;
    acc.pace_weighted_weight += distance;
  }

  if (avgSpeed != null && Number.isFinite(avgSpeed) && duration > 0) {
    acc.speed_weighted_sum += avgSpeed * duration;
    acc.speed_weighted_weight += duration;
  }

  if (dayKey) acc.active_days.add(dayKey);
}

function finalizeAccumulator(
  label: MultiWorkoutRequestedWindow,
  acc: MetricsAccumulator
): SummaryWindowMetrics {
  const avgHr =
    acc.hr_weighted_weight > 0 ? acc.hr_weighted_sum / acc.hr_weighted_weight : null;
  const avgPace =
    acc.pace_weighted_weight > 0 ? acc.pace_weighted_sum / acc.pace_weighted_weight : null;
  const avgSpeed =
    acc.speed_weighted_weight > 0 ? acc.speed_weighted_sum / acc.speed_weighted_weight : null;

  return {
    label,
    title: WINDOW_TITLES[label],
    workouts_count: acc.workouts_count,
    run_count: acc.run_count,
    total_distance_km: round2(acc.total_distance_m / 1000),
    total_duration_h: round2(acc.total_duration_sec / 3600),
    avg_distance_km:
      acc.workouts_count > 0 ? round2(acc.total_distance_m / 1000 / acc.workouts_count) : null,
    avg_duration_min:
      acc.workouts_count > 0 ? round2(acc.total_duration_sec / 60 / acc.workouts_count) : null,
    avg_hr: avgHr != null ? round2(avgHr) : null,
    avg_pace_s_per_km: avgPace != null ? Math.round(avgPace) : null,
    avg_speed_kmh: avgSpeed != null ? round2(avgSpeed) : null,
    longest_distance_km:
      acc.longest_distance_m > 0 ? round2(acc.longest_distance_m / 1000) : null,
    active_days: acc.active_days.size,
  };
}

function buildAccumulatorFromRows(
  rows: DetailedWorkoutRow[],
  filterFn: (row: DetailedWorkoutRow) => boolean
) {
  const acc = createAccumulator();
  for (const row of rows) {
    if (!filterFn(row)) continue;
    applyWorkoutToAccumulator(acc, row);
  }
  return acc;
}

function buildSummaryWindows(rows: DetailedWorkoutRow[]): SummaryWindowMetrics[] {
  const now = new Date();

  const starts = {
    "4w": addDays(now, -28),
    "8w": addDays(now, -56),
    "16w": addDays(now, -112),
    "3m": addMonths(now, -3),
    "6m": addMonths(now, -6),
    "12m": addMonths(now, -12),
  } as const;

  const accs: Record<Exclude<MultiWorkoutRequestedWindow, "all_time">, MetricsAccumulator> = {
    "4w": createAccumulator(),
    "8w": createAccumulator(),
    "16w": createAccumulator(),
    "3m": createAccumulator(),
    "6m": createAccumulator(),
    "12m": createAccumulator(),
  };

  const allTimeAcc = createAccumulator();

  for (const row of rows) {
    const dt = workoutDate(row);
    if (!dt) continue;

    applyWorkoutToAccumulator(allTimeAcc, row);

    (Object.keys(starts) as Array<keyof typeof starts>).forEach((key) => {
      if (dt >= starts[key]) {
        applyWorkoutToAccumulator(accs[key], row);
      }
    });
  }

  return [
    finalizeAccumulator("4w", accs["4w"]),
    finalizeAccumulator("8w", accs["8w"]),
    finalizeAccumulator("16w", accs["16w"]),
    finalizeAccumulator("3m", accs["3m"]),
    finalizeAccumulator("6m", accs["6m"]),
    finalizeAccumulator("12m", accs["12m"]),
    finalizeAccumulator("all_time", allTimeAcc),
  ];
}

function buildMonthlyBuckets(rows: DetailedWorkoutRow[]): MonthlyBucket[] {
  const cutoff = addMonths(new Date(), -MONTHLY_BUCKETS_MONTHS);
  const byMonth = new Map<string, MetricsAccumulator>();

  for (const row of rows) {
    const dt = workoutDate(row);
    if (!dt || dt < cutoff) continue;

    const key = monthKey(row.start_time ?? row.created_at);
    if (!key) continue;

    if (!byMonth.has(key)) {
      byMonth.set(key, createAccumulator());
    }

    applyWorkoutToAccumulator(byMonth.get(key)!, row);
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, acc]) => {
      const avgHr =
        acc.hr_weighted_weight > 0 ? acc.hr_weighted_sum / acc.hr_weighted_weight : null;
      const avgPace =
        acc.pace_weighted_weight > 0 ? acc.pace_weighted_sum / acc.pace_weighted_weight : null;
      const avgSpeed =
        acc.speed_weighted_weight > 0 ? acc.speed_weighted_sum / acc.speed_weighted_weight : null;

      return {
        month,
        workouts_count: acc.workouts_count,
        run_count: acc.run_count,
        total_distance_km: round2(acc.total_distance_m / 1000),
        total_duration_h: round2(acc.total_duration_sec / 3600),
        avg_hr: avgHr != null ? round2(avgHr) : null,
        avg_pace_s_per_km: avgPace != null ? Math.round(avgPace) : null,
        avg_speed_kmh: avgSpeed != null ? round2(avgSpeed) : null,
        longest_distance_km:
          acc.longest_distance_m > 0 ? round2(acc.longest_distance_m / 1000) : null,
      };
    });
}

function buildWeeklyBuckets(rows: DetailedWorkoutRow[]): WeeklyBucket[] {
  const cutoff = addDays(new Date(), -7 * WEEKLY_BUCKETS_WEEKS);
  const byWeek = new Map<string, MetricsAccumulator>();

  for (const row of rows) {
    const dt = workoutDate(row);
    if (!dt || dt < cutoff) continue;

    const key = startOfUtcWeek(row.start_time ?? row.created_at);
    if (!key) continue;

    if (!byWeek.has(key)) {
      byWeek.set(key, createAccumulator());
    }

    applyWorkoutToAccumulator(byWeek.get(key)!, row);
  }

  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week_start, acc]) => {
      const avgHr =
        acc.hr_weighted_weight > 0 ? acc.hr_weighted_sum / acc.hr_weighted_weight : null;
      const avgPace =
        acc.pace_weighted_weight > 0 ? acc.pace_weighted_sum / acc.pace_weighted_weight : null;
      const avgSpeed =
        acc.speed_weighted_weight > 0 ? acc.speed_weighted_sum / acc.speed_weighted_weight : null;

      return {
        week_start,
        workouts_count: acc.workouts_count,
        run_count: acc.run_count,
        total_distance_km: round2(acc.total_distance_m / 1000),
        total_duration_h: round2(acc.total_duration_sec / 3600),
        avg_hr: avgHr != null ? round2(avgHr) : null,
        avg_pace_s_per_km: avgPace != null ? Math.round(avgPace) : null,
        avg_speed_kmh: avgSpeed != null ? round2(avgSpeed) : null,
        longest_distance_km:
          acc.longest_distance_m > 0 ? round2(acc.longest_distance_m / 1000) : null,
      };
    });
}

function buildSportBreakdown(rows: DetailedWorkoutRow[]): SportBreakdownItem[] {
  const map = new Map<string, SportBreakdownItem>();

  for (const row of rows) {
    const sport = normalizeText(row.sport ?? "") || "unknown";
    const existing =
      map.get(sport) ?? {
        sport,
        workouts_count: 0,
        total_distance_km: 0,
        total_duration_h: 0,
      };

    existing.workouts_count += 1;
    existing.total_distance_km += Number(row.distance_m ?? 0) / 1000;
    existing.total_duration_h += Number(row.duration_sec ?? 0) / 3600;

    map.set(sport, existing);
  }

  return Array.from(map.values())
    .map((x) => ({
      sport: x.sport,
      workouts_count: x.workouts_count,
      total_distance_km: round2(x.total_distance_km),
      total_duration_h: round2(x.total_duration_h),
    }))
    .sort((a, b) => {
      if (b.workouts_count !== a.workouts_count) {
        return b.workouts_count - a.workouts_count;
      }
      return b.total_distance_km - a.total_distance_km;
    });
}

function pickRowsForRequestedWindow(
  rows: DetailedWorkoutRow[],
  requestedWindow: MultiWorkoutRequestedWindow
) {
  if (requestedWindow === "all_time") return rows;

  const now = new Date();
  const cutoffMap: Record<Exclude<MultiWorkoutRequestedWindow, "all_time">, Date> = {
    "4w": addDays(now, -28),
    "8w": addDays(now, -56),
    "16w": addDays(now, -112),
    "3m": addMonths(now, -3),
    "6m": addMonths(now, -6),
    "12m": addMonths(now, -12),
  };

  const cutoff = cutoffMap[requestedWindow];
  return rows.filter((row) => {
    const dt = workoutDate(row);
    return Boolean(dt && dt >= cutoff);
  });
}

function buildBests(rows: DetailedWorkoutRow[]): BestsSummary {
  let longestWorkout: DetailedWorkoutRow | null = null;
  let longestRun: DetailedWorkoutRow | null = null;
  let fastestRun: DetailedWorkoutRow | null = null;

  for (const row of rows) {
    const distance = Number(row.distance_m ?? 0);
    if (distance > Number(longestWorkout?.distance_m ?? 0)) {
      longestWorkout = row;
    }

    if (isRunSport(row.sport)) {
      if (distance > Number(longestRun?.distance_m ?? 0)) {
        longestRun = row;
      }

      const pace = Number(row.avg_pace_s_per_km ?? 0);
      const duration = Number(row.duration_sec ?? 0);
      if (
        pace > 0 &&
        distance >= 3000 &&
        duration > 0 &&
        (!fastestRun ||
          pace < Number(fastestRun.avg_pace_s_per_km ?? Number.POSITIVE_INFINITY))
      ) {
        fastestRun = row;
      }
    }
  }

  return {
    longest_workout: {
      workout_id: longestWorkout?.id ?? null,
      start_time: longestWorkout?.start_time ?? longestWorkout?.created_at ?? null,
      distance_km:
        longestWorkout?.distance_m != null ? round2(longestWorkout.distance_m / 1000) : null,
      sport: longestWorkout?.sport ?? null,
    },
    longest_run: {
      workout_id: longestRun?.id ?? null,
      start_time: longestRun?.start_time ?? longestRun?.created_at ?? null,
      distance_km: longestRun?.distance_m != null ? round2(longestRun.distance_m / 1000) : null,
    },
    fastest_run: fastestRun
      ? {
          workout_id: fastestRun.id,
          start_time: fastestRun.start_time ?? fastestRun.created_at ?? null,
          distance_km: round2(Number(fastestRun.distance_m ?? 0) / 1000),
          avg_pace_s_per_km: Math.round(Number(fastestRun.avg_pace_s_per_km ?? 0)),
          avg_speed_kmh:
            fastestRun.avg_speed_kmh != null ? round2(Number(fastestRun.avg_speed_kmh)) : null,
          avg_hr: fastestRun.avg_hr != null ? round2(Number(fastestRun.avg_hr)) : null,
        }
      : null,
  };
}

function buildBiggestWeek(weeklyBuckets: WeeklyBucket[]): BiggestVolumePoint {
  if (!weeklyBuckets.length) {
    return { label: null, total_distance_km: null, workouts_count: null };
  }

  const biggest = [...weeklyBuckets].sort((a, b) => {
    if (b.total_distance_km !== a.total_distance_km) {
      return b.total_distance_km - a.total_distance_km;
    }
    return b.workouts_count - a.workouts_count;
  })[0];

  return {
    label: biggest.week_start,
    total_distance_km: biggest.total_distance_km,
    workouts_count: biggest.workouts_count,
  };
}

function buildBiggestMonth(monthlyBuckets: MonthlyBucket[]): BiggestVolumePoint {
  if (!monthlyBuckets.length) {
    return { label: null, total_distance_km: null, workouts_count: null };
  }

  const biggest = [...monthlyBuckets].sort((a, b) => {
    if (b.total_distance_km !== a.total_distance_km) {
      return b.total_distance_km - a.total_distance_km;
    }
    return b.workouts_count - a.workouts_count;
  })[0];

  return {
    label: biggest.month,
    total_distance_km: biggest.total_distance_km,
    workouts_count: biggest.workouts_count,
  };
}

function metricsFromRows(
  rows: DetailedWorkoutRow[],
  fromInclusive: Date,
  toExclusive: Date
): SummaryWindowMetrics {
  const acc = buildAccumulatorFromRows(rows, (row) => {
    const dt = workoutDate(row);
    return Boolean(dt && dt >= fromInclusive && dt < toExclusive);
  });

  return finalizeAccumulator("4w", acc);
}

function buildComparison(
  rows: DetailedWorkoutRow[],
  currentLabel: string,
  previousLabel: string,
  currentFromInclusive: Date,
  currentToExclusive: Date,
  previousFromInclusive: Date,
  previousToExclusive: Date
): TrendComparison {
  const current = metricsFromRows(rows, currentFromInclusive, currentToExclusive);
  const previous = metricsFromRows(rows, previousFromInclusive, previousToExclusive);

  return {
    current_label: currentLabel,
    previous_label: previousLabel,
    workouts_diff: current.workouts_count - previous.workouts_count,
    distance_diff_km: round2(current.total_distance_km - previous.total_distance_km),
    duration_diff_h: round2(current.total_duration_h - previous.total_duration_h),
    avg_hr_diff:
      current.avg_hr != null && previous.avg_hr != null
        ? round2(current.avg_hr - previous.avg_hr)
        : null,
    avg_pace_diff_s_per_km:
      current.avg_pace_s_per_km != null && previous.avg_pace_s_per_km != null
        ? current.avg_pace_s_per_km - previous.avg_pace_s_per_km
        : null,
    avg_speed_diff_kmh:
      current.avg_speed_kmh != null && previous.avg_speed_kmh != null
        ? round2(current.avg_speed_kmh - previous.avg_speed_kmh)
        : null,
  };
}

function buildComparisons(rows: DetailedWorkoutRow[]) {
  const now = new Date();

  return {
    last4w_vs_prev4w: buildComparison(
      rows,
      "последние 4 недели",
      "предыдущие 4 недели",
      addDays(now, -28),
      now,
      addDays(now, -56),
      addDays(now, -28)
    ),
    last8w_vs_prev8w: buildComparison(
      rows,
      "последние 8 недель",
      "предыдущие 8 недель",
      addDays(now, -56),
      now,
      addDays(now, -112),
      addDays(now, -56)
    ),
    last16w_vs_prev16w: buildComparison(
      rows,
      "последние 16 недель",
      "предыдущие 16 недель",
      addDays(now, -112),
      now,
      addDays(now, -224),
      addDays(now, -112)
    ),
  };
}

function buildConsistency(summaryWindows: SummaryWindowMetrics[]): ConsistencySummary {
  const w4 = summaryWindows.find((x) => x.label === "4w");
  const w8 = summaryWindows.find((x) => x.label === "8w");
  const w16 = summaryWindows.find((x) => x.label === "16w");

  return {
    active_days_last_4w: w4?.active_days ?? 0,
    active_days_last_8w: w8?.active_days ?? 0,
    active_days_last_16w: w16?.active_days ?? 0,
    avg_workouts_per_week_last_4w: w4 ? round2(w4.workouts_count / 4) : 0,
    avg_workouts_per_week_last_8w: w8 ? round2(w8.workouts_count / 8) : 0,
    avg_workouts_per_week_last_16w: w16 ? round2(w16.workouts_count / 16) : 0,
  };
}

function asksDistanceOnly(normalizedText: string) {
  return (
    normalizedText.includes("километраж") ||
    normalizedText.includes("сколько км") ||
    normalizedText.includes("сколько килом") ||
    normalizedText.includes("какая дистанц") ||
    normalizedText.includes("какой объем") ||
    normalizedText.includes("какой объём")
  );
}

function asksDurationOnly(normalizedText: string) {
  return (
    normalizedText.includes("сколько часов") ||
    normalizedText.includes("сколько времени") ||
    normalizedText.includes("сколько минут") ||
    normalizedText.includes("какое время трениров")
  );
}

function asksWorkoutsCountOnly(normalizedText: string) {
  return (
    normalizedText.includes("сколько трениров") ||
    normalizedText.includes("сколько пробеж") ||
    normalizedText.includes("сколько занятий")
  );
}

function asksSportBreakdown(normalizedText: string) {
  return (
    normalizedText.includes("какие еще типы") ||
    normalizedText.includes("какие еще виды") ||
    normalizedText.includes("по каким видам спорта") ||
    normalizedText.includes("по видам спорта") ||
    normalizedText.includes("сколько было тренировок по бегу") ||
    normalizedText.includes("какие виды спорта")
  );
}

export function parseRequestedWindowFromText(userText: string): MultiWorkoutRequestedWindow {
  const t = normalizeText(userText);

  if (
    t.includes("all time") ||
    t.includes("all-time") ||
    t.includes("за все время") ||
    t.includes("за всё время") ||
    t.includes("за весь период") ||
    t.includes("за всю историю")
  ) {
    return "all_time";
  }

  if (
    t.includes("16 недель") ||
    t.includes("16 недел") ||
    t.includes("четыре месяца") ||
    t.includes("4 месяца")
  ) {
    return "16w";
  }

  if (
    t.includes("12 месяцев") ||
    t.includes("12 мес") ||
    t.includes("год") ||
    t.includes("за год")
  ) {
    return "12m";
  }

  if (
    t.includes("6 месяцев") ||
    t.includes("6 мес") ||
    t.includes("полгода") ||
    t.includes("пол года")
  ) {
    return "6m";
  }

  if (
    t.includes("3 месяца") ||
    t.includes("3 мес") ||
    t.includes("три месяца") ||
    t.includes("90 дней")
  ) {
    return "3m";
  }

  if (
    t.includes("8 недель") ||
    t.includes("8 недел") ||
    t.includes("два месяца") ||
    t.includes("2 месяца")
  ) {
    return "8w";
  }

  if (
    t.includes("4 недели") ||
    t.includes("4 недел") ||
    t.includes("последний месяц") ||
    t.includes("за месяц") ||
    t.includes("30 дней")
  ) {
    return "4w";
  }

  return "16w";
}

export function detectMultiWorkoutQuestionKind(userText: string): MultiWorkoutQuestionKind {
  const t = normalizeText(userText);

  const factualTriggers = [
    "сколько",
    "количество",
    "объем",
    "обьем",
    "объём",
    "километраж",
    "километр",
    "дистанц",
    "время трениров",
    "сколько часов",
    "сколько минут",
    "сколько пробеж",
    "сколько трениров",
    "по видам спорта",
    "какие виды спорта",
    "how many",
    "total distance",
    "volume",
    "mileage",
  ];

  const progressTriggers = [
    "прогресс",
    "улучш",
    "стал ли лучше",
    "есть ли прогресс",
    "форма растет",
    "форма растёт",
    "better",
    "progress",
    "improving",
  ];

  for (const trigger of factualTriggers) {
    if (t.includes(trigger)) return "factual_summary";
  }

  for (const trigger of progressTriggers) {
    if (t.includes(trigger)) return "progress_analysis";
  }

  return "trend_analysis";
}

export function isMultiWorkoutIntent(userText: string) {
  const t = normalizeText(userText);

  const triggers = [
    "динамик",
    "прогресс",
    "за последние",
    "за месяц",
    "за 3 месяца",
    "за три месяца",
    "за 6 месяцев",
    "за полгода",
    "за год",
    "за все время",
    "за всё время",
    "за всю историю",
    "как у меня с бегом",
    "как я бегал",
    "как я бегаю",
    "что по бегу",
    "что по тренировкам",
    "что происходит с тренировками",
    "как идут тренировки",
    "какая динамика",
    "что видно по темпу",
    "что видно по пульсу",
    "объем",
    "обьем",
    "объём",
    "километраж",
    "сколько тренировок",
    "сколько было тренировок",
    "сколько пробежек",
    "сколько километров",
    "сколько часов",
    "последние недели",
    "последние месяцы",
    "последняя тренировка",
    "обсудим последнюю тренировку",
    "данные о последней тренировке",
    "пришли данные о последней тренировке",
    "for the last",
    "last month",
    "last months",
    "last weeks",
    "trend",
    "trends",
    "weekly volume",
    "monthly volume",
    "running lately",
  ];

  return triggers.some((trigger) => t.includes(trigger));
}

export function isStrictFactualSummaryQuestion(userText: string) {
  return detectMultiWorkoutQuestionKind(userText) === "factual_summary";
}

async function loadDetailedRecentWorkouts(params: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<DetailedWorkoutRow[]> {
  const { supabase, userId } = params;

  const detailedSince = isoDateTime(addDays(new Date(), -7 * DETAILED_WEEKS));

  const { data, error } = await supabase
    .from("workouts")
    .select(
      [
        "id",
        "sport",
        "name",
        "start_time",
        "created_at",
        "distance_m",
        "duration_sec",
        "moving_time_sec",
        "avg_hr",
        "max_hr",
        "avg_pace_s_per_km",
        "avg_speed_kmh",
        "calories_kcal",
        "description",
      ].join(",")
    )
    .eq("user_id", userId)
    .or(`start_time.gte.${detailedSince},and(start_time.is.null,created_at.gte.${detailedSince})`)
    .order("start_time", { ascending: false })
    .limit(MAX_DETAILED_WORKOUTS);

  if (error || !data) return [];
  return data as DetailedWorkoutRow[];
}

async function loadAllTimeSummaryRows(params: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<DetailedWorkoutRow[]> {
  const { supabase, userId } = params;

  const { data, error } = await supabase
    .from("workouts")
    .select(
      [
        "id",
        "sport",
        "name",
        "start_time",
        "created_at",
        "distance_m",
        "duration_sec",
        "moving_time_sec",
        "avg_hr",
        "max_hr",
        "avg_pace_s_per_km",
        "avg_speed_kmh",
        "calories_kcal",
        "description",
      ].join(",")
    )
    .eq("user_id", userId)
    .order("start_time", { ascending: false })
    .limit(MAX_ALL_TIME_WORKOUTS);

  if (error || !data) return [];
  return data as DetailedWorkoutRow[];
}

export async function loadMultiWorkoutPayload(params: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  userText: string;
}): Promise<MultiWorkoutPayload> {
  const { supabase, userId, userText } = params;

  const user_text_normalized = normalizeText(userText);

  const [allRows, detailedRecent] = await Promise.all([
    loadAllTimeSummaryRows({ supabase, userId }),
    loadDetailedRecentWorkouts({ supabase, userId }),
  ]);

  const requested_window = parseRequestedWindowFromText(userText);
  const question_kind = detectMultiWorkoutQuestionKind(userText);
  const summary_windows = buildSummaryWindows(allRows);
  const monthly_buckets = buildMonthlyBuckets(allRows);
  const weekly_buckets = buildWeeklyBuckets(allRows);
  const requestedRows = pickRowsForRequestedWindow(allRows, requested_window);
  const detailed_recent_runs = detailedRecent.filter((row) => isRunSport(row.sport));

  return {
    requested_window,
    question_kind,
    summary_windows,
    monthly_buckets,
    weekly_buckets,
    detailed_recent_workouts: detailedRecent,
    detailed_recent_runs,
    sport_breakdown_all_time: buildSportBreakdown(allRows),
    sport_breakdown_requested_window: buildSportBreakdown(requestedRows),
    bests: buildBests(allRows),
    biggest_week: buildBiggestWeek(weekly_buckets),
    biggest_month: buildBiggestMonth(monthly_buckets),
    comparisons: buildComparisons(allRows),
    consistency: buildConsistency(summary_windows),
    facts_only_recommended: question_kind === "factual_summary",
    user_text_normalized,
  };
}

function pickWindow(
  payload: MultiWorkoutPayload,
  label: MultiWorkoutRequestedWindow
): SummaryWindowMetrics | null {
  return payload.summary_windows.find((x) => x.label === label) ?? null;
}

function formatHours(hours: number) {
  return `${round2(hours)} ч`;
}

function formatKm(km: number) {
  return `${round2(km)} км`;
}

function formatSportName(sport: string) {
  const map: Record<string, string> = {
    run: "бег",
    strength: "силовые",
    walk: "ходьба",
    swim: "плавание",
    ride: "велосипед",
    yoga: "йога",
    row: "гребля",
    crossfit: "кроссфит",
    other: "другое",
    unknown: "неизвестно",
  };

  return map[sport] ?? sport;
}

export function buildLocalMultiWorkoutFactAnswer(payload: MultiWorkoutPayload) {
  const w = pickWindow(payload, payload.requested_window);
  const t = payload.user_text_normalized;

  if (!w) return null;

  if (asksSportBreakdown(t)) {
    const rows =
      payload.requested_window === "all_time"
        ? payload.sport_breakdown_all_time
        : payload.sport_breakdown_requested_window;

    const header =
      payload.requested_window === "all_time"
        ? "За всё время по видам спорта:"
        : `За ${w.title} по видам спорта:`;

    const lines = rows.slice(0, 10).map((item) => {
      const bits = [
        `- ${formatSportName(item.sport)}: ${item.workouts_count} тренировок`,
        item.total_distance_km > 0 ? `· ${formatKm(item.total_distance_km)}` : null,
        item.total_duration_h > 0 ? `· ${formatHours(item.total_duration_h)}` : null,
      ].filter(Boolean);

      return bits.join(" ");
    });

    return [header, ...lines].join("\n");
  }

  if (asksDistanceOnly(t) && !asksDurationOnly(t) && !asksWorkoutsCountOnly(t)) {
    return `${w.title[0].toUpperCase()}${w.title.slice(1)} у нас ${formatKm(
      w.total_distance_km
    )} общего объёма.`;
  }

  if (asksDurationOnly(t) && !asksDistanceOnly(t) && !asksWorkoutsCountOnly(t)) {
    return `${w.title[0].toUpperCase()}${w.title.slice(1)} у нас ${formatHours(
      w.total_duration_h
    )} тренировочного времени.`;
  }

  if (asksWorkoutsCountOnly(t) && !asksDistanceOnly(t) && !asksDurationOnly(t)) {
    return `${w.title[0].toUpperCase()}${w.title.slice(1)} у нас было ${w.workouts_count} тренировок.`;
  }

  const lines: string[] = [];

  if (payload.requested_window === "all_time") {
    lines.push(`За всё время у нас было ${w.workouts_count} тренировок.`);
  } else if (payload.requested_window === "3m") {
    lines.push(`За последние 3 месяца у нас было ${w.workouts_count} тренировок.`);
  } else if (payload.requested_window === "6m") {
    lines.push(`За последние 6 месяцев у нас было ${w.workouts_count} тренировок.`);
  } else if (payload.requested_window === "12m") {
    lines.push(`За последние 12 месяцев у нас было ${w.workouts_count} тренировок.`);
  } else {
    lines.push(`За ${w.title} у нас было ${w.workouts_count} тренировок.`);
  }

  lines.push(`Общий объём: ${formatKm(w.total_distance_km)} и ${formatHours(w.total_duration_h)}.`);

  if (w.longest_distance_km != null) {
    if (payload.requested_window === "all_time") {
      lines.push(`Самая длинная тренировка за всё время — ${formatKm(w.longest_distance_km)}.`);
    } else {
      lines.push(`Самая длинная тренировка за этот период — ${formatKm(w.longest_distance_km)}.`);
    }
  }

  return lines.join("\n");
}