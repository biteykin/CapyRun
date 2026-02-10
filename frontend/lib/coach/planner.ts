import OpenAI from "openai";
import { PlannerOut, PlannerSchema } from "./types";
import { clamp, normalizeErr, safeJsonParse, safeStringify } from "./utils";

const DEFAULT_NEEDS: PlannerOut["needs"] = {
  workouts_window_days: 14,
  workouts_limit: 30,
  include_coach_home: false,
  include_thread_memory: true,
  include_geo: false,
  include_calendar: false,
};

function parseDateRangeWindowDays(text: string): number | null {
  const t = (text ?? "").toLowerCase();
  // ловим "с 1 января 2026" / "с 01.01.2026" / "с 2026-01-01"

  let from: Date | null = null;

  const iso = t.match(/с\s+(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    from = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  }

  const dot = t.match(/с\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!from && dot) {
    const dd = String(dot[1]).padStart(2, "0");
    const mm = String(dot[2]).padStart(2, "0");
    from = new Date(`${dot[3]}-${mm}-${dd}T00:00:00Z`);
  }

  const ru = t.match(/с\s+(\d{1,2})\s+(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*\s+(\d{4})/);
  if (!from && ru) {
    const day = Number(ru[1]);
    const year = Number(ru[3]);
    const m = ru[2];
    const map: Record<string, number> = {
      "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "ма": 5, "июн": 6, "июл": 7,
      "август": 8, "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
    };
    const month = map[m] ?? 0;
    if (month) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      from = new Date(`${year}-${mm}-${dd}T00:00:00Z`);
    }
  }

  if (!from || isNaN(from.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - from.getTime();
  const days = Math.ceil(diffMs / (24 * 3600 * 1000));

  return clamp(days, 1, 365);
}

const PLANNER_OUTPUT_CONTRACT = {
  intent:
    "simple_fact | plan | forecast | analysis | injury | nutrition | strength | other_sport | account_app | unknown",
  response_mode: "answer | clarify",
  clarify_question: "string|null (если response_mode=clarify)",
  needs: {
    workouts_window_days: "int 0..365 (default 14)",
    workouts_limit: "int 1..100 (default 30)",
    include_coach_home: "boolean (default false)",
    include_thread_memory: "boolean (default true)",
    include_geo: "boolean (default false, future)",
    include_calendar: "boolean (default false, future)",
  },
  fast_path: {
    enabled: "boolean (default false)",
    kind: "count_workouts|list_workouts|last_workout|longest_workout (optional)",
    window_days: "int 1..365 (optional)",
  },
  memory_patch: {
    goal: "string (optional)",
    constraints: "string (optional)",
    injury: "string (optional)",
    preferred_days_per_week: "int 0..14 (optional)",
    preferred_session_minutes: "int 5..240 (optional)",
    sports_focus: "string[] (max 10) (optional)",
  },
  debug: { rationale_short: "string (optional)" },
};

type Msg = { type: string; body: string; created_at: string };

function lastByType(recentHistory: Msg[], type: string) {
  return [...(recentHistory ?? [])].reverse().find((m) => m.type === type) ?? null;
}

function isShortFeedback(text: string) {
  const t = (text ?? "").trim().toLowerCase();

  // супер-частые ответы на вопрос "как по ощущениям?"
  const quick = new Set([
    "легко",
    "оч легко",
    "норм",
    "нормально",
    "тяжело",
    "оч тяжело",
    "хорошо",
    "плохо",
    "ок",
    "okay",
    "ok",
    "средне",
    "нормас",
  ]);

  if (quick.has(t)) return true;

  // допускаем короткие фразы до 40 символов
  // типа "норм, но подскользнулся"
  if (t.length <= 40) {
    // если это не вопрос и нет явной новой темы
    if (!t.includes("?")) return true;
  }

  return false;
}

function assistantAskedFeelings(lastCoachText: string) {
  const t = (lastCoachText ?? "").toLowerCase();
  return (
    t.includes("как по ощущениям") ||
    t.includes("по ощущениям") ||
    t.includes("как прошло") ||
    t.includes("как прошла") ||
    t.includes("легко/норм/тяжело") ||
    t.includes("легко / норм / тяжело") ||
    t.includes("легко/нормально/тяжело")
  );
}

function mentionsSlipOrPain(text: string) {
  const t = (text ?? "").toLowerCase();
  return (
    /подскольз|скользк|упал|поскольз|вывернул|подвернул/.test(t) ||
    /болит|боль|отек|опух|тянет|прострел|колено|голен|стоп|щиколот|ахилл/.test(t)
  );
}

function parseWindowDaysFromText(text: string): number | null {
  const t = (text ?? "").toLowerCase();

  // "за 14 дней", "за 2 дня"
  const m1 = t.match(/за\s+(\d{1,3})\s*(дн|дня|дней)\b/);
  if (m1) return clamp(Number(m1[1]), 1, 365);

  // "вчера" -> 2 дня (чтобы захватить timezone/границу суток)
  if (/\bвчера\b/.test(t)) return 2;

  // "сегодня" -> 1 день
  if (/\bсегодня\b/.test(t)) return 1;

  // "за неделю" -> 7
  if (/\bнедел\b/.test(t)) return 7;

  // "за месяц" -> 30
  if (/\bмесяц\b/.test(t)) return 30;

  return null;
}

function localFastPathFromText(userText: string): PlannerOut | null {
  const t = (userText ?? "").trim().toLowerCase();
  if (!t) return null;

  const windowDays = parseWindowDaysFromText(t) ?? 14;

  // "сколько тренировок ..."
  if (/сколько\s+трениров/.test(t) || /кол-во\s+трениров/.test(t)) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: windowDays, workouts_limit: 100 },
      fast_path: { enabled: true, kind: "count_workouts", window_days: windowDays },
      memory_patch: {},
      debug: { rationale_short: "local_fastpath_count_workouts" },
    };
  }

  // "последняя тренировка"
  if (
    /последн(яя|юю)\s+трениров/.test(t) ||
    /когда\s+был(а)?\s+последн/.test(t) ||
    /вчерашн(яя|юю)\s+трениров/.test(t)
  ) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: windowDays, workouts_limit: 30 },
      fast_path: { enabled: true, kind: "last_workout", window_days: windowDays },
      memory_patch: {},
      debug: { rationale_short: "local_fastpath_last_workout" },
    };
  }

  // "самая длинная"
  if (/сам(ая|ую)\s+длинн/.test(t) || /максимальн(ая|ую)\s+дистанц/.test(t)) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: windowDays, workouts_limit: 80 },
      fast_path: { enabled: true, kind: "longest_workout", window_days: windowDays },
      memory_patch: {},
      debug: { rationale_short: "local_fastpath_longest_workout" },
    };
  }

  // "список тренировок"
  if (/спис(ок|ком)\s+трениров/.test(t) || /покажи\s+трениров/.test(t) || /перечисли\s+трениров/.test(t)) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: windowDays, workouts_limit: 80 },
      fast_path: { enabled: true, kind: "list_workouts", window_days: windowDays },
      memory_patch: {},
      debug: { rationale_short: "local_fastpath_list_workouts" },
    };
  }

  return null;
}

