// lib/coach/responder.ts
import OpenAI from "openai";
import {
  PlannerOut,
  WorkoutFact,
  StructuredPlan,
  StructuredPlanSession,
  ResponderResult,
} from "./types";
import { safeJsonParse, safeStringify } from "./utils";
import { COACH_MODELS } from "./modelConfig";
import { appendMotivationalTail } from "./motivation";

type WeeklySchedule = {
  run_days?: string[];
  ofp_days?: string[];
};

type GoalSnapshot = {
  title: string | null;
  targetDate: string | null;
  notes: string | null;
  raw: any | null;
};

type JsonObject = Record<string, unknown>;

type PlanStepDraft = {
  type?: string;
  label: string;
  duration_min?: number | null;
  distance_km?: number | null;
  repeats?: number | null;
  sets?: number | null;
  target?: string | null;
  notes?: string | null;
};

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function getTodayDateOnlyUtc() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const m = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateOnly;

  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(",", ".").trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseDistanceKmFromText(...values: Array<string | null | undefined>): number | null {
  for (const raw of values) {
    const text = String(raw ?? "").replace(",", ".").trim();
    if (!text) continue;

    const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*км\b/i);
    if (kmMatch) {
      const n = Number(kmMatch[1]);
      if (Number.isFinite(n)) return n;
    }

    const meterMatch = text.match(/(\d+(?:\.\d+)?)\s*м\b/i);
    if (meterMatch) {
      const n = Number(meterMatch[1]);
      if (Number.isFinite(n)) return Number((n / 1000).toFixed(2));
    }
  }
  return null;
}

function parseDurationMinFromText(...values: Array<string | null | undefined>): number | null {
  for (const raw of values) {
    const text = String(raw ?? "").replace(",", ".").trim();
    if (!text) continue;

    const minMatch = text.match(/(\d+(?:\.\d+)?)\s*мин\b/i);
    if (minMatch) {
      const n = Number(minMatch[1]);
      if (Number.isFinite(n)) return Math.round(n);
    }

    const hourMinMatch = text.match(/(\d+)\s*ч(?:ас|аса|)\s*(\d+)?\s*мин?/i);
    if (hourMinMatch) {
      const h = Number(hourMinMatch[1] ?? 0);
      const m = Number(hourMinMatch[2] ?? 0);
      const total = h * 60 + m;
      if (Number.isFinite(total) && total > 0) return total;
    }
  }
  return null;
}

function inferEffortFromText(...values: Array<string | null | undefined>): string | null {
  const joined = normalizeText(values.filter(Boolean).join(" "));
  if (!joined) return null;

  if (/очень легко|восстанов/.test(joined)) return "очень легко";
  if (/легк/.test(joined)) return "легко";
  if (/умерен|комфорт/.test(joined)) return "умеренно";
  if (/темпов|порог/.test(joined)) return "умеренно-тяжело";
  if (/интервал|ускор/.test(joined)) return "тяжелые отрезки, восстановление между ними";
  return null;
}

function stringifyStructuredValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as JsonObject;
          const name = pickString(obj.name, obj.label, obj.title);
          const reps = pickNumber(obj.reps, obj.repeats);
          const sets = pickNumber(obj.sets);
          const duration = pickString(obj.duration, obj.duration_sec, obj.duration_min);
          const chunks = [
            name,
            sets != null ? `${sets} подхода` : null,
            reps != null ? `${reps} повторений` : null,
            duration,
          ].filter(Boolean);
          return chunks.join(", ");
        }
        return null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return String(value);
}

