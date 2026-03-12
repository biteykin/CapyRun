type CoachMessageLite = {
  id: string;
  type: string;
  body: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

function normalizeText(value: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, parts: string[]) {
  return parts.some((part) => text.includes(part));
}

const WORKOUT_ANALYSIS_MARKERS = [
  "проанализ",
  "анализ",
  "разбор",
  "разбери",
  "оцен",
  "как прошла",
  "как была",
  "обсудим последн",
];

const FOLLOWUP_MARKERS = [
  "ощущ",
  "самочув",
  "нагруз",
  "устал",
  "усталост",
  "тяжело",
  "тяжел",
  "легко",
  "норм",
  "неплохо",
  "плохо",
  "дискомфорт",
  "бол",
  "ноет",
  "забол",
  "тянет",
  "сводит",
  "икр",
  "бедр",
  "голен",
  "колен",
  "спин",
  "поясниц",
  "стоп",
  "ступн",
  "пятк",
  "ног",
  "дых",
  "пульс",
  "сердц",
  "восстанов",
  "сон",
  "спал",
  "спалось",
  "поел",
  "пил",
  "вода",
  "жажд",
  "rpe",
  "разминк",
  "заминк",
];

const GENERAL_PLANNING_MARKERS = [
  "как готов",
  "подготов",
  "план трениров",
  "план на недел",
  "план на следующ",
  "на следующую недел",
  "какую тренировку",
  "что мне делать",
  "что сегодня бежать",
  "что бежать",
  "в каком темпе бежать",
  "целев",
  "таргет",
  "старт",
  "забег",
  "гонк",
  "соревн",
  "эстафет",
  "полумарафон",
  "марафон",
  "рейс",
  "race",
  "пейс",
  "темп на старт",
  "как распредел",
  "как бежать",
  "как подготовиться",
  "как тренироваться",
];

const MULTI_WORKOUT_BROAD_MARKERS = [
  "динамик",
  "прогресс",
  "регресс",
  "тренд",
  "тенденц",
  "стабильн",
  "форма",
  "нагрузк",
  "обьем",
  "объём",
  "набираю",
  "перебираю",
  "перегруз",
  "вкатываюсь",
  "адаптац",
  "восстановлен",
  "выносливост",
  "скорост",
  "темп",
  "пульс",
  "чсс",
  "общее состояние",
  "состояние по тренировкам",
  "что видно по тренировкам",
  "что происходит с тренировками",
  "как идут тренировки",
  "как у меня тренировки",
  "как я бегаю",
  "как я бегал",
  "как тренируюсь",
  "по моим тренировкам",
  "по последним тренировкам",
  "по последним пробежкам",
  "по бегу за",
  "по тренировкам за",
  "за последн",
  "за эту недел",
  "за прошлую недел",
  "за месяц",
  "за 2 недел",
  "за две недел",
  "за 3 недел",
  "за 4 недел",
  "за несколько недел",
  "последние недели",
  "последние тренировки",
  "последние пробежки",
  "несколько тренировок",
  "несколько пробежек",
  "в целом по тренировкам",
  "в целом по бегу",
  "как меняется",
  "стал быстрее",
  "стал медленнее",
  "почему бегу медленнее",
  "почему тяжело бегутся",
  "почему тяжелее",
  "есть ли прогресс",
  "есть ли улучшения",
  "что по динамике",
  "что с объемом",
  "что с объёмом",
  "что с темпом",
  "что с пульсом",
];

const MULTI_WORKOUT_EXPLICIT_MARKERS = [
  "последние 2 недели",
  "последние две недели",
  "последние 3 недели",
  "последние три недели",
  "последний месяц",
  "за последние 7 дней",
  "за последние 14 дней",
  "за последние 30 дней",
  "сравни тренировки",
  "сравни пробежки",
  "сравни мои тренировки",
  "сравни последние тренировки",
];

export function isWorkoutBoundCoachMeta(meta: Record<string, any> | null | undefined) {
  if (!meta) return false;

  const hasWorkoutId = Boolean(meta.workout_id);
  const kind = String(meta.kind ?? "");
  const stage = String(meta.stage ?? "");

  return (
    hasWorkoutId &&
    (kind === "workout_first_message" ||
      stage === "workout_insight" ||
      stage === "workout_followup_insight")
  );
}

export function isWorkoutAnalysisIntent(text: string) {
  const t = normalizeText(text);
  return (
    hasAny(t, WORKOUT_ANALYSIS_MARKERS) ||
    (t.includes("последн") && t.includes("трениров"))
  );
}

export function isLikelyWorkoutFollowup(text: string) {
  const t = normalizeText(text);
  if (!t) return false;

  return (
    hasAny(t, FOLLOWUP_MARKERS) ||
    /\b[1-9]\/10\b/.test(t) ||
    /\b10\/10\b/.test(t) ||
    /\brpe\s*[1-9]\b/.test(t) ||
    /\brpe\s*10\b/.test(t)
  );
}

export function isGeneralPlanningIntent(text: string) {
  const t = normalizeText(text);
  if (!t) return false;
  return hasAny(t, GENERAL_PLANNING_MARKERS);
}

export function isMultiWorkoutAnalysisIntent(text: string) {
  const t = normalizeText(text);
  if (!t) return false;

  const hasBroad = hasAny(t, MULTI_WORKOUT_BROAD_MARKERS);
  const hasExplicitMulti = hasAny(t, MULTI_WORKOUT_EXPLICIT_MARKERS);
  const hasPluralTrainingContext =
    (t.includes("тренировк") || t.includes("пробежк") || t.includes("бег")) &&
    (t.includes("последн") ||
      t.includes("нескольк") ||
      t.includes("недел") ||
      t.includes("месяц") ||
      t.includes("динамик") ||
      t.includes("прогресс") ||
      t.includes("в целом"));

  return hasBroad || hasExplicitMulti || hasPluralTrainingContext;
}

export async function getLastWorkoutBoundCoachMessageBefore(params: {
  db: any;
  threadId: string;
  beforeCreatedAt: string;
}): Promise<CoachMessageLite | null> {
  const { db, threadId, beforeCreatedAt } = params;

  const { data, error } = await db
    .from("coach_messages")
    .select("id,type,body,meta,created_at")
    .eq("thread_id", threadId)
    .eq("type", "coach")
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return null;

  const rows = (data ?? []) as CoachMessageLite[];
  for (const row of rows) {
    if (isWorkoutBoundCoachMeta(row.meta)) return row;
  }

  return null;
}

export async function getFollowupUserMessagesSinceAnchor(params: {
  db: any;
  threadId: string;
  anchorCreatedAt: string;
  beforeCreatedAt: string;
}) {
  const { db, threadId, anchorCreatedAt, beforeCreatedAt } = params;

  const { data, error } = await db
    .from("coach_messages")
    .select("id,type,body,meta,created_at")
    .eq("thread_id", threadId)
    .eq("type", "user")
    .gt("created_at", anchorCreatedAt)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: true })
    .limit(12);

  if (error) return [];
  return (data ?? []) as CoachMessageLite[];
}