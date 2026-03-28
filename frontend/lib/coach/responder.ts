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
      "Обязательно заполни в JSON:",
      "- kind = 'draft_training_plan';",
      "- starts_on;",
      "- ends_on;",
      "- overwrite_existing_on_confirm;",
      "- overwrite_range.from и overwrite_range.to;",
      "- sessions[].day_index;",
      "- sessions[].date;",
      "- sessions[].weekday;",
      "- sessions[].title;",
      "- sessions[].sport;",
      "- sessions[].session_type;",
      "- sessions[].status = 'planned';",
      "- sessions[].structure.",
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
  const dayIndex =
    typeof item?.day_index === "number" && Number.isFinite(item.day_index)
      ? Math.max(0, Math.trunc(item.day_index))
      : idx;

  const date =
    normalizeDateOnly(item?.date) ??
    normalizeDateOnly(item?.planned_date) ??
    addDaysToDateOnly(startsOn, dayIndex);

  const title = String(item?.title ?? "Тренировка").trim() || "Тренировка";
  const sport = String(item?.sport ?? "run");
  const sessionType = item?.session_type != null ? String(item.session_type) : null;
  const status =
    item?.status === "draft" || item?.status === "planned" ? item.status : "planned";

  const goal = item?.goal != null ? String(item.goal) : null;
  const durationMin = Number(item?.duration_min);
  const distanceKm = Number(item?.distance_km);
  const effort = item?.effort != null ? String(item.effort) : null;
  const hrTarget = item?.hr_target != null ? String(item.hr_target) : null;
  const warmup = item?.warmup != null ? String(item.warmup) : null;
  const main = item?.main != null ? String(item.main) : null;
  const cooldown = item?.cooldown != null ? String(item.cooldown) : null;
  const fueling = item?.fueling != null ? String(item.fueling) : null;
  const hydration = item?.hydration != null ? String(item.hydration) : null;
  const notes = item?.notes != null ? String(item.notes) : null;
  const weekday =
    item?.weekday != null
      ? String(item.weekday)
      : item?.day_label != null
      ? String(item.day_label)
      : null;

  const steps = Array.isArray(item?.steps) ? item.steps : [];
  const strengthBlock =
    item?.strength_block != null && typeof item.strength_block === "object"
      ? item.strength_block
      : null;

  const structure =
    item?.structure && typeof item.structure === "object"
      ? (item.structure as Record<string, any>)
      : {
          goal,
          duration_min: Number.isFinite(durationMin) ? durationMin : null,
          distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
          effort,
          hr_target: hrTarget,
          warmup,
          main,
          cooldown,
          steps,
          strength_block: strengthBlock,
          fueling,
          hydration,
        };

  return {
    day_index: dayIndex,
    date,
    weekday,
    title,
    sport,
    session_type: sessionType,
    status,
    goal,
    duration_min: Number.isFinite(durationMin) ? durationMin : null,
    distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
    effort,
    hr_target: hrTarget,
    warmup,
    main,
    cooldown,
    steps,
    strength_block: strengthBlock,
    fueling,
    hydration,
    notes,
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
    max_tokens: 1800,
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
          "\nДля каждой session.date используй формат YYYY-MM-DD.",
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeJsonParse(raw) ?? {};

  const text = String(parsed?.text ?? "").trim();
  const structuredPlan = normalizeStructuredPlan(parsed?.structured_plan, requestedPlanHorizon);

  if (text) {
    return {
      text,
      structured_plan: structuredPlan,
    };
  }

  return {
    text: raw.trim() || "Не удалось собрать ответ по плану.",
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