function startOfIsoWeek(dateOnly: string) {
  const m = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateOnly;

  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextIsoMondayFrom(dateOnly: string) {
  const thisMonday = startOfIsoWeek(dateOnly);
  return addDaysToDateOnly(thisMonday, 7);
}

function inferPlanAnchorDate(userText: string, planner: PlannerOut): string {
  const t = normalizeText(userText);
  const today = getTodayDateOnlyUtc();

  const explicitlyNextWeek =
    /следующ(ую|ей)\s+недел/.test(t) ||
    /на\s+следующую\s+неделю/.test(t);

  const weeklyPlanLike =
    /на\s+7\s*(дн|дня|дней)/.test(t) ||
    /на\s+недел/.test(t) ||
    /на\s+14\s*(дн|дня|дней)/.test(t) ||
    /на\s+2\s*недел/.test(t);

  if (explicitlyNextWeek || weeklyPlanLike || planner?.intent === "plan") {
    return nextIsoMondayFrom(today);
  }

  return today;
}

function normalizeStructuredPlanDates(
  plan: StructuredPlan | null,
  userText: string,
  planner: PlannerOut
): StructuredPlan | null {
  if (!plan) return null;

  const anchor = inferPlanAnchorDate(userText, planner);

  const sessions = (plan.sessions ?? []).map((session, idx) => {
    const dayIndex =
      typeof session.day_index === "number" && Number.isFinite(session.day_index)
        ? Math.max(0, Math.trunc(session.day_index))
        : idx;

    const normalizedDate = addDaysToDateOnly(anchor, dayIndex);

    return {
      ...session,
      day_index: dayIndex,
      date: normalizedDate,
    };
  });

  const horizonDays =
    Number.isFinite(Number(plan.horizon_days)) && Number(plan.horizon_days) > 0
      ? Math.trunc(Number(plan.horizon_days))
      : parsePlanHorizonDays(userText, planner) ?? sessions.length;

  const trimmedSessions = sessions.filter((session) => {
    const dayIndex =
      typeof session.day_index === "number" && Number.isFinite(session.day_index)
        ? Math.max(0, Math.trunc(session.day_index))
        : 0;

    return dayIndex < horizonDays;
  });

  const finalSessions =
    trimmedSessions.length > 0
      ? trimmedSessions
      : sessions.slice(0, Math.max(1, horizonDays));

  const endsOn = addDaysToDateOnly(anchor, Math.max(0, horizonDays - 1));

  return {
    ...plan,
    starts_on: anchor,
    ends_on: endsOn,
    overwrite_range: {
      from: anchor,
      to: endsOn,
    },
    sessions: finalSessions,
  };
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s || null;
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeNullableNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePositiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sumStepDurations(steps: PlanStepDraft[]): number | null {
  const total = steps.reduce((sum, step) => {
    const duration = step.duration_min ?? null;
    const multiplier =
      (step.sets != null && Number.isFinite(step.sets) && step.sets > 0
        ? step.sets
        : null) ??
      (step.repeats != null && Number.isFinite(step.repeats) && step.repeats > 0
        ? step.repeats
        : null) ??
      1;
    if (duration == null || !Number.isFinite(duration)) return sum;
    return sum + duration * multiplier;
  }, 0);

  return total > 0 ? Math.round(total) : null;
}

function extractHrTargetFromText(...values: Array<string | null | undefined>): string | null {
  for (const raw of values) {
    const text = String(raw ?? "").trim();
    if (!text) continue;

    const pulseMatch =
      text.match(/пульс\s*(?:до|не выше|не выше чем)?\s*(\d{2,3})/i) ??
      text.match(/до\s*(\d{2,3})\s*уд\/?мин/i) ??
      text.match(/(\d{2,3})\s*уд\/?мин/i);

    if (pulseMatch?.[1]) {
      return `до ${pulseMatch[1]}`;
    }
  }

  return null;
}

function extractHrTargetFromSteps(steps: PlanStepDraft[]): string | null {
  for (const step of steps) {
    const target = normalizeNullableString(step.target);
    const notes = normalizeNullableString(step.notes);
    const found = extractHrTargetFromText(target, notes);
    if (found) return found;
  }
  return null;
}

function parseDurationMinutes(text: string | null | undefined): number | null {
  const s = normalizeText(text ?? "");
  if (!s) return null;

  const m1 = s.match(/(\d+(?:[.,]\d+)?)\s*мин/);
  if (m1) {
    return Math.round(Number(String(m1[1]).replace(",", ".")));
  }

  const m2 = s.match(/(\d+(?:[.,]\d+)?)\s*час/);
  if (m2) {
    return Math.round(Number(String(m2[1]).replace(",", ".")) * 60);
  }

  return null;
}

function parseDistanceKm(text: string | null | undefined): number | null {
  const s = normalizeText(text ?? "");
  if (!s) return null;

  const km = s.match(/(\d+(?:[.,]\d+)?)\s*км\b/);
  if (km) return Number(String(km[1]).replace(",", "."));

  const meters = s.match(/(\d+(?:[.,]\d+)?)\s*м\b/);
  if (meters) return Number(String(meters[1]).replace(",", ".")) / 1000;

  return null;
}

function parseRepeats(text: string | null | undefined): number | null {
  const s = normalizeText(text ?? "");
  if (!s) return null;

  const xPattern = s.match(/(\d+)\s*[xх×]\s*\d+/i);
  if (xPattern) return Number(xPattern[1]);

  const repeatsPattern = s.match(/(\d+)\s*интервал/);
  if (repeatsPattern) return Number(repeatsPattern[1]);

  return null;
}

function parseStrengthExerciseLine(line: string): PlanStepDraft | null {
  const clean = normalizeWhitespace(line);
  if (!clean) return null;

  let m =
    clean.match(/^(.+?):\s*(\d+)\s*подход[а-я]*\s*по\s*(\d+)\s*повтор/i) ||
    clean.match(/^(.+?)\s+(\d+)\s*[xх×]\s*(\d+)\b/i);

  if (m) {
    return {
      type: "exercise",
      label: normalizeWhitespace(m[1]) ?? "Упражнение",
      sets: Number(m[2]),
      repeats: Number(m[3]),
    };
  }

  m =
    clean.match(/^(.+?):\s*(\d+)\s*подход[а-я]*\s*по\s*(\d+)\s*сек/i) ||
    clean.match(/^(.+?)\s+(\d+)\s*[xх×]\s*(\d+)\s*сек/i);

  if (m) {
    return {
      type: "exercise",
      label: normalizeWhitespace(m[1]) ?? "Упражнение",
      sets: Number(m[2]),
      duration_min: Number(m[3]) / 60,
    };
  }

  return null;
}

function coerceStep(raw: unknown): PlanStepDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const label =
    normalizeNullableString(item.label) ??
    normalizeNullableString(item.name) ??
    normalizeNullableString(item.title) ??
    "Шаг";

  const durationMin =
    normalizeNullableNumber(item.duration_min) ??
    parseDurationMinutes(normalizeNullableString(item.duration)) ??
    parseDurationMinutes(normalizeNullableString(item.notes)) ??
    null;

  const distanceKm =
    normalizeNullableNumber(item.distance_km) ??
    parseDistanceKm(normalizeNullableString(item.distance)) ??
    parseDistanceKm(label) ??
    null;

  const repeats =
    normalizeNullableNumber(item.repeats) ?? parseRepeats(label) ?? null;

  const sets = normalizeNullableNumber(item.sets) ?? null;

  return normalizeDraftStep({
    type: normalizeNullableString(item.type) ?? undefined,
    label,
    duration_min: durationMin,
    distance_km: distanceKm,
    repeats,
    sets,
    target: normalizeNullableString(item.target),
    notes: normalizeNullableString(item.notes),
  });
}

function dedupePlanSteps(steps: PlanStepDraft[]): PlanStepDraft[] {
  const out: PlanStepDraft[] = [];
  const seen = new Set<string>();

  for (const step of steps) {
    const key = JSON.stringify({
      type: step.type ?? null,
      label: step.label,
      duration_min: step.duration_min ?? null,
      distance_km: step.distance_km ?? null,
      repeats: step.repeats ?? null,
      sets: step.sets ?? null,
      target: step.target ?? null,
      notes: step.notes ?? null,
    });

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(step);
  }

  return out;
}

function normalizeStepType(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function inferStepTypeFromLabel(label: string | null | undefined): string | null {
  const s = normalizeText(label ?? "");
  if (!s) return null;
  if (/размин/.test(s)) return "warmup";
  if (/замин/.test(s)) return "cooldown";
  if (/восстанов|отдых|ходьб/.test(s)) return "recovery";
  if (/присед|планк|отжим|выпад|ягодич|кор|пресс/.test(s)) return "exercise";
  if (/интервал|отрезок|ускор/.test(s)) return "interval";
  if (/основн/.test(s)) return "main";
  return null;
}

function normalizeDraftStep(step: PlanStepDraft): PlanStepDraft {
  const normalizedType = step.type ?? inferStepTypeFromLabel(step.label) ?? null;

  return {
    ...step,
    type: normalizedType ?? undefined,
    distance_km:
      step.distance_km != null && Number.isFinite(step.distance_km) && step.distance_km > 0
        ? step.distance_km
        : null,
    duration_min:
      step.duration_min != null && Number.isFinite(step.duration_min) && step.duration_min > 0
        ? step.duration_min
        : null,
    repeats:
      step.repeats != null && Number.isFinite(step.repeats) && step.repeats > 0
        ? step.repeats
        : null,
    sets:
      step.sets != null && Number.isFinite(step.sets) && step.sets > 0 ? step.sets : null,
  };
}

function cleanupSessionSteps(steps: PlanStepDraft[]): PlanStepDraft[] {
  const normalized = dedupePlanSteps(steps.map(normalizeDraftStep));
  const out: PlanStepDraft[] = [];

  let hasWarmup = false;
  let hasCooldown = false;
  let hasMain = false;

  for (const step of normalized) {
    const t = normalizeStepType(step.type);

    if (t === "warmup") {
      if (hasWarmup) continue;
      hasWarmup = true;
      out.push(step);
      continue;
    }

    if (t === "cooldown") {
      if (hasCooldown) continue;
      hasCooldown = true;
      out.push(step);
      continue;
    }

    if (t === "main") {
      const labelKey =
        normalizeText(step.label) === "основная часть" ? "__generic_main__" : normalizeText(step.label);

      const signature = JSON.stringify({
        label: labelKey,
        distance_km: step.distance_km ?? null,
        duration_min: step.duration_min ?? null,
        target: step.target ?? null,
      });

      const alreadySameMain = out.some((existing) => {
        if (normalizeStepType(existing.type) !== "main") return false;
        const existingLabelKey =
          normalizeText(existing.label) === "основная часть"
            ? "__generic_main__"
            : normalizeText(existing.label);
        const existingSignature = JSON.stringify({
          label: existingLabelKey,
          distance_km: existing.distance_km ?? null,
          duration_min: existing.duration_min ?? null,
          target: existing.target ?? null,
        });
        return existingSignature === signature;
      });

      if (alreadySameMain) continue;

      if (!hasMain) {
        hasMain = true;
        out.push(step);
        continue;
      }

      if (
        step.distance_km == null &&
        step.duration_min == null &&
        !step.target &&
        !step.notes
      ) {
        continue;
      }

      out.push(step);
      continue;
    }

    out.push(step);
  }

  return out;
}

function computeFinalDurationMin(args: {
  explicitDurationMin: number | null;
  sport: string;
  main: string | null;
  warmup: string | null;
  cooldown: string | null;
  strengthBlock: string | null;
  notes: string | null;
  steps: PlanStepDraft[];
}): number | null {
  const {
    explicitDurationMin,
    sport,
    main,
    warmup,
    cooldown,
    strengthBlock,
    notes,
    steps,
  } = args;

  if (explicitDurationMin != null && Number.isFinite(explicitDurationMin)) {
    return explicitDurationMin;
  }

  const isStrength = sport === "strength";

  if (isStrength) {
    const fromText =
      parseDurationMinutes(main) ??
      parseDurationMinutes(notes) ??
      parseDurationMinutes(strengthBlock) ??
      null;

    if (fromText != null) return fromText;

    const fromSteps = sumStepDurations(steps);
    if (fromSteps != null) return fromSteps;
  }

  const hasMainDuration =
    steps.some((step) => {
      const t = normalizeStepType(step.type);
      return (t === "main" || t === "interval" || t === "recovery") && step.duration_min != null;
    }) || parseDurationMinutes(main) != null;

  if (!hasMainDuration) {
    return null;
  }

  const summed = sumStepDurations(steps);
  if (summed != null) return summed;

  const fromMain = parseDurationMinutes(main);
  if (fromMain != null) {
    const wu = parseDurationMinutes(warmup) ?? 0;
    const cd = parseDurationMinutes(cooldown) ?? 0;
    return fromMain + wu + cd;
  }

  return null;
}

function buildIntervalStepsFromText(main: string | null | undefined): PlanStepDraft[] {
  const s = normalizeText(main ?? "");
  if (!s) return [];

  const minuteIntervals = s.match(
    /(\d+)\s*(?:повтор(?:ений|а)?|интервал(?:ов|а)?|отрезк(?:а|ов)?)\s*по\s*(\d+)\s*мин/
  );
  const meterIntervals = s.match(
    /(\d+)\s*(?:повтор(?:ений|а)?|интервал(?:ов|а)?|отрезк(?:а|ов)?)\s*по\s*(\d+)\s*м/
  );
  const recoveryMin = s.match(
    /(\d+)\s*мин(?:ут[аы]?)?\s*(?:ходьбы|трусцы|восстановления|отдыха)/
  );
  const recoveryMeters = s.match(
    /(\d+)\s*м\s*(?:ходьбы|трусцы|восстановления|отдыха)/
  );

  if (!minuteIntervals && !meterIntervals) return [];

  const repeats = Number((minuteIntervals ?? meterIntervals)?.[1]);
  const runMin = minuteIntervals ? Number(minuteIntervals[2]) : null;
  const runKm = meterIntervals ? Number(meterIntervals[2]) / 1000 : null;

  const out: PlanStepDraft[] = [
    {
      type: "interval",
      label: "Быстрый отрезок",
      duration_min: runMin,
      distance_km: runKm,
      repeats,
      notes: "Рабочий интервал",
    },
  ];

  if (recoveryMin || recoveryMeters) {
    out.push({
      type: "recovery",
      label: "Восстановление",
      duration_min: recoveryMin ? Number(recoveryMin[1]) : null,
      distance_km: recoveryMeters ? Number(recoveryMeters[1]) / 1000 : null,
      repeats,
      notes: "Между отрезками",
    });
  }

  return out.map(normalizeDraftStep);
}

function extractStrengthExercises(text: string | null | undefined): PlanStepDraft[] {
  const source = normalizeNullableString(text);
  if (!source) return [];

  const normalized = source
    .replace(/[•●▪–—]/g, "\n")
    .replace(/;\s*/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  const lines = normalized
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const steps: PlanStepDraft[] = [];

  for (const line of lines) {
    const clean = line.replace(/^[-*]\s*/, "").trim();
    const parsed = parseStrengthExerciseLine(clean);
    if (parsed) steps.push(parsed);
  }

  return dedupePlanSteps(steps);
}

function buildStrengthBlockText(steps: PlanStepDraft[]): string | null {
  if (!steps.length) return null;

  return steps
    .map((step) => {
      const parts: string[] = [step.label];
      if (step.sets != null && step.repeats != null) {
        parts.push(`${step.sets}x${step.repeats}`);
      } else if (step.sets != null && step.duration_min != null) {
        const secs = Math.round(step.duration_min * 60);
        parts.push(`${step.sets}x${secs} сек`);
      } else if (step.repeats != null) {
        parts.push(`${step.repeats} повторений`);
      } else if (step.duration_min != null) {
        const secs = Math.round(step.duration_min * 60);
        parts.push(`${secs} сек`);
      }
      if (step.notes) {
        parts.push(step.notes);
      }
      return parts.join(", ");
    })
    .join("; ");
}

function enrichStructureFromSessionParts(args: {
  sport: string;
  title: string;
  goal: string | null;
  main: string | null;
  notes: string | null;
  effort: string | null;
  hrTarget: string | null;
  warmup: string | null;
  cooldown: string | null;
  durationMin: number | null;
  distanceKm: number | null;
  steps: PlanStepDraft[];
  strengthBlock: string | null;
}) {
  const {
    sport,
    title,
    goal,
    main,
    notes,
    effort,
    hrTarget,
    warmup,
    cooldown,
    durationMin,
    distanceKm,
    steps,
    strengthBlock,
  } = args;

  let nextSteps = dedupePlanSteps(steps.filter(Boolean).map(normalizeDraftStep));
  let nextStrengthBlock = normalizeNullableString(strengthBlock);

  if (!nextSteps.length && /интервал/i.test(`${title} ${goal ?? ""} ${main ?? ""}`)) {
    nextSteps = buildIntervalStepsFromText(main).map(normalizeDraftStep);
  }

  const isStrength = sport === "strength" || /офп|сил/i.test(title);

  if (isStrength && !nextSteps.length) {
    nextSteps = extractStrengthExercises([main, notes, goal].filter(Boolean).join("\n")).map(
      normalizeDraftStep
    );
  }

  const isRunLike = sport === "run";
  if (isRunLike && !/интервал/i.test(`${title} ${goal ?? ""} ${main ?? ""}`)) {
    if (!nextSteps.some((s) => s.type === "warmup") && warmup) {
      nextSteps.push(
        normalizeDraftStep({
          type: "warmup",
          label: "Разминка",
          duration_min: parseDurationMinutes(warmup),
          distance_km: parseDistanceKm(warmup),
        })
      );
    }

    if (!nextSteps.some((s) => s.type === "main") && (main || distanceKm != null || durationMin != null)) {
      nextSteps.push(
        normalizeDraftStep({
          type: "main",
          label: "Основная часть",
          duration_min:
            parseDurationMinutes(main) ?? (distanceKm == null ? durationMin : null),
          distance_km: distanceKm ?? parseDistanceKm(main),
          target: hrTarget ?? null,
        })
      );
    }

    if (!nextSteps.some((s) => s.type === "cooldown") && cooldown) {
      nextSteps.push(
        normalizeDraftStep({
          type: "cooldown",
          label: "Заминка",
          duration_min: parseDurationMinutes(cooldown),
          distance_km: parseDistanceKm(cooldown),
        })
      );
    }
  }

  nextSteps = dedupePlanSteps(nextSteps.map(normalizeDraftStep));

  if (isStrength && !nextStrengthBlock) {
    nextStrengthBlock = buildStrengthBlockText(nextSteps);
  }

  const finalWarmup =
    warmup ?? (isStrength ? "5–7 минут суставной разминки и мягкой активации" : null);
  const finalCooldown =
    cooldown ?? (isStrength ? "5 минут лёгкой растяжки и восстановления дыхания" : null);
  const finalMain =
    main ?? (isStrength && nextStrengthBlock ? `Основной блок: ${nextStrengthBlock}` : null);
  const finalNotes =
    notes ??
    (isStrength
      ? "Держи технику, не работай через боль, особенно если есть дискомфорт в стопе."
      : null);

  const normalizedDistanceKm =
    distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : null;

  const normalizedDurationMin =
    durationMin != null && Number.isFinite(durationMin) && durationMin > 0
      ? durationMin
      : sumStepDurations(nextSteps);

  return {
    goal,
    main: finalMain,
    notes: finalNotes,
    steps: nextSteps,
    effort,
    warmup: finalWarmup,
    fueling: null,
    cooldown: finalCooldown,
    hr_target: hrTarget,
    hydration: null,
    distance_km: normalizedDistanceKm,
    duration_min: normalizedDurationMin,
    strength_block: nextStrengthBlock,
  };
}

function draftsToSessionSteps(drafts: PlanStepDraft[]): StructuredPlanSession["steps"] {
  return drafts.slice(0, 100).map((s) => ({
    type: s.type,
    label: s.label,
    duration_min: s.duration_min ?? null,
    distance_km: s.distance_km != null && s.distance_km > 0 ? s.distance_km : null,
    repeats: s.repeats ?? null,
    sets: s.sets ?? null,
    target: s.target ?? null,
    notes: s.notes ?? null,
  }));
}

// Экспортируем "быстрый" локальный ответ, чтобы route.ts мог обойти planner/LLM
export function buildWeeklyScheduleLocalResponse(
  userText: string,
  threadMemory: any | null
): string | null {
  const ws = getWeeklyScheduleFromMemory(threadMemory);
  if (!ws) return null;

  if (isScheduleOnlyWeeklyRequest(userText)) {
    return buildLocalNoLoadWeeklyPlan({ mem: threadMemory, ws });
  }

  if (isOfpWhenRequest(userText)) {
    const ofp = (ws.ofp_days ?? []).map(dayCodeToRu);
    if (!ofp.length) return `По weekly_schedule у нас не задан день ОФП.`;
    return `ОФП по weekly_schedule: ${ofp.join(", ")}.`;
  }

  const forced = isForceOfpOnDay(userText);
  if (forced.ok) {
    const ofp = (ws.ofp_days ?? []).map(dayCodeToRu);
    if (!ofp.length) return `По weekly_schedule у нас не задан день ОФП.`;
    const asked = forced.dayRu ?? "этот день";
    if (!ofp.includes(asked)) {
      return `По weekly_schedule ОФП стоит на: ${ofp.join(", ")}. На ${asked} я не поставлю ОФП, чтобы не ломать расписание.`;
    }
    return `ОФП по weekly_schedule: ${ofp.join(", ")}.`;
  }

  return null;
}

function getWeeklyScheduleFromMemory(mem: any | null): WeeklySchedule | null {
  try {
    const ws =
      mem?.preferences?.weekly_schedule ??
      mem?.preferences?.weeklySchedule ??
      mem?.weekly_schedule ??
      null;

    if (!ws || typeof ws !== "object") return null;

    const run_days = Array.isArray((ws as any).run_days) ? (ws as any).run_days : [];
    const ofp_days = Array.isArray((ws as any).ofp_days) ? (ws as any).ofp_days : [];

    const norm = (arr: any[]) =>
      arr
        .map((x) => String(x ?? "").trim().toLowerCase())
        .filter(Boolean);

    const out: WeeklySchedule = {
      run_days: norm(run_days),
      ofp_days: norm(ofp_days),
    };

    if (!out.run_days?.length && !out.ofp_days?.length) return null;
    return out;
  } catch {
    return null;
  }
}

function buildGoalSnapshotFromUnknown(raw: any): GoalSnapshot | null {
  try {
    if (!raw) return null;

    if (typeof raw === "string") {
      return {
        title: raw.trim() || null,
        targetDate: null,
        notes: null,
        raw,
      };
    }

    if (typeof raw === "object") {
      return {
        title:
          String(
            raw.title ??
              raw.name ??
              raw.goal ??
              raw.target ??
              raw.event_name ??
              ""
          ).trim() || null,
        targetDate:
          String(
            raw.date_to ??
              raw.dateTo ??
              raw.target_date ??
              raw.targetDate ??
              raw.event_date ??
              raw.eventDate ??
              raw.date ??
              ""
          ).trim() || null,
        notes: String(raw.notes ?? raw.description ?? "").trim() || null,
        raw,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getGoalFromMemory(mem: any | null): GoalSnapshot | null {
  const raw =
    mem?.goal ??
    mem?.goals?.current ??
    mem?.goals?.primary ??
    mem?.profile?.goal ??
    mem?.preferences?.goal ??
    null;

  return buildGoalSnapshotFromUnknown(raw);
}

function getEffectiveGoalSnapshot(goal: any | null | undefined, mem: any | null): GoalSnapshot | null {
  const explicit = buildGoalSnapshotFromUnknown(goal);
  if (explicit?.title || explicit?.targetDate || explicit?.notes) return explicit;
  return getGoalFromMemory(mem);
}

function dayCodeToRu(d: string): string {
  const map: Record<string, string> = {
    mon: "Понедельник",
    tue: "Вторник",
    wed: "Среда",
    thu: "Четверг",
    fri: "Пятница",
    sat: "Суббота",
    sun: "Воскресенье",
  };
  return map[(d ?? "").toLowerCase()] ?? d;
}

function pickPreferredMinutes(mem: any | null, fallback = 40): number {
  const v =
    mem?.preferences?.preferred_session_minutes?.value ??
    mem?.preferences?.preferred_session_minutes ??
    null;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.max(10, Math.min(240, n)) : fallback;
}

function pickConstraints(mem: any | null): string {
  return String(mem?.profile?.constraints ?? mem?.constraints ?? "").trim();
}

function parsePlanHorizonDays(text: string, planner: PlannerOut): number | null {
  const t = normalizeText(text);

  if (/\b60\s*(дн|дня|дней)\b/.test(t) || /2\s*месяц/.test(t) || /два месяца/.test(t)) {
    return 60;
  }

  if (/\b30\s*(дн|дня|дней)\b/.test(t) || /на месяц/.test(t) || /ближайший месяц/.test(t)) {
    return 30;
  }

  if (/\b14\s*(дн|дня|дней)\b/.test(t) || /2\s*недел/.test(t) || /две недел/.test(t)) {
    return 14;
  }

  if (
    /\b7\s*(дн|дня|дней)\b/.test(t) ||
    /на неделю/.test(t) ||
    /на недел/.test(t) ||
    /ближайшую неделю/.test(t) ||
    /следующую неделю/.test(t)
  ) {
    return 7;
  }

  const windowDays = Number(planner?.needs?.workouts_window_days ?? 0);
  if ([7, 14, 30, 60].includes(windowDays)) return windowDays;

  return null;
}

function isReadOnlyPlanIntent(userText: string, planner: PlannerOut): boolean {
  const t = normalizeText(userText);

  if (planner?.intent === "plan") return true;

  return (
    /составь план/.test(t) ||
    /предложи план/.test(t) ||
    /дай план/.test(t) ||
    /распиши план/.test(t) ||
    /распиши тренировки/.test(t) ||
    /план трениров/.test(t) ||
    /как мне тренироваться ближайш/.test(t)
  );
}

function isScheduleOnlyWeeklyRequest(text: string): boolean {
  const t = normalizeText(text);

  if (!t) return false;

  const asksPlan =
    /составь план/.test(t) ||
    /дай план/.test(t) ||
    /предложи план/.test(t) ||
    /план трениров/.test(t) ||
    /распиши тренировки/.test(t) ||
    /как мне тренироваться/.test(t);

  if (asksPlan) return false;

  return (
    /план на неделю по моему расписанию/.test(t) ||
    /раскидай по дням недели/.test(t) ||
    /какие у меня дни бега/.test(t) ||
    /какие у меня дни офп/.test(t) ||
    /по weekly_schedule/.test(t) ||
    /по моему weekly schedule/.test(t)
  );
}

function isOfpWhenRequest(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  return /когда.*офп/.test(t) || /на\s+какой\s+день.*офп/.test(t) || /куда.*офп/.test(t);
}

function isForceOfpOnDay(text: string): { ok: boolean; dayRu?: string } {
  const t = (text ?? "").toLowerCase();
  const m = t.match(
    /офп\s+на\s+(понедельник|вторник|среду|среда|четверг|пятниц(у|а)|суббот(у|а)|воскресенье)/i
  );

  if (!m) return { ok: false };

  const raw = String(m[1] ?? "").toLowerCase();
  const ru = raw
    .replace("среду", "Среда")
    .replace("среда", "Среда")
    .replace("понедельник", "Понедельник")
    .replace("вторник", "Вторник")
    .replace("четверг", "Четверг")
    .replace("пятницу", "Пятница")
    .replace("пятница", "Пятница")
    .replace("субботу", "Суббота")
    .replace("суббота", "Суббота")
    .replace("воскресенье", "Воскресенье");

  return { ok: true, dayRu: ru };
}

function buildLocalNoLoadWeeklyPlan(args: { mem: any | null; ws: WeeklySchedule }): string {
  const { mem, ws } = args;
  const mins = pickPreferredMinutes(mem, 40);
  const constraints = pickConstraints(mem);

  const runDays = (ws.run_days ?? []).map(dayCodeToRu);
  const ofpDays = (ws.ofp_days ?? []).map(dayCodeToRu);

  const runText = `лёгкая ходьба или очень спокойный бег ${Math.max(20, Math.min(mins, 45))} мин (комфортно, без усталости)`;
  const ofpText = `ОФП без ударной нагрузки ${Math.max(20, Math.min(mins, 45))} мин: мобильность, баланс, растяжка`;
  const restText = `отдых / прогулка 20–40 мин + лёгкая растяжка 5–10 мин`;

  const lines: string[] = [];

  for (const d of runDays) lines.push(`- ${d}: ${runText}`);
  for (const d of ofpDays) lines.push(`- ${d}: ${ofpText}`);

  lines.push(`- Остальные дни: ${restText}`);

  const header = `План на неделю без нагрузки по твоему weekly_schedule${
    constraints ? ` (${constraints})` : ""
  }:`;

  return [header, ...lines].join("\n");
}

function shouldApplyMotivationLayer(userText: string, answer: string, planner: PlannerOut) {
  if (!answer.trim()) return false;
  if (planner?.intent === "plan") return false;

  const t = (userText ?? "").toLowerCase();

  if (
    /этот план/.test(t) ||
    /помогает.*цели/.test(t) ||
    /дойти до цели/.test(t) ||
    /почему такой план/.test(t)
  ) {
    return false;
  }

  if (
    /сколько/.test(t) ||
    /километраж/.test(t) ||
    /общий километраж/.test(t) ||
    /сколько км/.test(t) ||
    /сколько часов/.test(t) ||
    /общее время/.test(t) ||
    /какие виды спорта/.test(t) ||
    /какие типы тренировок/.test(t) ||
    /по каким видам спорта/.test(t)
  ) {
    return false;
  }

  return true;
}

function buildResponderSystemPrompt(params: {
  userText: string;
  planner: PlannerOut;
  goal?: any | null;
  threadMemory: any | null;
}) {
  const { userText, planner, goal, threadMemory } = params;

  const horizonDays = parsePlanHorizonDays(userText, planner);
  const ws = getWeeklyScheduleFromMemory(threadMemory);
  const effectiveGoal = getEffectiveGoalSnapshot(goal, threadMemory);

  const base = [
    "Ты — тренер внутри приложения. Отвечай по-русски.",
    "Не выдумывай факты и цифры: используй только данные из контекста.",
    "Если данных не хватает — скажи, каких именно не хватает, и предложи безопасную альтернативу.",
    "",
    "КРИТИЧНО: ПРАВИЛА weekly_schedule (структурная память).",
    "Если в памяти есть preferences.weekly_schedule:",
    "- План ДОЛЖЕН следовать этим дням (run_days / ofp_days).",
    "- НЕ использовать формат 'День 1/2/3' — только конкретные дни недели.",
    "- НЕ спрашивать, когда начать.",
    "- Если запрошен план на неделю / 2 недели — привязать его к дням недели из weekly_schedule.",
    "- Если спросили 'когда поставить ОФП' — отвечать строго согласно weekly_schedule.",
    "- weekly_schedule имеет приоритет над preferred_days_per_week.",
    "",
    "СТИЛЬ ОТВЕТА:",
    "- Кратко, по делу, по-русски.",
    "- Не пиши сухим канцеляритом.",
    "- Не называй человека 'пользователь'.",
    "- Если вопрос про самочувствие, мотивацию, уверенность, тяжёлый период или сомнения — отвечай по-человечески и поддерживающе.",
    "- Не давай ложную мотивацию и не хвали без причины.",
    "- Не добавляй длинные общие дисклеймеры.",
    "",
  ];

  if (planner?.intent === "plan") {
    const planRules = [
      "СЕЙЧАС ТИП ЗАПРОСА: READ-ONLY ПЛАНИРОВАНИЕ ТРЕНИРОВОК.",
      "Нужно предложить план тренировок без записи в БД.",
      "Это предложение и объяснение, а не подтверждённый план.",
      "Нужно сверяться с целью из контекста, если она есть.",
      "Нужно коротко сказать, помогает ли предложенный план двигаться к цели.",
      "Не строй план до самой цели целиком — только на запрошенный горизонт.",
      "Если горизонт 7 или 14 дней — план должен быть максимально детальным.",
      "Максимально детальный план = для каждого бегового дня обязательно указывать:",
      "- цель тренировки;",
      "- длительность и/или дистанцию;",
      "- структуру: разминка / основная часть / заминка;",
      "- ориентир по усилию;",
      "- при возможности ориентир по пульсу или по ощущениям.",
      "Если горизонт 30 или 60 дней — дай рамочный план по неделям, а первые 7–14 дней распиши детально.",
      "Для ОФП указывай упражнения, подходы и повторения или время.",
      "Если уместно, добавляй краткие советы по питью/еде до или после ключевых тренировок.",
      "Не обещай результат, если данных недостаточно.",
      "Если есть ограничения / травм-риски / плохое восстановление в памяти — делай план осторожнее.",
      "Не делай из каждого дня тяжёлую тренировку.",
      "Если weekly_schedule есть — используй только эти дни для бега и ОФП.",
      "Если weekly_schedule нет — можешь предложить разумную раскладку по дням недели.",
      "",
      "ФОРМАТ ДЛЯ ПЛАНА В ТЕКСТЕ:",
      "## Кратко",
      "## Как это связано с целью",
      "## План",
      "## На что обратить внимание",
      "",
      "ПОМНИ: кроме текста ты должен вернуть и структурированный JSON плана.",
      "JSON должен быть пригоден для последующей записи плана в БД без повторного парсинга текста.",
      "КРИТИЧНО: JSON нужен не для галочки — он потом используется в карточке запланированной тренировки.",
      "Поэтому для КАЖДОЙ тренировки заполняй максимально подробно не только текст ответа, но и structured_plan.sessions[].*.",
      "Если в тексте тренировки есть детали, они ОБЯЗАНЫ попасть в JSON.",
      "Обязательно заполни в JSON:",
      "- kind = 'draft_training_plan';",
      "- starts_on;",
      "- ends_on;",
      "- overwrite_range.from и overwrite_range.to;",
      "- sessions[].day_index;",
      "- sessions[].date;",
      "- sessions[].title;",
      "- sessions[].sport;",
      "- sessions[].structure.",
      "- sessions[].goal;",
      "- sessions[].duration_min и/или sessions[].distance_km;",
      "- sessions[].warmup;",
      "- sessions[].main;",
      "- sessions[].cooldown;",
      "- sessions[].effort;",
      "- sessions[].hr_target, если есть ориентир по пульсу;",
      "- sessions[].notes, если есть важные комментарии/ограничения;",
      "- sessions[].steps для интервальных и сложных тренировок;",
      "- sessions[].strength_block и sessions[].steps для ОФП/силовой.",
      "",
      "ПРАВИЛА КАЧЕСТВА ДЛЯ JSON:",
      "- Не оставляй structure пустым, если в тексте уже есть детали.",
      "- Если это интервалы, steps должны описывать рабочий отрезок и восстановление, а repeats должен быть заполнен.",
      "- Если это ОФП, перечисли упражнения в strength_block и по возможности добавь их в steps.",
      "- Если указана длительность в тексте, перенеси её в duration_min.",
      "- Если указана дистанция в тексте, перенеси её в distance_km.",
      "- Не пиши бессмысленные labels вроде 'Шаг' — называй шаги конкретно: 'Быстрый отрезок', 'Восстановление', 'Приседания', 'Планка'.",
    ];

    if (horizonDays != null) {
      planRules.push(`ТЕКУЩИЙ ЗАПРОШЕННЫЙ ГОРИЗОНТ: ${horizonDays} дней.`);
    }

    if (effectiveGoal?.title || effectiveGoal?.targetDate || effectiveGoal?.notes) {
      planRules.push(
        `ЦЕЛЬ ИЗ КОНТЕКСТА: ${safeStringify(
          {
            title: effectiveGoal?.title,
            target_date: effectiveGoal?.targetDate,
            notes: effectiveGoal?.notes,
          },
          2
        )}`
      );
    } else {
      planRules.push("ЦЕЛЬ ИЗ КОНТЕКСТА: явной цели не найдено. Не выдумывай её.");
    }

    if (ws) {
      planRules.push(
        `WEEKLY_SCHEDULE ИЗ ПАМЯТИ: ${safeStringify(
          {
            run_days: ws.run_days ?? [],
            ofp_days: ws.ofp_days ?? [],
          },
          2
        )}`
      );
    }

    return [
      ...base,
      ...planRules,
      "",
      "Если вопрос про план или цель — отвечай аналитически и конкретно, без общих фраз.",
      "Формат: кратко, по делу. Можно списком.",
    ].join("\n");
  }

  return [...base, "Формат: кратко, по делу. Можно списком."].join("\n");
}

function buildPlanResponseSchema() {
  const planStepItem = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      label: { type: "string" },
      duration_min: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
      distance_km: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
      repeats: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
      sets: {
        anyOf: [{ type: "number" }, { type: "null" }],
      },
      target: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      notes: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    },
    required: [
      "type",
      "label",
      "duration_min",
      "distance_km",
      "repeats",
      "sets",
      "target",
      "notes",
    ],
  } as const;

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      structured_plan: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: true,
            properties: {
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    steps: {
                      anyOf: [
                        { type: "null" },
                        {
                          type: "array",
                          items: planStepItem,
                        },
                      ],
                    },
                    strength_block: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
    required: ["text", "structured_plan"],
  } as const;
}

function normalizeStructuredPlanSession(
  item: any,
  idx: number,
  startsOn: string
): StructuredPlanSession {
  const itemObj = asObject(item) ?? {};
  const nestedStructure = asObject(itemObj.structure) ?? {};
  const rawStructure =
    itemObj.structure && typeof itemObj.structure === "object"
      ? (itemObj.structure as Record<string, unknown>)
      : null;

  const dayIndex =
    typeof itemObj.day_index === "number" && Number.isFinite(itemObj.day_index)
      ? Math.max(0, Math.trunc(itemObj.day_index))
      : idx;

  const date =
    normalizeDateOnly(pickString(itemObj.date, itemObj.planned_date)) ??
    addDaysToDateOnly(startsOn, dayIndex);

  const title = pickString(itemObj.title) ?? "Тренировка";
  const sport = pickString(itemObj.sport) ?? "run";
  const sessionType = itemObj.session_type != null ? String(itemObj.session_type) : null;
  const status =
    itemObj.status === "draft" || itemObj.status === "planned" ? itemObj.status : "planned";

  const goal = pickString(itemObj.goal, nestedStructure.goal);
  const warmup = pickString(itemObj.warmup, nestedStructure.warmup);
  const main = pickString(itemObj.main, nestedStructure.main);
  const cooldown = pickString(itemObj.cooldown, nestedStructure.cooldown);
  const hrTarget = pickString(itemObj.hr_target, nestedStructure.hr_target);
  const fueling = pickString(itemObj.fueling, nestedStructure.fueling);
  const hydration = pickString(itemObj.hydration, nestedStructure.hydration);
  const notes =
    pickString(itemObj.notes, nestedStructure.notes) ??
    (rawStructure && rawStructure.notes != null ? String(rawStructure.notes) : null);
  const weekday = pickString(itemObj.weekday, itemObj.day_label);

  const explicitDurationMin =
    (() => {
      const raw =
        pickNumber(itemObj.duration_min, nestedStructure.duration_min) ??
        parseDurationMinutes(pickString(itemObj.duration_text, nestedStructure.duration_text)) ??
        null;
      return raw != null && Number.isFinite(raw) ? Math.round(raw) : null;
    })();

  const distanceKmFromFields =
    pickNumber(itemObj.distance_km, nestedStructure.distance_km) ??
    parseDistanceKmFromText(title, main, notes);
  const distanceKm =
    distanceKmFromFields != null && Number.isFinite(distanceKmFromFields)
      ? distanceKmFromFields
      : null;

  const normalizedGoal = goal ?? normalizeNullableString(rawStructure?.goal) ?? null;
  const normalizedMain = main ?? normalizeNullableString(rawStructure?.main) ?? null;
  const normalizedWarmup = warmup ?? normalizeNullableString(rawStructure?.warmup) ?? null;
  const normalizedCooldown = cooldown ?? normalizeNullableString(rawStructure?.cooldown) ?? null;
  const normalizedEffort =
    pickString(itemObj.effort, nestedStructure.effort) ??
    inferEffortFromText(title, main, notes);
  const normalizedFueling = fueling ?? normalizeNullableString(rawStructure?.fueling) ?? null;
  const normalizedHydration = hydration ?? normalizeNullableString(rawStructure?.hydration) ?? null;

  const normalizedDistanceKm =
    distanceKm ??
    normalizeNullableNumber(rawStructure?.distance_km) ??
    parseDistanceKm(title) ??
    parseDistanceKm(normalizedMain) ??
    null;

  const mergedSteps = dedupePlanSteps(
    [
      ...(Array.isArray(itemObj.steps) ? itemObj.steps : []),
      ...(Array.isArray(rawStructure?.steps) ? rawStructure.steps : []),
    ]
      .map(coerceStep)
      .filter(Boolean) as PlanStepDraft[]
  );

  const normalizedHrTarget =
    hrTarget ??
    normalizeNullableString(rawStructure?.hr_target) ??
    extractHrTargetFromText(title, normalizedMain, normalizedWarmup, normalizedCooldown, notes) ??
    extractHrTargetFromSteps(mergedSteps) ??
    null;

  const normalizedDurationMinBeforeEnrich =
    explicitDurationMin ??
    normalizeNullableNumber(rawStructure?.duration_min) ??
    parseDurationMinutes(normalizedMain) ??
    null;

  const strengthBlock =
    pickString(itemObj.strength_block, nestedStructure.strength_block) ??
    stringifyStructuredValue(nestedStructure.exercises);

  const enrichedStructure = enrichStructureFromSessionParts({
    sport,
    title,
    goal: normalizedGoal,
    main: normalizedMain,
    notes,
    effort: normalizedEffort,
    hrTarget: normalizedHrTarget,
    warmup: normalizedWarmup,
    cooldown: normalizedCooldown,
    durationMin: normalizedDurationMinBeforeEnrich,
    distanceKm: normalizedDistanceKm,
    steps: mergedSteps,
    strengthBlock,
  });

  const cleanedSteps = cleanupSessionSteps(enrichedStructure.steps);

  const finalDurationMin = computeFinalDurationMin({
    explicitDurationMin: normalizedDurationMinBeforeEnrich,
    sport,
    main: enrichedStructure.main,
    warmup: enrichedStructure.warmup,
    cooldown: enrichedStructure.cooldown,
    strengthBlock: enrichedStructure.strength_block,
    notes,
    steps: cleanedSteps,
  });

  const sessionSteps = draftsToSessionSteps(cleanedSteps);

  const structure: Record<string, unknown> = rawStructure
    ? {
        ...rawStructure,
        ...enrichedStructure,
        duration_min: finalDurationMin,
        fueling: normalizedFueling,
        hydration: normalizedHydration,
        steps: sessionSteps,
      }
    : {
        ...enrichedStructure,
        duration_min: finalDurationMin,
        fueling: normalizedFueling,
        hydration: normalizedHydration,
        steps: sessionSteps,
      };

  return {
    day_index: dayIndex,
    date,
    weekday,
    title,
    sport,
    session_type: sessionType,
    status,
    goal: enrichedStructure.goal,
    duration_min: finalDurationMin,
    distance_km: enrichedStructure.distance_km,
    effort: enrichedStructure.effort,
    hr_target: enrichedStructure.hr_target,
    warmup: enrichedStructure.warmup,
    main: enrichedStructure.main,
    cooldown: enrichedStructure.cooldown,
    steps: sessionSteps,
    strength_block: enrichedStructure.strength_block,
    fueling: normalizedFueling,
    hydration: normalizedHydration,
    notes: enrichedStructure.notes,
    structure,
  };
}

function normalizeStructuredPlan(raw: any, fallbackHorizonDays: number | null): StructuredPlan | null {
  if (!raw || typeof raw !== "object") return null;

  const startsOn = normalizeDateOnly(raw.starts_on) ?? getTodayDateOnlyUtc();
  const sessionsRaw = Array.isArray(raw.sessions) ? raw.sessions : [];

  const sessions = sessionsRaw
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => normalizeStructuredPlanSession(item, idx, startsOn));

  if (!sessions.length) return null;

  const dated = sessions
    .map((s) => normalizeDateOnly(s.date))
    .filter(Boolean)
    .sort() as string[];

  const endsOn =
    normalizeDateOnly(raw.ends_on) ??
    dated[dated.length - 1] ??
    startsOn;

  const overwriteRangeRaw =
    raw.overwrite_range && typeof raw.overwrite_range === "object"
      ? raw.overwrite_range
      : null;

  const overwriteFrom =
    normalizeDateOnly(overwriteRangeRaw?.from) ??
    dated[0] ??
    startsOn;

  const overwriteTo =
    normalizeDateOnly(overwriteRangeRaw?.to) ??
    dated[dated.length - 1] ??
    endsOn;

  const horizonDays = Number(raw.horizon_days);
  const version = Number(raw.version);

  return {
    version: 1,
    kind: "draft_training_plan",
    horizon_days:
      Number.isFinite(horizonDays) && horizonDays > 0
        ? Math.trunc(horizonDays)
        : fallbackHorizonDays ?? sessions.length,
    starts_on: startsOn,
    ends_on: endsOn,
    goal_id:
      typeof raw.goal_id === "string" && raw.goal_id.trim()
        ? raw.goal_id.trim()
        : null,
    goal_title: raw.goal_title != null ? String(raw.goal_title) : null,
    goal_date:
      normalizeDateOnly(raw.goal_date) ??
      normalizeDateOnly(raw.target_date) ??
      null,
    source_message: raw.source_message != null ? String(raw.source_message) : null,
    summary: raw.summary != null ? String(raw.summary) : null,
    rationale:
      raw.rationale != null
        ? String(raw.rationale)
        : raw.goal_relation != null
        ? String(raw.goal_relation)
        : null,
    overwrite_existing_on_confirm:
      typeof raw.overwrite_existing_on_confirm === "boolean"
        ? raw.overwrite_existing_on_confirm
        : true,
    overwrite_range: {
      from: overwriteFrom,
      to: overwriteTo,
    },
    sessions,
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? raw.metadata
        : {
            attention_points: Array.isArray(raw.attention_points)
              ? raw.attention_points.map((x: any) => String(x)).filter(Boolean)
              : [],
            legacy_kind: raw.kind != null ? String(raw.kind) : null,
            normalized_from_version:
              Number.isFinite(version) && version > 0 ? Math.trunc(version) : null,
          },
  };
}

async function runPlanResponder(args: {
  openai: OpenAI;
  userText: string;
  planner: PlannerOut;
  goal?: any | null;
  threadMemory: any | null;
  workouts: WorkoutFact[];
  coachHome: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}): Promise<ResponderResult> {
  const { openai, userText, planner, goal, threadMemory, workouts, coachHome, recentHistory } = args;

  const system = buildResponderSystemPrompt({
    userText,
    planner,
    goal,
    threadMemory,
  });

  const requestedPlanHorizon = parsePlanHorizonDays(userText, planner);

  const userPayload = safeStringify(
    {
      user_text: userText,
      planner,
      goal,
      memory: threadMemory,
      workouts,
      coach_home: coachHome,
      recent_dialogue: (recentHistory ?? []).slice(-12),
      derived_hints: {
        requested_plan_horizon_days: requestedPlanHorizon,
        goal_snapshot: getEffectiveGoalSnapshot(goal, threadMemory),
        weekly_schedule: getWeeklyScheduleFromMemory(threadMemory),
      },
    },
    2
  );

  const completion = await openai.chat.completions.create({
    model: COACH_MODELS.responder,
    temperature: 0.25,
    max_tokens: 3200,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "coach_plan_response",
        schema: buildPlanResponseSchema(),
      },
    } as any,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          userPayload +
          "\n\nВерни JSON с полями text и structured_plan." +
          "\ntext — готовый ответ для чата." +
          "\nstructured_plan — структурированный план для дальнейшей записи в БД." +
          "\nНе оставляй structured_plan пустым, если действительно предложен план." +
          "\nЕсли план на 7 или 14 дней — sessions должны покрывать весь этот период." +
          "\nДля каждой session.date используй формат YYYY-MM-DD." +
          "\nДля каждой session обязательно максимально заполни: goal, duration_min и/или distance_km, effort, warmup, main, cooldown, notes, structure." +
          "\nДля интервальных тренировок обязательно заполни steps." +
          "\nДля ОФП обязательно заполни strength_block и/или steps с упражнениями." +
          "\nМаксимально наполняй JSON деталями из текста." +
          "\nЕсли это интервалы — обязательно заполни steps и repeats." +
          "\nЕсли это обычный бег (easy / long / tempo) — тоже обязательно заполни steps минимум из 3 блоков: warmup / main / cooldown." +
          "\nЕсли это ОФП/силовая — обязательно заполни strength_block и по возможности steps с упражнениями." +
          "\nДля ОФП в steps указывай упражнения предметно: название, подходы, повторения или длительность удержания." +
          "\nЕсли есть дистанция, обязательно перенеси её в distance_km." +
          "\nЕсли в тексте есть разминка, основная часть, заминка, пульс, длительность, дистанция — всё это должно быть и в JSON.",
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeJsonParse(raw) ?? {};

  const text = String(parsed?.text ?? "").trim();
  const structuredPlanRaw = normalizeStructuredPlan(parsed?.structured_plan, requestedPlanHorizon);
  const structuredPlan = normalizeStructuredPlanDates(
    structuredPlanRaw,
    userText,
    planner
  );

  if (text) {
    return {
      text,
      structured_plan: structuredPlan,
    };
  }

  return {
    text:
      "Не удалось корректно собрать план в нужном формате. Попробуй ещё раз — я пересоберу его аккуратно.",
    structured_plan: structuredPlan,
  };
}

async function runStandardResponder(args: {
  openai: OpenAI;
  userText: string;
  planner: PlannerOut;
  goal?: any | null;
  threadMemory: any | null;
  workouts: WorkoutFact[];
  coachHome: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}): Promise<ResponderResult> {
  const { openai, userText, planner, goal, threadMemory, workouts, coachHome, recentHistory } = args;

  const system = buildResponderSystemPrompt({
    userText,
    planner,
    goal,
    threadMemory,
  });

  const userPayload = safeStringify(
    {
      user_text: userText,
      planner,
      goal,
      memory: threadMemory,
      workouts,
      coach_home: coachHome,
      recent_dialogue: (recentHistory ?? []).slice(-12),
      derived_hints: {
        requested_plan_horizon_days: parsePlanHorizonDays(userText, planner),
        goal_snapshot: getEffectiveGoalSnapshot(goal, threadMemory),
        weekly_schedule: getWeeklyScheduleFromMemory(threadMemory),
      },
    },
    2
  );

  const completion = await openai.chat.completions.create({
    model: COACH_MODELS.responder,
    temperature: 0.2,
    max_tokens: 650,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPayload },
    ],
  });

  let answer = completion.choices[0]?.message?.content ?? "";
  answer = answer.trim();

  if (shouldApplyMotivationLayer(userText, answer, planner)) {
    answer = appendMotivationalTail({
      userText,
      coachText: answer,
    });
  }

  return {
    text: answer,
    structured_plan: null,
  };
}

export async function runResponder(args: {
  openai: OpenAI;
  userText: string;
  planner: PlannerOut;
  goal?: any | null;
  threadMemory: any | null;
  workouts: WorkoutFact[];
  coachHome: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}): Promise<ResponderResult> {
  const { userText, planner } = args;

  if (isReadOnlyPlanIntent(userText, planner)) {
    return runPlanResponder(args);
  }

  return runStandardResponder(args);
}