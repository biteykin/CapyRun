//frontend/lib/coach/motivation.ts

type MotivationDecision = {
  enabled: boolean;
  reason:
    | "factual_block"
    | "caution_block"
    | "no_signal"
    | "positive_signal"
    | "coach_positive_language";
  tone: "neutral" | "warm";
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

const FACTUAL_BLOCK_MARKERS = [
  "сколько",
  "километраж",
  "общий километраж",
  "километраж за",
  "общая дистанция",
  "суммарная дистанция",
  "суммарный километраж",
  "общий объем",
  "общий объём",
  "объем",
  "объём",
  "сколько км",
  "сколько килом",
  "сколько часов",
  "сколько времени",
  "общее время",
  "какой объем",
  "какой объём",
  "какой километраж",
  "какой общий километраж",
  "какой у меня общий километраж",
  "сколько трениров",
  "сколько было трениров",
  "сколько пробеж",
  "сколько занятий",
  "какие виды спорта",
  "какие были виды спорта",
  "какие типы тренировок",
  "какие были типы тренировок",
  "какие активности",
  "какие виды активности",
  "по каким видам спорта",
  "разбивка по видам спорта",
  "структура по видам спорта",
  "сколько тренировок по бегу",
  "сколько было беговых тренировок",
  "сколько было пробежек",
  "сколько беговых",
  "сколько run",
];

const CAUTION_BLOCK_MARKERS = [
  "бол",
  "болит",
  "болела",
  "болели",
  "дискомфорт",
  "надкостниц",
  "ахилл",
  "ахилл",
  "икр",
  "икрон",
  "колен",
  "голен",
  "бедр",
  "поясниц",
  "спин",
  "стоп",
  "ступн",
  "пятк",
  "тянет",
  "ноет",
  "сводит",
  "тяжесть в ногах",
  "тяжелые ноги",
  "тяжёлые ноги",
  "устал",
  "усталост",
  "не восстанов",
  "восстановление так себе",
  "плохо спал",
  "сон",
  "спал",
  "спалось",
  "перегруз",
  "перегруж",
  "травм",
  "риск травмы",
  "как снизить риск травмы",
];

const POSITIVE_SIGNAL_MARKERS = [
  "прогресс",
  "лучше",
  "улучш",
  "стабильн",
  "регулярн",
  "получается",
  "удалось",
  "смог",
  "смогла",
  "держу",
  "держится",
  "вырос",
  "выросла",
  "прибав",
  "прибавил",
  "прибавила",
  "хорошо",
  "неплохо",
  "молодец",
  "супер",
  "классно",
  "отлично",
  "получилось",
  "получилась",
  "есть ли прогресс",
  "есть ли улучшения",
  "стал быстрее",
  "стала быстрее",
  "стал лучше",
  "стала лучше",
];

const COACH_POSITIVE_LANGUAGE_MARKERS = [
  "стабильн",
  "регулярн",
  "ровно",
  "аккуратно",
  "без перегруза",
  "хороший ритм",
  "неплохой ритм",
  "есть база",
  "есть опора",
  "держится",
  "выглядит устойчиво",
  "нормальный фон",
  "спокойная работа",
  "контроль нагрузки",
  "адаптация",
  "хороший знак",
  "позитивный знак",
];

const MOTIVATION_TAILS_NEUTRAL = [
  "Это нормальная база, на которую можно спокойно опираться дальше.",
  "В целом картина рабочая — главное сохранять ритм без лишней суеты.",
  "Фундамент есть, дальше важнее ровность, чем резкие рывки.",
  "Сейчас важнее держать последовательность, и это уже дает эффект.",
];

const MOTIVATION_TAILS_WARM = [
  "Это хороший знак — база у нас есть, и на ней можно спокойно расти дальше.",
  "Выглядит так, что работа не пропадает зря — движение в правильную сторону есть.",
  "Здесь уже видно, что регулярность начинает работать нам в плюс.",
  "Это не вау-рывок, но очень здоровая динамика, из которой обычно и растет форма.",
];

function pickTail(items: string[], seedText: string) {
  const seed = normalizeText(seedText);
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return items[sum % items.length];
}

export function shouldAddMotivationalTail(params: {
  userText: string;
  coachText: string;
}): MotivationDecision {
  const userText = normalizeText(params.userText);
  const coachText = normalizeText(params.coachText);

  if (!userText && !coachText) {
    return {
      enabled: false,
      reason: "no_signal",
      tone: "neutral",
    };
  }

  if (hasAny(userText, FACTUAL_BLOCK_MARKERS)) {
    return {
      enabled: false,
      reason: "factual_block",
      tone: "neutral",
    };
  }

  if (hasAny(userText, CAUTION_BLOCK_MARKERS)) {
    return {
      enabled: false,
      reason: "caution_block",
      tone: "neutral",
    };
  }

  if (hasAny(userText, POSITIVE_SIGNAL_MARKERS)) {
    return {
      enabled: true,
      reason: "positive_signal",
      tone: "warm",
    };
  }

  if (hasAny(coachText, COACH_POSITIVE_LANGUAGE_MARKERS)) {
    return {
      enabled: true,
      reason: "coach_positive_language",
      tone: "neutral",
    };
  }

  return {
    enabled: false,
    reason: "no_signal",
    tone: "neutral",
  };
}

export function buildMotivationalTail(params: {
  userText: string;
  coachText: string;
}): string | null {
  const decision = shouldAddMotivationalTail(params);
  if (!decision.enabled) return null;

  const pool =
    decision.tone === "warm" ? MOTIVATION_TAILS_WARM : MOTIVATION_TAILS_NEUTRAL;

  return pickTail(pool, `${params.userText}\n${params.coachText}`);
}

export function appendMotivationalTail(params: {
  userText: string;
  coachText: string;
}): string {
  const coachText = (params.coachText ?? "").trim();
  if (!coachText) return coachText;

  const tail = buildMotivationalTail(params);
  if (!tail) return coachText;

  if (coachText.includes(tail)) return coachText;
  return `${coachText}\n\n${tail}`;
}

// ------------------------------------------------------------
// Motivation intercept layer (используется в route.ts)
// ------------------------------------------------------------

const MOTIVATION_INTENT_MARKERS = [
  "мотивац",
  "замотив",
  "заставить себя",
  "нет мотивации",
  "лень идти",
  "не хочу тренироваться",
  "не хочется тренироваться",
  "как настроиться",
  "как настроиться на тренировку",
  "как заставить себя",
  "почему стоит тренироваться",
  "почему продолжать тренировки",
  "зачем тренироваться",
  "форма просела",
  "нет прогресса",
  "не вижу прогресса",
  "есть ощущение что прогресса нет",
];

export function isMotivationIntent(text: string) {
  const t = normalizeText(text);
  if (!t) return false;
  return hasAny(t, MOTIVATION_INTENT_MARKERS);
}

export function buildMotivationLocalResponse(params: {
  text: string;
  threadMemory: any | null;
}): string {
  const t = normalizeText(params.text);

  if (t.includes("цитат")) {
    return [
      "Иногда помогает простая мысль:",
      "",
      "«Дисциплина — это выбор между тем, чего ты хочешь сейчас, и тем, чего ты хочешь больше всего».",
      "",
      "И другая сторона:",
      "",
      "«Каждая пропущенная тренировка делает следующую пропустить чуть легче».",
    ].join("\n");
  }

  if (t.includes("как настроиться")) {
    return [
      "Попробуй настроиться очень просто:",
      "",
      "Не думай о всей тренировке.",
      "Думай только о первых 10 минутах.",
      "",
      "Задача — спокойно начать.",
      "Дальше ритм обычно приходит сам.",
      "",
      "Сегодняшняя тренировка — это не про рекорд.",
      "Это просто ещё один кирпич в фундамент формы.",
    ].join("\n");
  }

  return [
    "Иногда кажется, что прогресса нет — это нормальная часть процесса.",
    "",
    "Выносливость растёт очень постепенно.",
    "Часто прогресс сначала накапливается незаметно.",
    "",
    "Каждая спокойная тренировка — это вклад в базу.",
    "",
    "Через несколько месяцев именно эта регулярность и будет тем, на чём держится форма.",
  ].join("\n");
}