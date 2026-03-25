// lib/coach/responder.ts
import OpenAI from "openai";
import { PlannerOut, WorkoutFact } from "./types";
import { safeStringify } from "./utils";
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

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

// Экспортируем "быстрый" локальный ответ, чтобы route.ts мог обойти planner/LLM
export function buildWeeklyScheduleLocalResponse(
  userText: string,
  threadMemory: any | null
): string | null {
  const ws = getWeeklyScheduleFromMemory(threadMemory);
  if (!ws) return null;

  // Для тикета №7 не перехватываем обычные запросы
  // "составь план тренировок на неделю / 2 недели / месяц" —
  // их должен обрабатывать planner + responder.
  if (isScheduleOnlyWeeklyRequest(userText)) {
    return buildLocalNoLoadWeeklyPlan({ mem: threadMemory, ws });
  }

  // "когда/на какой день ОФП" -> строго ofp_days
  if (isOfpWhenRequest(userText)) {
    const ofp = (ws.ofp_days ?? []).map(dayCodeToRu);
    if (!ofp.length) return `По weekly_schedule у нас не задан день ОФП.`;
    return `ОФП по weekly_schedule: ${ofp.join(", ")}.`;
  }

  // "поставь ОФП на вторник" -> если конфликт, возвращаем к расписанию
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

function getGoalFromMemory(mem: any | null): GoalSnapshot | null {
  try {
    const raw =
      mem?.goal ??
      mem?.goals?.current ??
      mem?.goals?.primary ??
      mem?.profile?.goal ??
      mem?.preferences?.goal ??
      null;

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
              raw.target_date ??
              raw.event_date ??
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

  if (
    /\b60\s*(дн|дня|дней)\b/.test(t) ||
    /2\s*месяц/.test(t) ||
    /два месяца/.test(t)
  ) {
    return 60;
  }

  if (
    /\b30\s*(дн|дня|дней)\b/.test(t) ||
    /на месяц/.test(t) ||
    /ближайший месяц/.test(t)
  ) {
    return 30;
  }

  if (
    /\b14\s*(дн|дня|дней)\b/.test(t) ||
    /2\s*недел/.test(t) ||
    /две недел/.test(t)
  ) {
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

  const runText = `лёгкая ходьба или очень спокойный бег ${Math.max(
    20,
    Math.min(mins, 45)
  )} мин (комфортно, без усталости)`;
  const ofpText = `ОФП без ударной нагрузки ${Math.max(
    20,
    Math.min(mins, 45)
  )} мин: мобильность, баланс, растяжка`;
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
  threadMemory: any | null;
}) {
  const { userText, planner, threadMemory } = params;

  const horizonDays = parsePlanHorizonDays(userText, planner);
  const ws = getWeeklyScheduleFromMemory(threadMemory);
  const goal = getGoalFromMemory(threadMemory);

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
      "Нужно сверяться с целью из памяти, если она есть.",
      "Нужно коротко сказать, помогает ли предложенный план двигаться к цели.",
      "Если у цели есть дата — явно учитывай, сколько примерно времени осталось до цели.",
      "Не строй план до самой цели целиком — только на запрошенный горизонт.",
      "Если горизонт 7 или 14 дней — план должен быть максимально детальным.",
      "Если горизонт 30 или 60 дней — дай рамочный план по неделям, а первые 7–14 дней распиши детально.",
      "Для горизонта 7 дней расписывай каждый тренировочный день подробно: разминка, основная часть, заминка, ориентир по усилию.",
      "Для горизонта 14 дней расписывай подробно обе недели.",
      "Для беговых тренировок указывай: цель сессии, длительность/объём, структуру, разминку, основную часть, заминку.",
      "Для ОФП указывай упражнения, подходы и повторения или время.",
      "Если уместно, добавляй краткие советы по питью/еде до или после ключевых тренировок.",
      "Не обещай результат, если данных недостаточно.",
      "Если есть ограничения / травм-риски / плохое восстановление в памяти — делай план осторожнее.",
      "Не делай из каждого дня тяжёлую тренировку.",
      "Если weekly_schedule есть — используй только эти дни для бега и ОФП.",
      "Если weekly_schedule нет — можешь предложить разумную раскладку по дням недели.",
      "Никогда не пиши названия дней как Tue / Thu / Sat / Sun. Только по-русски: Понедельник, Вторник, Среда, Четверг, Пятница, Суббота, Воскресенье.",
      "Не ограничивайся одной строкой на тренировочный день, если горизонт 7 или 14 дней.",
      "Если пользователь спрашивает follow-up вроде 'как этот план помогает мне дойти до цели?', отвечай именно про предложенный план: какую роль играет каждая тренировка и почему такая структура подходит под цель.",
      "",
      "ФОРМАТ ДЛЯ ПЛАНА:",
      "## Кратко",
      "## Как это связано с целью",
      "## План",
      "## На что обратить внимание",
      "",
      "В разделе 'План':",
      "- для 7 / 14 дней: по дням недели, конкретно;",
      "- для 30 / 60 дней: сначала рамка по неделям, потом детально первые 7–14 дней.",
    ];

    if (horizonDays != null) {
      planRules.push(`ТЕКУЩИЙ ЗАПРОШЕННЫЙ ГОРИЗОНТ: ${horizonDays} дней.`);
    }

    if (goal?.title || goal?.targetDate || goal?.notes) {
      planRules.push(
        `ЦЕЛЬ ИЗ ПАМЯТИ: ${safeStringify(
          {
            title: goal?.title,
            target_date: goal?.targetDate,
            notes: goal?.notes,
          },
          2
        )}`
      );
      if (goal?.targetDate) {
        planRules.push(
          "Если target_date указана, в блоке 'Как это связано с целью' коротко поясни, почему такой объём и интенсивность уместны именно на текущем расстоянии до старта."
        );
      }
    } else {
      planRules.push("ЦЕЛЬ ИЗ ПАМЯТИ: явной цели не найдено. Не выдумывай её.");
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

    return [...base, ...planRules, "", "Формат: кратко, по делу. Можно списком."].join("\n");
  }

  return [...base, "Формат: кратко, по делу. Можно списком."].join("\n");
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
}) {
  const { openai, userText, planner, goal, threadMemory, workouts, coachHome, recentHistory } = args;

  const system = buildResponderSystemPrompt({
    userText,
    planner,
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
        goal_snapshot: getGoalFromMemory(threadMemory),
        weekly_schedule: getWeeklyScheduleFromMemory(threadMemory),
      },
    },
    2
  );

  const completion = await openai.chat.completions.create({
    model: COACH_MODELS.responder,
    temperature: planner?.intent === "plan" ? 0.25 : 0.2,
    max_tokens: planner?.intent === "plan" ? 1300 : 650,
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

  return answer;
}