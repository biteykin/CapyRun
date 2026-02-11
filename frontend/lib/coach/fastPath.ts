// frontend/lib/coach/fastPath.ts
import { PlannerOut, WorkoutFact } from "./types";
import { fmtDateIsoToYMD, fmtKm, fmtSecToMinSec } from "./utils";

function sumKm(workouts: WorkoutFact[]) {
  const m = workouts
    .map((w) => (Number.isFinite(Number(w.distance_m)) ? Number(w.distance_m) : 0))
    .reduce((a, b) => a + b, 0);
  return m / 1000;
}

function inIsoRange(start_time: string | null, fromIso: string, toIso: string) {
  if (!start_time) return false;
  const ts = new Date(start_time).getTime();
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(ts) || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  return ts >= a && ts <= b;
}

function isRun(w: WorkoutFact) {
  return (w.sport ?? "").toLowerCase() === "run";
}

function safeNum(n: any): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function toFiniteIntOrNull(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function buildFastPathAnswer(
  kind: NonNullable<NonNullable<PlannerOut["fast_path"]>["kind"]>,
  workouts: WorkoutFact[],
  windowDays: number,
  nth?: number,
  from_iso?: string,
  to_iso?: string
) {
  if (kind === "count_workouts") {
    return `За последние ${windowDays} дней у тебя ${workouts.length} тренировок.`;
  }

  if (kind === "sum_distance_run") {
    const runs = workouts.filter((w) => isRun(w) && (safeNum(w.distance_m) ?? 0) > 0);
    if (!runs.length) return `Не вижу пробежек за последние ${windowDays} дней (нет данных).`;
    const km = sumKm(runs);
    return `Суммарно пробежал(а) за последние ${windowDays} дней: ${km.toFixed(
      1
    )} км (по данным, которые вижу в приложении).`;
  }

  if (kind === "range_workout_stats") {
    const fromIso = (from_iso ?? "").trim();
    const toIso = (to_iso ?? "").trim();
    if (!fromIso || !toIso) {
      return `Не могу посчитать по периоду — не заданы границы дат (from/to).`;
    }

    const inRange = workouts.filter((w) => inIsoRange(w.start_time, fromIso, toIso));
    const count = inRange.length;

    // total distance for ANY workouts that have distance_m > 0
    const withDist = inRange.filter((w) => Number.isFinite(Number(w.distance_m)) && Number(w.distance_m) > 0);
    const totalKm = sumKm(withDist);

    // run-only distance
    const runs = inRange.filter((w) => isRun(w) && Number.isFinite(Number(w.distance_m)) && Number(w.distance_m) > 0);
    const runKm = sumKm(runs);

    const fromYmd = fmtDateIsoToYMD(fromIso);
    const toYmd = fmtDateIsoToYMD(toIso);

    return [
      `С ${fromYmd} по ${toYmd}:`,
      `• Тренировок: ${count}`,
      `• Суммарная дистанция (везде, где есть дистанция): ${totalKm.toFixed(1)} км`,
      `• Из них бег: ${runKm.toFixed(1)} км`,
    ].join("\n");
  }

  if (kind === "nth_workout") {
    // Если nth отсутствует или битый (NaN/Infinity/строка) — дефолт = 2 (предпоследняя).
    const parsed = toFiniteIntOrNull(nth);
    const raw = parsed ?? 2;
    const n = Math.max(1, Math.min(50, raw));
    const w = workouts[n - 1];

    if (!w) {
      return `Не нашёл(ла) тренировку #${n} с конца в окне ${windowDays} дней (всего в окне: ${workouts.length}).`;
    }

    return [
      `Тренировка #${n} с конца (в окне ${windowDays} дней):`,
      `• Дата: ${fmtDateIsoToYMD(w.start_time)}`,
      `• Спорт: ${w.sport ?? "нет данных"}`,
      `• Дистанция: ${fmtKm(w.distance_m)}`,
      `• Длительность: ${w.duration_sec != null ? `${w.duration_sec} сек` : "нет данных"} (${fmtSecToMinSec(
        w.duration_sec
      )})`,
      `• Moving time: ${w.moving_time_sec != null ? `${w.moving_time_sec} сек` : "нет данных"} (${fmtSecToMinSec(
        w.moving_time_sec
      )})`,
      `• Пульс: avg ${w.avg_hr ?? "нет данных"} / max ${w.max_hr ?? "нет данных"}`,
    ].join("\n");
  }

  if (kind === "last_workout") {
    const w = workouts[0];
    if (!w) return `За последние ${windowDays} дней тренировок не найдено.`;

    const date = fmtDateIsoToYMD(w.start_time);
    const sport = w.sport ?? "нет данных";
    const dist = fmtKm(w.distance_m);

    const missing: string[] = [];
    if (w.moving_time_sec == null) missing.push("moving time");
    if (w.avg_hr == null && w.max_hr == null) missing.push("пульс");

    const coachy =
      missing.length > 0 ? `Вижу тренировку, но в данных не хватает: ${missing.join(", ")}.` : `Ок, вижу последнюю активность.`;

    return [
      `Последняя тренировка (за последние ${windowDays} дней):`,
      `• Дата: ${date}`,
      `• Спорт: ${sport}`,
      `• Дистанция: ${dist}`,
      `• Длительность: ${w.duration_sec != null ? `${w.duration_sec} сек` : "нет данных"} (${fmtSecToMinSec(
        w.duration_sec
      )})`,
      `• Moving time: ${w.moving_time_sec != null ? `${w.moving_time_sec} сек` : "нет данных"} (${fmtSecToMinSec(
        w.moving_time_sec
      )})`,
      `• Пульс: avg ${w.avg_hr ?? "нет данных"} / max ${w.max_hr ?? "нет данных"}`,
      ``,
      coachy,
      `Как по ощущениям она прошла — легко/норм/тяжело?`,
    ].join("\n");
  }

  if (kind === "longest_workout") {
    const withDist = workouts.filter((w) => Number.isFinite(Number(w.distance_m)));
    if (!withDist.length) return `Не вижу дистанции в тренировках за последние ${windowDays} дней (нет данных).`;

    const max = withDist.reduce((a, b) => (Number(b.distance_m) > Number(a.distance_m) ? b : a), withDist[0]);
    const same = withDist.filter((w) => Number(w.distance_m) === Number(max.distance_m));

    if (same.length > 1) {
      return `Самая длинная тренировка за последние ${windowDays} дней — ${fmtKm(max.distance_m)} (их ${
        same.length
      }: ${same.map((w) => fmtDateIsoToYMD(w.start_time)).join(", ")}).`;
    }

    return `Самая длинная тренировка за последние ${windowDays} дней — ${fmtKm(max.distance_m)} (${fmtDateIsoToYMD(
      max.start_time
    )}).`;
  }

  // list_workouts
  if (!workouts.length) return `За последние ${windowDays} дней тренировок не найдено.`;

  const lines = workouts.map((w, i) => {
    return [
      `${i + 1}) ${fmtDateIsoToYMD(w.start_time)} • ${w.sport ?? "нет данных"}`,
      `   дистанция: ${fmtKm(w.distance_m)}`,
      `   duration: ${fmtSecToMinSec(w.duration_sec)}`,
      `   moving: ${fmtSecToMinSec(w.moving_time_sec)}`,
      `   avg_hr: ${w.avg_hr ?? "нет данных"}`,
      `   max_hr: ${w.max_hr ?? "нет данных"}`,
    ].join("\n");
  });

  return `Вот тренировки за последние ${windowDays} дней:\n${lines.join("\n")}`;
}