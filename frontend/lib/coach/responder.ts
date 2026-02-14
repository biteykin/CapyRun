// lib/coach/responder.ts
import OpenAI from "openai";
import { PlannerOut, WorkoutFact } from "./types";
import { safeStringify } from "./utils";
import { COACH_MODELS } from "./modelConfig";

type WeeklySchedule = {
  run_days?: string[];
  ofp_days?: string[];
};

// Экспортируем "быстрый" локальный ответ, чтобы route.ts мог обойти planner/LLM
export function buildWeeklyScheduleLocalResponse(userText: string, threadMemory: any | null): string | null {
  const ws = getWeeklyScheduleFromMemory(threadMemory);
  if (!ws) return null;

  // 1) "план на неделю" -> строго по дням weekly_schedule
  if (isWeeklyPlanRequest(userText)) {
    return buildLocalNoLoadWeeklyPlan({ mem: threadMemory, ws });
  }

  // 2) "когда/на какой день ОФП" -> строго ofp_days
  if (isOfpWhenRequest(userText)) {
    const ofp = (ws.ofp_days ?? []).map(dayCodeToRu);
    if (!ofp.length) return `По weekly_schedule у нас не задан день ОФП.`;
    return `ОФП по weekly_schedule: ${ofp.join(", ")}.`;
  }

  // 3) "поставь ОФП на вторник" -> если конфликт, возвращаем к расписанию
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

    // нормализация строк
    const norm = (arr: any[]) =>
      arr
        .map((x) => String(x ?? "").trim().toLowerCase())
        .filter(Boolean);

    const out: WeeklySchedule = { run_days: norm(run_days), ofp_days: norm(ofp_days) };
    if (!out.run_days?.length && !out.ofp_days?.length) return null;
    return out;
  } catch {
    return null;
  }
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
  const v = mem?.preferences?.preferred_session_minutes?.value ?? mem?.preferences?.preferred_session_minutes ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.max(10, Math.min(240, n)) : fallback;
}

function pickConstraints(mem: any | null): string {
  const t = String(mem?.profile?.constraints ?? mem?.constraints ?? "").trim();
  return t;
}

function isWeeklyPlanRequest(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  return /план\s+на\s+недел/.test(t) || /составь\s+план\s+на\s+недел/.test(t);
}

function isOfpWhenRequest(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  return /когда.*офп/.test(t) || /на\s+какой\s+день.*офп/.test(t) || /куда.*офп/.test(t);
}

function isForceOfpOnDay(text: string): { ok: boolean; dayRu?: string } {
  const t = (text ?? "").toLowerCase();
  // "поставь офп на вторник"
  const m = t.match(/офп\s+на\s+(понедельник|вторник|среду|среда|четверг|пятниц(у|а)|суббот(у|а)|воскресень(е|е))/i);
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

  // простой “без нагрузки” шаблон
  const runText = `лёгкая ходьба или очень спокойный бег ${Math.max(20, Math.min(mins, 45))} мин (комфортно, без усталости)`;
  const ofpText = `ОФП без ударной нагрузки ${Math.max(20, Math.min(mins, 45))} мин: мобильность, баланс, растяжка`;
  const restText = `отдых / прогулка 20–40 мин + лёгкая растяжка 5–10 мин`;

  const lines: string[] = [];

  for (const d of runDays) lines.push(`- ${d}: ${runText}`);
  for (const d of ofpDays) lines.push(`- ${d}: ${ofpText}`);

  // если хотим чуть понятнее — добавим “остальные дни”
  lines.push(`- Остальные дни: ${restText}`);

  const header = `План на неделю без нагрузки по твоему weekly_schedule${constraints ? ` (${constraints})` : ""}:`;
  return [header, ...lines].join("\n");
}

export async function runResponder(args: {
  openai: OpenAI;
  userText: string;
  planner: PlannerOut;
  threadMemory: any | null;
  workouts: WorkoutFact[];
  coachHome: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}) {
  const { openai, userText, planner, threadMemory, workouts, coachHome, recentHistory } = args;

  const system = [
    "Ты — тренер внутри приложения. Отвечай по-русски.",
    "Не выдумывай факты и цифры: используй только данные из контекста.",
    "Если данных не хватает — скажи, каких именно не хватает, и предложи безопасную альтернативу.",
    "",
    "КРИТИЧНО: ПРАВИЛА weekly_schedule (структурная память).",
    "Если в памяти есть preferences.weekly_schedule:",
    "- План ДОЛЖЕН следовать этим дням (run_days / ofp_days).",
    "- НЕ использовать формат 'День 1/2/3' — только конкретные дни недели.",
    "- НЕ спрашивать, когда начать.",
    "- Если запрошен план на неделю — привязать к дням недели из weekly_schedule.",
    "- Если спросили 'когда поставить ОФП' — отвечать строго согласно weekly_schedule.",
    "- weekly_schedule имеет приоритет над preferred_days_per_week.",
    "",
    "Формат: кратко, по делу. Можно списком.",
  ].join("\n");

  const userPayload = safeStringify(
    {
      user_text: userText,
      planner,
      memory: threadMemory,
      workouts,
      coach_home: coachHome,
      recent_dialogue: (recentHistory ?? []).slice(-12),
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

  return completion.choices[0]?.message?.content ?? "";
}