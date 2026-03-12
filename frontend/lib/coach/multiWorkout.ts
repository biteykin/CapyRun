import type { SupabaseClient } from "@supabase/supabase-js";

type JsonMap = Record<string, any>;

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

export type MultiWorkoutPayload = {
  requested_window: MultiWorkoutRequestedWindow;
  question_kind: MultiWorkoutQuestionKind;
  summary_windows: SummaryWindowMetrics[];
  monthly_buckets: MonthlyBucket[];
  detailed_recent_workouts: DetailedWorkoutRow[];
  facts_only_recommended: boolean;
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
const MONTHLY_BUCKETS_MONTHS = 12;
const MAX_DETAILED_WORKOUTS = 80;

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

function applyWorkoutToAccumulator(acc: MetricsAccumulator, row: DetailedWorkoutRow) {
  const distance = Number(row.distance_m ?? 0);
  const duration = Number(row.duration_sec ?? 0);
  const avgHr = row.avg_hr != null ? Number(row.avg_hr) : null;
  const avgPace = row.avg_pace_s_per_km != null ? Number(row.avg_pace_s_per_km) : null;
  const avgSpeed = row.avg_speed_kmh != null ? Number(row.avg_speed_kmh) : null;
  const sport = String(row.sport ?? "").toLowerCase();
  const dayKey = startOfDayIso(row.start_time ?? row.created_at);

  acc.workouts_count += 1;
  if (sport === "run") acc.run_count += 1;

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
    "километраж",
    "километр",
    "дистанц",
    "время трениров",
    "сколько часов",
    "сколько минут",
    "сколько пробеж",
    "сколько трениров",
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
    "километраж",
    "сколько тренировок",
    "сколько было тренировок",
    "сколько пробежек",
    "сколько километров",
    "сколько часов",
    "последние недели",
    "последние месяцы",
    "за поледние",
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
    .gte("start_time", detailedSince)
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
    .limit(5000);

  if (error || !data) return [];
  return data as DetailedWorkoutRow[];
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
    const dateStr = row.start_time ?? row.created_at;
    const dt = dateStr ? new Date(dateStr) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;

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
    const dateStr = row.start_time ?? row.created_at;
    const dt = dateStr ? new Date(dateStr) : null;
    if (!dt || Number.isNaN(dt.getTime()) || dt < cutoff) continue;

    const key = monthKey(dateStr);
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

export async function loadMultiWorkoutPayload(params: {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  userText: string;
}): Promise<MultiWorkoutPayload> {
  const { supabase, userId, userText } = params;

  const [allRows, detailedRecent] = await Promise.all([
    loadAllTimeSummaryRows({ supabase, userId }),
    loadDetailedRecentWorkouts({ supabase, userId }),
  ]);

  const requested_window = parseRequestedWindowFromText(userText);
  const question_kind = detectMultiWorkoutQuestionKind(userText);
  const summary_windows = buildSummaryWindows(allRows);
  const monthly_buckets = buildMonthlyBuckets(allRows);

  return {
    requested_window,
    question_kind,
    summary_windows,
    monthly_buckets,
    detailed_recent_workouts: detailedRecent,
    facts_only_recommended: question_kind === "factual_summary",
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

export function buildLocalMultiWorkoutFactAnswer(payload: MultiWorkoutPayload) {
  const w = pickWindow(payload, payload.requested_window);
  const w3m = pickWindow(payload, "3m");
  const w6m = pickWindow(payload, "6m");
  const w12m = pickWindow(payload, "12m");
  const all = pickWindow(payload, "all_time");

  if (!w) return null;

  if (payload.requested_window === "3m" && w3m) {
    return [
      `За последние 3 месяца у нас было ${w3m.workouts_count} тренировок.`,
      `Общий объём: ${formatKm(w3m.total_distance_km)} и ${formatHours(w3m.total_duration_h)}.`,
      w3m.longest_distance_km != null
        ? `Самая длинная тренировка за этот период — ${formatKm(w3m.longest_distance_km)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (payload.requested_window === "6m" && w6m) {
    return [
      `За последние 6 месяцев у нас было ${w6m.workouts_count} тренировок.`,
      `Общий объём: ${formatKm(w6m.total_distance_km)} и ${formatHours(w6m.total_duration_h)}.`,
      w6m.longest_distance_km != null
        ? `Самая длинная тренировка за этот период — ${formatKm(w6m.longest_distance_km)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (payload.requested_window === "12m" && w12m) {
    return [
      `За последние 12 месяцев у нас было ${w12m.workouts_count} тренировок.`,
      `Общий объём: ${formatKm(w12m.total_distance_km)} и ${formatHours(w12m.total_duration_h)}.`,
      w12m.longest_distance_km != null
        ? `Самая длинная тренировка за этот период — ${formatKm(w12m.longest_distance_km)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (payload.requested_window === "all_time" && all) {
    return [
      `За всё время у нас было ${all.workouts_count} тренировок.`,
      `Общий объём: ${formatKm(all.total_distance_km)} и ${formatHours(all.total_duration_h)}.`,
      all.longest_distance_km != null
        ? `Самая длинная тренировка за всё время — ${formatKm(all.longest_distance_km)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `За ${w.title} у нас было ${w.workouts_count} тренировок.`,
    `Общий объём: ${formatKm(w.total_distance_km)} и ${formatHours(w.total_duration_h)}.`,
    w.longest_distance_km != null
      ? `Самая длинная тренировка — ${formatKm(w.longest_distance_km)}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}