function localContinuationPlanner(userText: string, recentHistory: Msg[]): PlannerOut | null {
  const lastCoach = lastByType(recentHistory, "coach");
  if (!lastCoach) return null;

  const treatAsContinuation = isShortFeedback(userText) && assistantAskedFeelings(lastCoach.body ?? "");
  if (!treatAsContinuation) return null;

  const injuryHint = mentionsSlipOrPain(userText);

  return {
    intent: injuryHint ? "injury" : "analysis",
    response_mode: "answer",
    clarify_question: null,
    needs: { ...DEFAULT_NEEDS, workouts_window_days: 14, workouts_limit: 30 },
    fast_path: { enabled: false },
    memory_patch: injuryHint ? { injury: userText.trim().slice(0, 300) } : {},
    debug: { rationale_short: injuryHint ? "local_continuation_injury" : "local_continuation_feelings_reply" },
  };
}

export async function runPlanner(args: {
  openai: OpenAI;
  userText: string;
  threadMemory: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}): Promise<PlannerOut> {
  const { userText, threadMemory, recentHistory, openai } = args;

  // --- LOCAL ROUTER: "предпоследняя" / "с 1 января ..." / "итого км" ---
  const t = (userText ?? "").trim().toLowerCase();
  const rangeDays = parseDateRangeWindowDays(t);

  // "километраж с ... по сегодня" -> суммарная дистанция по run
  if (rangeDays && (t.includes("километраж") || t.includes("суммар") || t.includes("сколько пробеж"))) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: rangeDays, workouts_limit: 100 },
      fast_path: { enabled: true, kind: "sum_distance_run", window_days: rangeDays },
      memory_patch: {},
      debug: { rationale_short: "local_date_range_sum_distance_run" },
    };
  }

  // "предпоследняя / позапрошлая" -> nth_workout(2)
  if (/(предпоследн|позапрошл)/.test(t)) {
    return {
      intent: "simple_fact",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS, workouts_window_days: 30, workouts_limit: 50 },
      fast_path: { enabled: true, kind: "nth_workout", window_days: 30, nth: 2 },
      memory_patch: {},
      debug: { rationale_short: "local_nth_workout_2" },
    };
  }

  // 0) быстрые локальные роуты (улучшают UX и экономят токены)
  const localFp = localFastPathFromText(userText);
  if (localFp) return localFp;

  // 1) локальная обработка продолжения диалога ("легко/норм/тяжело" после вопроса тренера)
  const cont = localContinuationPlanner(userText, recentHistory);
  if (cont) return cont;

  // 2) LLM planner — только когда локально не смогли уверенно решить
  const plannerSystem = [
    "Ты — Planner для фитнес-коуча внутри приложения.",
    "Твоя задача: определить intent, какие данные нужны, нужен ли уточняющий вопрос, и обновить 'memory'.",
    "",
    "ПРАВИЛА (КРИТИЧНО):",
    "1) Верни СТРОГО JSON (без Markdown, без текста вокруг).",
    "2) Не придумывай данные. Ты НЕ тренер-ответчик. Ты только планируешь.",
    "3) Избегай clarify по умолчанию. Уточняй только если БЕЗ этого невозможно ответить.",
    "4) Если пользователь спрашивает про 'последнюю/вчерашнюю' тренировку — это НЕ уточнение. Это last_workout (simple_fact или analysis).",
    "5) Если пользователь отвечает коротко ('легко/норм/тяжело/ок') — считай это продолжением последней темы, НЕ спрашивай 'о какой тренировке речь'.",
    "6) fast_path включай только для очень простых вопросов про тренировки: count/list/last/longest.",
    "7) Если есть слова про боль/травму/подскользнулся/упал — intent='injury'.",
    "8) Если запрос 'рекомендации по последней тренировке' — intent='analysis', fast_path=false.",
    "",
    "ВАЖНО:",
    "Если пользователь отвечает коротко на предыдущий вопрос тренера",
    "(например: 'легко', 'тяжело', 'норм'),",
    "НЕ ИСПОЛЬЗУЙ response_mode=clarify.",
    "",
    "ЕЩЁ ВАЖНО:",
    "— 'предпоследняя тренировка' = тренировка #2 с конца, не задавай уточняющих вопросов.",
    "— 'километраж с <дата> по сегодня' = сумма дистанции по пробежкам за окно, не говори 'нет данных', если workouts есть.",
    "",
    "КОНТРАКТ ВЫХОДА (описание полей):",
    safeStringify(PLANNER_OUTPUT_CONTRACT, 2),
    "",
    "ПРИМЕРЫ:",
    "- user: 'сколько тренировок за 14 дней?' => intent=simple_fact, fast_path.enabled=true, kind=count_workouts, window_days=14",
    "- user: 'темп последней тренировки?' => intent=analysis (или simple_fact), needs.workouts_window_days=14, fast_path=false",
    "- user: 'легко' (после вопроса тренера 'как по ощущениям?') => intent=analysis, response_mode=answer, clarify_question=null",
    "- user: 'подскользнулся на льду' => intent=injury",
  ].join("\n");

  const plannerUser = safeStringify(
    {
      user_text: userText,
      thread_memory: threadMemory,
      recent_dialogue: (recentHistory ?? []).slice(-12),
    },
    2
  );

  let completion: any;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 450,
      messages: [
        { role: "system", content: plannerSystem },
        { role: "user", content: plannerUser },
      ],
      response_format: { type: "json_object" } as any,
    });
  } catch (e) {
    const ne = normalizeErr(e);
    throw Object.assign(new Error(`planner_openai_call_failed: ${ne.message}`), { _planner: ne });
  }

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse(raw) ?? {};
  const validated = PlannerSchema.safeParse(parsed);

  if (!validated.success) {
    return {
      intent: "unknown",
      response_mode: "answer",
      clarify_question: null,
      needs: { ...DEFAULT_NEEDS },
      fast_path: { enabled: false },
      memory_patch: {},
      debug: { rationale_short: "planner_parse_failed_fallback" },
    };
  }

  // normalize
  const out = validated.data;

  // needs
  out.needs = out.needs ?? (DEFAULT_NEEDS as any);
  out.needs.workouts_window_days = clamp(out.needs.workouts_window_days ?? 14, 1, 365);
  out.needs.workouts_limit = clamp(out.needs.workouts_limit ?? 30, 1, 100);

  // если модель решила clarify, но сообщение выглядит как продолжение или простой кейс — жёстко запрещаем clarify
  const lastCoach = lastByType(recentHistory, "coach");
  const looksLikeContinuation = !!lastCoach && isShortFeedback(userText) && assistantAskedFeelings(lastCoach.body ?? "");
  const looksLikeSimpleLastWorkout =
    /последн(яя|юю)\s+трениров|вчерашн(яя|юю)\s+трениров|темп\s+последн|как\s+прошла\s+последн/i.test(userText);

  if (out.response_mode === "clarify" && (looksLikeContinuation || looksLikeSimpleLastWorkout)) {
    out.response_mode = "answer";
    out.clarify_question = null;
    out.debug = { ...(out.debug ?? {}), rationale_short: "forced_no_clarify_for_continuation_or_lastworkout" };
  }

  // fast_path sanity
  if (out.fast_path?.enabled) {
    // fast_path только для simple_fact
    if (out.intent !== "simple_fact") {
      out.fast_path = { enabled: false };
    }
  }

  return out;
}