// frontend/lib/coach/utils.ts

import type { WorkoutFact } from "@/lib/coach/types";

// -----------------------------
// Error utils
// -----------------------------
export function normalizeErr(e: any) {
  const name = typeof e?.name === "string" ? e.name : "Error";
  const message = typeof e?.message === "string" ? e.message : String(e);
  const code = (e?.code ?? e?.status ?? e?.response?.status ?? null) as any;

  const cause =
    e?.cause && typeof e.cause === "object"
      ? { name: e.cause.name ?? null, message: e.cause.message ?? null }
      : null;

  const stack = typeof e?.stack === "string" ? e.stack.slice(0, 4000) : null;

  const extra =
    typeof e === "object" && e
      ? {
          status: e.status ?? null,
          type: e.type ?? null,
          param: e.param ?? null,
          request_id: e.request_id ?? e?.headers?.["x-request-id"] ?? null,
        }
      : null;

  return { name, message, code, cause, stack, extra };
}

// -----------------------------
// JSON utils
// -----------------------------
export function safeStringify(value: any, space = 0) {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "bigint") return v.toString();
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        if (typeof v === "function") return "[Function]";
        return v;
      },
      space
    );
  } catch {
    return "{}";
  }
}

export function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

// -----------------------------
// Math / formatting helpers
// -----------------------------
export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function fmtKm(distance_m: number | null) {
  if (!Number.isFinite(Number(distance_m))) return "нет данных";
  const km = Number(distance_m) / 1000;
  return `${km.toFixed(1)} км`;
}

export function fmtSecToMinSec(sec: number | null) {
  if (sec == null) return "нет данных";
  if (!Number.isFinite(Number(sec))) return "нет данных";
  const s = Math.max(0, Math.round(Number(sec)));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function fmtDateIsoToYMD(iso: string | null) {
  if (!iso) return "нет данных";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "нет данных";
  }
}

// -----------------------------
// History / meta helpers
// -----------------------------
export function pickRecentHistory(history: any[] | null | undefined, limit = 14) {
  const arr = Array.isArray(history) ? history : [];
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}

export function didSaveToWorkoutDescription(meta: any): boolean {
  return meta?.saved_to_workout_description === true;
}

// -----------------------------
// Coach text builders
// -----------------------------
export function buildFallbackCoachText(didSave: boolean) {
  const savedLine = didSave
    ? "Принял! Мы сохранили твой ответ как примечание к тренировке (это был первый ответ на вопросы)."
    : "Принял! Ответ получил.";

  return [
    savedLine,
    "Сейчас у нас временная ошибка при генерации ответа тренера — попробуй отправить ещё раз.",
  ].join("\n");
}

function fmtPaceSecPerKm(secPerKm: number | null) {
  if (!Number.isFinite(Number(secPerKm))) return "нет данных";
  const s = Math.max(0, Math.round(Number(secPerKm)));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")} /км`;
}

export function computePaceSecPerKm(workout: WorkoutFact | null | undefined) {
  if (!workout) return null;
  const distM = workout.distance_m;
  if (!Number.isFinite(Number(distM)) || Number(distM) <= 0) return null;
  const timeSec =
    workout.moving_time_sec != null
      ? Number(workout.moving_time_sec)
      : workout.duration_sec != null
        ? Number(workout.duration_sec)
        : null;
  if (!Number.isFinite(Number(timeSec)) || timeSec == null || timeSec <= 0) return null;
  const km = Number(distM) / 1000;
  return timeSec / km;
}

export function buildLocalRpeFollowupAnswer(workout: WorkoutFact | null | undefined, rpeTextRaw: string) {
  const rpe = (rpeTextRaw ?? "").toString().trim().toLowerCase();
  const pace = computePaceSecPerKm(workout);
  const paceStr = fmtPaceSecPerKm(pace);

  const rpeLabel =
    rpe === "легко" ? "Легко — отлично" :
    rpe === "норм" || rpe === "нормально" ? "Норм — хорошо" :
    rpe === "тяжело" ? "Тяжело — окей, бывает" :
    "Принял ощущения";

  const hrLine =
    workout?.avg_hr != null || workout?.max_hr != null
      ? `Пульс: avg ${workout?.avg_hr ?? "нет данных"} / max ${workout?.max_hr ?? "нет данных"}`
      : `Пульс: нет данных`;

  const nextTip =
    rpe === "легко"
      ? "Раз было легко — можем чуть добавить объём или 1 короткий ускоряющий блок в следующей тренировке."
      : rpe === "тяжело"
        ? "Если было тяжело — в следующую тренировку лучше сделать лёгкий восстановительный бег/ходьбу и посмотреть сон/усталость."
        : "Можно продолжать по плану, без резких изменений.";

  return [
    `${rpeLabel}.`,
    workout
      ? `По последней тренировке темп ≈ ${paceStr}.`
      : `Темп по последней тренировке: нет данных.`,
    hrLine,
    nextTip,
    "Хочешь, я предложу тренировку на завтра (20–40 минут) под твоё самочувствие?",
  ].join("\n");
}