import { PlannerOut, WorkoutFact } from "./types";
import { fmtDateIsoToYMD, fmtKm, fmtSecToMinSec } from "./utils";

function sumKm(workouts: WorkoutFact[]) {
  const m = workouts
    .map((w) => (Number.isFinite(Number(w.distance_m)) ? Number(w.distance_m) : 0))
    .reduce((a, b) => a + b, 0);
  return m / 1000;
}

export function buildFastPathAnswer(
  kind: NonNullable<NonNullable<PlannerOut["fast_path"]>["kind"]>,
  workouts: WorkoutFact[],
  windowDays: number,
  nth?: number
) {
  if (kind === "count_workouts") {
    return `За последние ${windowDays} дней у тебя ${workouts.length} тренировок.`;
  }

  if (kind === "sum_distance_run") {
    const runs = workouts.filter((w) => (w.sport ?? "").toLowerCase() === "run");
    if (!runs.length) return `Не вижу пробежек за последние ${windowDays} дней (нет данных).`;
    const km = sumKm(runs);
    return `Суммарно пробежал(а) за последние ${windowDays} дней: ${km.toFixed(1)} км (по данным, которые вижу в приложении).`;
  }

  if (kind === "nth_workout") {
    const n = Math.max(1, Math.min(50, Number(nth ?? 1)));
    const w = workouts[n - 1];
    if (!w) return `Не нашёл(ла) ${n}-ю с конца тренировку в окне ${windowDays} дней (нет данных).`;
    return [
      `Тренировка #${n} с конца (в окне ${windowDays} дней):`,
      `• Дата: ${fmtDateIsoToYMD(w.start_time)}`,
      `• Спорт: ${w.sport ?? "нет данных"}`,
      `• Дистанция: ${fmtKm(w.distance_m)}`,
      `• Длительность: ${fmtSecToMinSec(w.moving_time_sec ?? w.duration_sec)}`,
      `• Пульс: avg ${w.avg_hr ?? "нет данных"} / max ${w.max_hr ?? "нет данных"}`,
    ].join("\n");
  }

  if (kind === "last_workout") {
    const w = workouts[0];
    if (!w) return `За последние ${windowDays} дней тренировок не найдено.`;

    const date = fmtDateIsoToYMD(w.start_time);
    const sport = w.sport ?? "нет данных";
    const dist = fmtKm(w.distance_m);
    const dur = fmtSecToMinSec(w.duration_sec);
    const mov = fmtSecToMinSec(w.moving_time_sec);

    const missing: string[] = [];
    if (w.moving_time_sec == null) missing.push("moving time");
    if (w.avg_hr == null && w.max_hr == null) missing.push("пульс");

    const coachy =
      missing.length > 0
        ? `Вижу тренировку, но в данных не хватает: ${missing.join(", ")}.`
        : `Ок, вижу последнюю активность.`;

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