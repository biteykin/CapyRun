// frontend/app/api/coach/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------
// Types / Schemas
// -----------------------------
type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

type WorkoutFact = {
  id: string;
  sport: string | null;
  start_time: string | null;
  distance_m: number | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

const PlannerSchema = z.object({
  // high-level intent (universal)
  intent: z.enum([
    "simple_fact", // factual Q about workouts/metrics
    "plan", // "what should I do today"
    "forecast", // "predict 10k time"
    "analysis", // analyze last workouts / progress
    "injury", // pain / injury / recovery
    "nutrition", // food, calories, weight loss
    "strength", // gym / strength plans
    "other_sport", // swimming/cycling/etc
    "account_app", // app/how to use / bugs
    "unknown",
  ]),

  // responder mode
  response_mode: z.enum(["answer", "clarify"]).default("answer"),
  clarify_question: z.string().nullable().optional(),

  // what data is needed
  needs: z.object({
    workouts_window_days: z.number().int().min(0).max(365).default(14),
    workouts_limit: z.number().int().min(1).max(100).default(30),
    include_coach_home: z.boolean().default(false),
    include_thread_memory: z.boolean().default(true),
    include_geo: z.boolean().default(false), // future
    include_calendar: z.boolean().default(false), // future
  }),

  // fast-path suggestion (optional)
  fast_path: z
    .object({
      enabled: z.boolean().default(false),
      kind: z
        .enum(["count_workouts", "list_workouts", "last_workout", "longest_workout"])
        .optional(),
      window_days: z.number().int().min(1).max(365).optional(),
    })
    .optional(),

  // memory patch for thread (lightweight state)
  memory_patch: z
    .object({
      goal: z.string().max(300).optional(), // e.g. "10k < 55min"
      constraints: z.string().max(300).optional(), // e.g. "knee pain"
      injury: z.string().max(300).optional(),
      preferred_days_per_week: z.number().int().min(0).max(14).optional(),
      preferred_session_minutes: z.number().int().min(5).max(240).optional(),
      sports_focus: z.array(z.string().max(40)).max(10).optional(),
    })
    .optional(),

  // optional explanation/debug for meta
  debug: z
    .object({
      rationale_short: z.string().max(600).optional(),
    })
    .optional(),
});

type PlannerOut = z.infer<typeof PlannerSchema>;

// -----------------------------
// Helpers
// -----------------------------
function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtKm(distance_m: number | null) {
  if (!Number.isFinite(Number(distance_m))) return "нет данных";
  const km = Number(distance_m) / 1000;
  return `${km.toFixed(1)} км`;
}

function fmtSecToMinSec(sec: number | null) {
  if (!Number.isFinite(Number(sec))) return "нет данных";
  const s = Math.max(0, Math.round(Number(sec)));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function fmtDateIsoToYMD(iso: string | null) {
  if (!iso) return "нет данных";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "нет данных";
  }
}

function pickRecentHistory(history: any[] | null | undefined, limit = 14) {
  const arr = Array.isArray(history) ? history : [];
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}

function buildFastPathAnswer(
  kind: NonNullable<NonNullable<PlannerOut["fast_path"]>["kind"]>,
  workouts: WorkoutFact[],
  windowDays: number
) {
  if (kind === "count_workouts") {
    return `За последние ${windowDays} дней у тебя ${workouts.length} тренировок.`;
  }

  if (kind === "last_workout") {
    const w = workouts[0];
    if (!w) return `За последние ${windowDays} дней тренировок не найдено.`;
    return [
      `Последняя тренировка (за последние ${windowDays} дней):`,
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

  if (kind === "longest_workout") {
    const withDist = workouts.filter((w) => Number.isFinite(Number(w.distance_m)));
    if (!withDist.length) return `Не вижу дистанции в тренировках за последние ${windowDays} дней (нет данных).`;
    const max = withDist.reduce((a, b) => (Number(b.distance_m) > Number(a.distance_m) ? b : a), withDist[0]);
    const same = withDist.filter((w) => Number(w.distance_m) === Number(max.distance_m));
    if (same.length > 1) {
      return `Самая длинная тренировка за последние ${windowDays} дней — ${fmtKm(max.distance_m)} (их ${same.length}: ${same
        .map((w) => fmtDateIsoToYMD(w.start_time))
        .join(", ")}).`;
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
      `   duration_sec: ${w.duration_sec ?? "нет данных"}`,
      `   moving_time_sec: ${w.moving_time_sec ?? "нет данных"}`,
      `   avg_hr: ${w.avg_hr ?? "нет данных"}`,
      `   max_hr: ${w.max_hr ?? "нет данных"}`,
    ].join("\n");
  });
  return `Вот тренировки за последние ${windowDays} дней:\n${lines.join("\n")}`;
}

// -----------------------------
// Planner
// -----------------------------
async function runPlanner(args: {
  userText: string;
  threadMemory: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}) {
  const { userText, threadMemory, recentHistory } = args;

  const plannerSystem = [
    "Ты — Planner для фитнес-коуча внутри приложения.",
    "Твоя задача: определить intent, какие данные нужны, нужен ли уточняющий вопрос, и обновить 'memory'.",
    "",
    "ПРАВИЛА:",
    "1) Верни СТРОГО JSON (без Markdown, без текста вокруг).",
    "2) Не придумывай данные. Если сомневаешься — response_mode='clarify' и один короткий вопрос.",
    "3) Не хардкодь ответы. Только планирование: intent + needs + fast_path + memory_patch.",
    "4) fast_path включай только для очень простых вопросов про тренировки (count/list/last/longest).",
    "5) Если вопрос про боль/травму — intent='injury' (fast_path=false).",
    "6) Если вопрос про 10к прогноз — intent='forecast' (fast_path=false).",
    "7) Если вопрос просит конкретный план на X минут сегодня/завтра — intent='plan'.",
    "",
    "СХЕМА:",
    JSON.stringify(PlannerSchema.shape, null, 2),
  ].join("\n");

  const plannerUser = JSON.stringify(
    {
      user_text: userText,
      thread_memory: threadMemory,
      recent_dialogue: recentHistory.slice(-10),
    },
    null,
    2
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    max_tokens: 450,
    messages: [
      { role: "system", content: plannerSystem },
      { role: "user", content: plannerUser },
    ],
    // if model supports it, it helps; otherwise it's ignored safely
    response_format: { type: "json_object" } as any,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse(raw) ?? {};
  const validated = PlannerSchema.safeParse(parsed);

  if (!validated.success) {
    // ultra-safe fallback
    const fallback: PlannerOut = {
      intent: "unknown",
      response_mode: "answer",
      clarify_question: null,
      needs: {
        workouts_window_days: 14,
        workouts_limit: 30,
        include_coach_home: false,
        include_thread_memory: true,
        include_geo: false,
        include_calendar: false,
      },
      fast_path: { enabled: false },
      memory_patch: {},
      debug: { rationale_short: "planner_parse_failed_fallback" },
    };
    return fallback;
  }

  // sanitize a bit
  const out = validated.data;
  out.needs.workouts_window_days = clamp(out.needs.workouts_window_days ?? 14, 1, 365);
  out.needs.workouts_limit = clamp(out.needs.workouts_limit ?? 30, 1, 100);
  return out;
}

// -----------------------------
// Responder
// -----------------------------
async function runResponder(args: {
  userText: string;
  planner: PlannerOut;
  threadMemory: any | null;
  workouts: WorkoutFact[];
  coachHome: any | null;
  recentHistory: { type: string; body: string; created_at: string }[];
}) {
  const { userText, planner, threadMemory, workouts, coachHome, recentHistory } = args;

  const responderSystem = [
    "Ты — дружелюбный и мотивирующий персональный тренер для любителя.",
    "Пиши по-русски, тепло и поддерживающе, но без воды.",
    "",
    "КЛЮЧЕВОЕ:",
    "— СНАЧАЛА дай прямой ответ на вопрос пользователя (самое нужное).",
    "— Затем (если уместно) добавь 1–3 конкретных совета или план.",
    "— Заканчивай ОДНИМ уточняющим вопросом, только если это реально нужно.",
    "",
    "ОГРАНИЧЕНИЯ ТОЧНОСТИ:",
    "— Факты о тренировках (дата/дистанция/время/HR) бери ТОЛЬКО из WORKOUTS_FACTS.",
    "— Если поле отсутствует — пиши «нет данных».",
    "— Не выдумывай геолокацию, маршрут, текущее время, погоду, устройства — если нет данных, так и скажи.",
    "",
    "АНТИ-ПОПУГАЙ:",
    "— Не повторяй одни и те же 1–2 тренировки в каждом ответе.",
    "— Не начинай каждый ответ с анализа прошлого, если вопрос про другое.",
    "— Не предлагай «план на 40 минут», если пользователь спрашивает прогноз/травму/гео.",
    "",
    "Безопасность:",
    "— При боли/травме: не мотивируй «терпи и беги». Дай осторожные шаги, и красные флаги.",
    "",
    "Ниже: планировщик передал intent и требования. Следуй им.",
  ].join("\n");

  const plannerBlock = `PLANNER_JSON:\n${JSON.stringify(planner, null, 2)}`;
  const memoryBlock = `THREAD_MEMORY_JSON:\n${JSON.stringify(threadMemory ?? {}, null, 2)}`;
  const factsBlock = `WORKOUTS_FACTS_JSON (source of truth):\n${JSON.stringify(
    {
      window_days: planner.needs.workouts_window_days,
      workouts,
    },
    null,
    2
  )}`;

  const coachHomeBlock = `COACH_HOME_JSON (may be null):\n${JSON.stringify(coachHome ?? null, null, 2)}`;

  const convo = pickRecentHistory(recentHistory, 14).map((m) => {
    if (m.type === "user") return { role: "user" as const, content: m.body };
    if (m.type === "coach") return { role: "assistant" as const, content: m.body };
    return { role: "system" as const, content: m.body };
  });

  // Ensure last user message is present
  convo.push({ role: "user", content: userText });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.6,
    max_tokens: 950,
    messages: [
      { role: "system", content: responderSystem },
      { role: "system", content: plannerBlock },
      { role: "system", content: memoryBlock },
      { role: "system", content: factsBlock },
      { role: "system", content: coachHomeBlock },
      ...convo,
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Извини, не получилось сформировать ответ. Попробуй ещё раз."
  );
}

// -----------------------------
// Main Route
// -----------------------------
export async function POST(req: NextRequest) {
  try {
    // 1) Parse body softly
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.warn("coach_send: json_parse_failed", e);
      body = {};
    }

    const rawText = (body?.text ?? body?.message ?? body?.content ?? "") as string;
    const userText = (rawText ?? "").toString().trim();
    const finalText =
      userText || "Пользователь не задал конкретный вопрос, но хочет получить рекомендации по тренировкам.";

    const reqThreadId = (body?.threadId ?? null) as string | null;

    // 2) Auth via Supabase
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.error("coach_send: auth error", userErr);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 3) Resolve thread
    let threadId: string | null = reqThreadId;

    if (threadId) {
      const { data: threadRow, error: tErr } = await supabase
        .from("coach_threads")
        .select("id, user_id, meta")
        .eq("id", threadId)
        .maybeSingle();

      if (tErr) {
        console.error("coach_send: thread_lookup_error", tErr);
        threadId = null;
      } else if (!threadRow || threadRow.user_id !== user.id) {
        threadId = null;
      }
    }

    if (!threadId) {
      const { data: existing, error: exErr } = await supabase
        .from("coach_threads")
        .select("id")
        .eq("user_id", user.id)
        .eq("scope", "general")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (exErr && exErr.code !== "PGRST116") {
        console.error("coach_send: thread_select_error", exErr);
      }

      if (existing) {
        threadId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("coach_threads")
          .insert({
            user_id: user.id,
            subject: "Мой тренер",
            scope: "general",
            created_by: user.id,
            meta: {}, // ensure meta exists
          })
          .select("id")
          .single();

        if (createErr || !created) {
          console.error("coach_send: thread_create_error", createErr);
          return NextResponse.json({ error: "thread_create_failed" }, { status: 500 });
        }

        threadId = created.id;
      }
    }

    if (!threadId) {
      return NextResponse.json({ error: "thread_resolve_failed" }, { status: 500 });
    }

    // 3.1) Read thread meta (memory)
    const { data: threadMetaRow, error: tMetaErr } = await supabase
      .from("coach_threads")
      .select("id, meta")
      .eq("id", threadId)
      .maybeSingle();

    if (tMetaErr) console.error("coach_send: thread_meta_read_error", tMetaErr);

    const threadMeta = (threadMetaRow as any)?.meta ?? {};
    const threadMemory = (threadMeta?.memory ?? null) as any | null;

    // 4) Insert user message
    const { data: userMsgRow, error: userMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id,
        type: "user",
        body: finalText,
        meta: null,
      })
      .select("*")
      .single();

    if (userMsgErr || !userMsgRow) {
      console.error("coach_send: user_message_insert_error", userMsgErr);
      return NextResponse.json({ error: "user_message_insert_failed" }, { status: 500 });
    }

    // 5) Load recent history (compact)
    const { data: historyAll, error: histErr } = await supabase
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60);

    if (histErr) console.error("coach_send: history_error", histErr);
    const recentHistory = pickRecentHistory(historyAll ?? [], 30);

    // 6) Planner
    const planner = await runPlanner({
      userText: finalText,
      threadMemory,
      recentHistory,
    });

    // 6.1) Apply memory patch (no extra LLM calls)
    if (planner?.memory_patch && Object.keys(planner.memory_patch).length) {
      const nextMemory = {
        ...(threadMemory ?? {}),
        ...planner.memory_patch,
        updated_at: new Date().toISOString(),
      };
      const nextMeta = {
        ...(threadMeta ?? {}),
        memory: nextMemory,
      };

      const { error: upMetaErr } = await supabase
        .from("coach_threads")
        .update({ meta: nextMeta })
        .eq("id", threadId);

      if (upMetaErr) console.error("coach_send: thread_meta_update_error", upMetaErr);
    }

    // 7) If clarify: reply with a single clarifying question
    if (planner.response_mode === "clarify") {
      const clarifyText =
        (planner.clarify_question ?? "").trim() ||
        "Подскажи, пожалуйста, чуть больше деталей — что именно ты хочешь получить от тренера?";

      const coachMeta = {
        model: "gpt-4.1-mini",
        source: "api/coach/send",
        stage: "clarify_only",
        planner,
      };

      const { data: coachMsgRow, error: coachMsgErr } = await supabase
        .from("coach_messages")
        .insert({
          thread_id: threadId,
          author_id: user.id,
          type: "coach",
          body: clarifyText,
          meta: coachMeta as any,
        })
        .select("*")
        .single();

      if (coachMsgErr || !coachMsgRow) {
        return NextResponse.json(
          {
            threadId,
            userMessage: userMsgRow,
            coachMessage: {
              id: "temp-coach",
              thread_id: threadId,
              author_id: user.id,
              type: "coach",
              body: clarifyText,
              meta: coachMeta as any,
              created_at: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          threadId,
          userMessage: userMsgRow,
          coachMessage: coachMsgRow,
        },
        { status: 200 }
      );
    }

    // 8) Data loader (workouts window + optional coach_home)
    const WORKOUTS_WINDOW_DAYS = clamp(planner.needs.workouts_window_days ?? 14, 1, 365);
    const WORKOUTS_LIMIT = clamp(planner.needs.workouts_limit ?? 30, 1, 100);

    const windowFromIso = new Date(Date.now() - WORKOUTS_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

    const { data: workoutsRaw, error: wErr } = await supabase
      .from("workouts")
      .select("id, sport, start_time, distance_m, duration_sec, moving_time_sec, avg_hr, max_hr")
      .eq("user_id", user.id)
      .gte("start_time", windowFromIso)
      .order("start_time", { ascending: false })
      .limit(WORKOUTS_LIMIT);

    if (wErr) console.error("coach_send: workouts_window_error", wErr);

    const workouts: WorkoutFact[] = (workoutsRaw ?? []).map((w: any) => ({
      id: w.id,
      sport: w.sport ?? null,
      start_time: w.start_time ?? null,
      distance_m: Number.isFinite(Number(w.distance_m)) ? Number(w.distance_m) : w.distance_m ?? null,
      duration_sec: w.duration_sec ?? null,
      moving_time_sec: w.moving_time_sec ?? null,
      avg_hr: w.avg_hr ?? null,
      max_hr: w.max_hr ?? null,
    }));

    const usedWorkoutIds = workouts.map((w) => w.id).filter(Boolean);

    let coachHome: any | null = null;
    if (planner.needs.include_coach_home) {
      const { data: coachHomeData, error: coachHomeErr } = await supabase.rpc("get_coach_home", {
        p_scope: "global",
        p_goal_id: null,
        p_include_snapshot_payload: false,
      });
      if (coachHomeErr) console.error("coach_send: coach_home_error", coachHomeErr);
      coachHome = coachHomeData ?? null;
    }

    // 9) Fast-path (no LLM) for simple facts
    const fp = planner.fast_path;
    if (fp?.enabled && fp.kind) {
      const fpWindow = clamp(fp.window_days ?? WORKOUTS_WINDOW_DAYS, 1, 365);
      // If planner asks different window, we can reuse current workouts only if window matches;
      // otherwise do a quick refetch (still cheap)
      let fpWorkouts = workouts;
      if (fpWindow !== WORKOUTS_WINDOW_DAYS) {
        const fpFromIso = new Date(Date.now() - fpWindow * 24 * 3600 * 1000).toISOString();
        const { data: w2, error: w2Err } = await supabase
          .from("workouts")
          .select("id, sport, start_time, distance_m, duration_sec, moving_time_sec, avg_hr, max_hr")
          .eq("user_id", user.id)
          .gte("start_time", fpFromIso)
          .order("start_time", { ascending: false })
          .limit(80);
        if (w2Err) console.error("coach_send: workouts_fastpath_refetch_error", w2Err);
        fpWorkouts = (w2 ?? []).map((w: any) => ({
          id: w.id,
          sport: w.sport ?? null,
          start_time: w.start_time ?? null,
          distance_m: Number.isFinite(Number(w.distance_m)) ? Number(w.distance_m) : w.distance_m ?? null,
          duration_sec: w.duration_sec ?? null,
          moving_time_sec: w.moving_time_sec ?? null,
          avg_hr: w.avg_hr ?? null,
          max_hr: w.max_hr ?? null,
        }));
      }

      const fastAnswer = buildFastPathAnswer(fp.kind, fpWorkouts, fpWindow);

      const coachMeta = {
        model: "fast_path_no_llm",
        source: "api/coach/send",
        fast_path: fp,
        used_workout_ids: fpWorkouts.map((w) => w.id).filter(Boolean),
        workouts_window_days: fpWindow,
        planner,
      };

      const { data: coachMsgRow, error: coachMsgErr } = await supabase
        .from("coach_messages")
        .insert({
          thread_id: threadId,
          author_id: user.id,
          type: "coach",
          body: fastAnswer,
          meta: coachMeta as any,
        })
        .select("*")
        .single();

      if (coachMsgErr || !coachMsgRow) {
        return NextResponse.json(
          {
            threadId,
            userMessage: userMsgRow,
            coachMessage: {
              id: "temp-coach",
              thread_id: threadId,
              author_id: user.id,
              type: "coach",
              body: fastAnswer,
              meta: coachMeta as any,
              created_at: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { threadId, userMessage: userMsgRow, coachMessage: coachMsgRow },
        { status: 200 }
      );
    }

    // 10) Responder (LLM)
    const answer = await runResponder({
      userText: finalText,
      planner,
      threadMemory: (threadMeta?.memory ?? null) as any,
      workouts,
      coachHome,
      recentHistory,
    });

    const coachMeta = {
      model: "gpt-4.1-mini",
      source: "api/coach/send",
      stage: "answer",
      planner,
      workouts_window_days: WORKOUTS_WINDOW_DAYS,
      used_workout_ids: usedWorkoutIds,
      has_coach_home: !!coachHome,
      style_version: "v1_intent_planner_fastpath_memory",
    };

    const { data: coachMsgRow, error: coachMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id,
        type: "coach",
        body: answer,
        meta: coachMeta as any,
      })
      .select("*")
      .single();

    if (coachMsgErr || !coachMsgRow) {
      console.error("coach_send: coach_message_insert_error", coachMsgErr);
      return NextResponse.json(
        {
          error: "coach_message_insert_failed",
          threadId,
          userMessage: userMsgRow,
          coachMessage: {
            id: "temp-coach",
            thread_id: threadId,
            author_id: user.id,
            type: "coach",
            body: answer,
            meta: coachMeta as any,
            created_at: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        threadId,
        userMessage: userMsgRow,
        coachMessage: coachMsgRow,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("coach_send: unexpected_error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}