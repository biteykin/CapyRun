import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import util from "node:util";
import crypto from "node:crypto";
import "server-only";

import { runPlanner } from "@/lib/coach/planner";
import { COACH_MODELS } from "@/lib/coach/modelConfig";
import { runResponder, buildWeeklyScheduleLocalResponse } from "@/lib/coach/responder";
import { buildFastPathAnswer } from "@/lib/coach/fastPath";
import { buildCoachContext } from "@/lib/coach/context";
import { PlannerOut } from "@/lib/coach/types";

import {
  buildFallbackCoachText,
  pickRecentHistory,
  buildLocalWorkoutAnalysis,
} from "@/lib/coach/utils";

import { getDialogState } from "@/lib/coach/dialogState";

import {
  loadMemoryTopDirect,
  normalizeMemoryForLLM,
  mergeLegacyMemory,
  applyMemoryPatch,
} from "@/lib/coach/memoryStore";

import { normalizeAIError, userFacingAIErrorText } from "@/lib/coach/openaiError";
import { createAdminClient, createClientWithCookies } from "@/lib/supabase/server";
import {
  getFollowupUserMessagesSinceAnchor,
  getLastWorkoutBoundCoachMessageBefore,
  isGeneralPlanningIntent,
  isLikelyWorkoutFollowup,
  isMultiWorkoutAnalysisIntent,
  isWorkoutAnalysisIntent,
} from "@/lib/coach/intents";
import {
  buildLocalMultiWorkoutFactAnswer,
  isStrictFactualSummaryQuestion,
  loadMultiWorkoutPayload,
} from "@/lib/coach/multiWorkout";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db = createAdminClient();
type DbClient = ReturnType<typeof createAdminClient>;

type WorkoutInsightRow = {
  id: string;
  user_id: string;
  scope: string;
  entity_id: string;
  sport: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  content_md: string | null;
  data: any;
  model: string | null;
  prompt_version: string | null;
  created_at: string;
};

type WorkoutInsightMini = {
  content_md?: string | null;
  summary?: string | null;
  title?: string | null;
  created_at?: string | null;
};

type FastPathInsightsMap = Record<string, WorkoutInsightMini | undefined>;

type WorkoutInsightBuildOptions = {
  forceRegenerate?: boolean;
  followupUserText?: string | null;
  source?: string | null;
  anchorMessageId?: string | null;
};

function hashTextShort(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

async function logWorkoutInsightCacheHit(params: {
  db: DbClient;
  userId: string;
  workoutId: string;
  locale: string;
  insight: WorkoutInsightRow;
}) {
  const { db, userId, workoutId, locale, insight } = params;

  const dedupKey = `workout_insight_cache_hit:${workoutId}:${insight.id}:${hashTextShort(locale)}`;

  const { error } = await db.from("ai_requests").insert({
    user_id: userId,
    workout_id: workoutId,
    model: insight.model ?? "cache",
    locale,
    purpose: "workout_insight",
    status: "success",
    dedup_key: dedupKey,
    input: {
      cache_hit: true,
      source: "ai_insights",
      insight_id: insight.id,
      workout_id: workoutId,
    },
    output: {
      cache_hit: true,
      insight_id: insight.id,
      prompt_version: insight.prompt_version ?? null,
      created_at: insight.created_at ?? null,
    },
  });

  if (error) {
    console.error("ai_requests: cache_hit_log_error", error);
  }
}

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function insertCoachReply(params: {
  db: DbClient;
  threadId: string;
  userId: string;
  replyToId: string;
  body: string;
  stage: string;
  meta?: Record<string, any>;
}) {
  const { db, threadId, userId, replyToId, body, stage, meta } = params;

  return db
    .from("coach_messages")
    .insert({
      thread_id: threadId,
      author_id: userId,
      type: "coach",
      body,
      meta: { ...(meta ?? {}), stage, reply_to: replyToId },
    })
    .select("*")
    .single();
}

async function getActiveWorkoutInsight(params: {
  db: DbClient;
  workoutId: string;
}): Promise<WorkoutInsightRow | null> {
  const { db, workoutId } = params;

  const { data, error } = await db
    .from("ai_insights")
    .select(
      [
        "id",
        "user_id",
        "scope",
        "entity_id",
        "sport",
        "status",
        "title",
        "summary",
        "content_md",
        "data",
        "model",
        "prompt_version",
        "created_at",
      ].join(",")
    )
    .eq("scope", "workout")
    .eq("entity_id", workoutId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data ?? null) as WorkoutInsightRow | null;
}

async function preloadInsightsForWorkouts(params: {
  db: DbClient;
  userId: string;
  workoutIds: string[];
}): Promise<FastPathInsightsMap> {
  const { db, userId, workoutIds } = params;
  if (!workoutIds.length) return {};

  const { data, error } = await db
    .from("ai_insights")
    .select("entity_id, content_md, summary, title, created_at")
    .eq("scope", "workout")
    .eq("status", "active")
    .eq("user_id", userId)
    .in("entity_id", workoutIds);

  if (error || !data) return {};

  const map: FastPathInsightsMap = {};
  for (const r of data as any[]) {
    const id = String(r.entity_id);
    map[id] = {
      content_md: r.content_md ?? null,
      summary: r.summary ?? null,
      title: r.title ?? null,
      created_at: r.created_at ?? null,
    };
  }
  return map;
}

async function createMultiWorkoutAnalysisViaLLM(params: {
  userText: string;
  locale: string;
  payload: Awaited<ReturnType<typeof loadMultiWorkoutPayload>>;
}) {
  const { userText, locale, payload } = params;

  const model = process.env.OPENAI_WORKOUT_MODEL ?? COACH_MODELS.responder ?? "gpt-4o-mini";

  const strictFactsOnly = payload.facts_only_recommended || isStrictFactualSummaryQuestion(userText);

  const system =
    locale?.startsWith("ru")
      ? [
          "Ты — живой, внимательный и практичный беговой тренер.",
          "Нужно анализировать несколько тренировок и их динамику по окнам времени.",
          "Опирайся только на данные из FACTS_JSON.",
          "Не выдумывай дистанции, темпы, пульс, цели, травмы, старты и даты.",
          "Не называй человека 'пользователь'. Пиши естественно: 'у нас', 'по тренировкам', 'по бегу'.",
          "Пиши дружелюбно, без канцелярита и без слащавости.",
          "Если данных мало — прямо скажи это.",
          strictFactsOnly
            ? [
                "Это фактологический вопрос про объём, количество, километраж, время или сводную статистику.",
                "Отвечай коротко и точно по цифрам.",
                "Не добавляй блоки 'Что можно улучшить', 'Что предлагаю дальше', рекомендации, риски и советы, если о них не спросили.",
                "Не уходи в анализ одной тренировки.",
              ].join("\n")
            : [
                "Если вопрос про динамику, прогресс или тренды — делай именно анализ динамики, а не одной тренировки.",
                "Рекомендации давай только если они реально следуют из данных и уместны для вопроса.",
                "Не повторяй шаблонные советы без необходимости.",
                "Если вопрос не просит план — не строй подробный план.",
              ].join("\n"),
          strictFactsOnly
            ? [
                "Формат ответа:",
                "1) краткий фактологический вывод,",
                "2) затем 2–5 коротких пунктов с ключевыми цифрами.",
              ].join("\n")
            : [
                "Формат ответа:",
                "## Кратко",
                "## Что видно по динамике",
                "## Риски / что настораживает",
                "## Что можно улучшить",
                "## Что предлагаю дальше",
                "Если какой-то раздел не нужен по смыслу, сократи его, а не раздувай.",
              ].join("\n"),
        ].join("\n")
      : [
          "You are a practical and friendly running coach.",
          "Analyze multiple workouts and time-window trends.",
          "Use only FACTS_JSON.",
          "Do not invent metrics, goals, injuries, race dates, or history.",
          "Do not refer to the person as 'the user'.",
          "Be natural, concise, and helpful.",
          "If data is thin, say so clearly.",
          strictFactsOnly
            ? [
                "This is a factual summary question about count, mileage, time, or aggregate stats.",
                "Answer briefly and precisely with numbers.",
                "Do not add recommendations, risks, or next steps unless explicitly requested.",
                "Do not drift into single-workout analysis.",
              ].join("\n")
            : [
                "If the question is about trends or progress, analyze trends rather than one workout.",
                "Do not add generic advice unless warranted by the question.",
                "Do not create a detailed plan unless explicitly requested.",
              ].join("\n"),
        ].join("\n");

  const resp = await openai.chat.completions.create({
    model,
    temperature: strictFactsOnly ? 0.2 : 0.35,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "FACTS_JSON:\n" +
          JSON.stringify(payload) +
          "\n\nQUESTION:\n" +
          userText +
          "\n\n" +
          (strictFactsOnly
            ? "Ответь как на сводный вопрос по статистике тренировок."
            : "Сделай разбор динамики нескольких тренировок. Если данных мало для сильных выводов — обозначь уровень уверенности."),
      },
    ],
  });

  return (resp.choices?.[0]?.message?.content ?? "").trim();
}

async function createWorkoutInsightViaLLM(params: {
  db: DbClient;
  userId: string;
  workoutId: string;
  locale: string;
  options?: WorkoutInsightBuildOptions;
}): Promise<WorkoutInsightRow> {
  const { db, userId, workoutId, locale, options } = params;

  const forceRegenerate = Boolean(options?.forceRegenerate);
  const followupUserText = (options?.followupUserText ?? "").trim() || null;
  const source = options?.source ?? null;
  const anchorMessageId = options?.anchorMessageId ?? null;

  if (!forceRegenerate) {
    const existing = await getActiveWorkoutInsight({ db, workoutId });
    if (existing) {
      await logWorkoutInsightCacheHit({
        db,
        userId,
        workoutId,
        locale,
        insight: existing,
      });
      return existing;
    }
  }

  const { data: workout, error: wErr } = await db
    .from("workouts")
    .select(
      [
        "id",
        "user_id",
        "sport",
        "name",
        "description",
        "start_time",
        "duration_sec",
        "moving_time_sec",
        "distance_m",
        "elev_gain_m",
        "avg_hr",
        "max_hr",
        "avg_pace_s_per_km",
        "avg_speed_kmh",
        "calories_kcal",
        "avg_cadence_spm",
      ].join(",")
    )
    .eq("id", workoutId)
    .maybeSingle();

  if (wErr || !workout) throw new Error(`Failed to load workout: ${wErr?.message ?? "not found"}`);
  if (String(workout.user_id) !== String(userId)) throw new Error("Forbidden (workout not owned by user)");

  const { data: segments, error: segErr } = await db
    .from("workout_segments")
    .select("seq,type,label,duration_sec,distance_m,avg_hr,avg_pace_s_per_km,pace_hms_per_km")
    .eq("workout_id", workoutId)
    .order("seq", { ascending: true });

  if (segErr) {
    console.error("workout_insight: segments_error", segErr);
  }

  const { data: ww, error: wwErr } = await db
    .from("workout_weather")
    .select("season,source,temperature_c,feels_like_c,wind_ms,precipitation_mm,condition,uv_index,uv_level")
    .eq("workout_id", workoutId)
    .maybeSingle();

  if (wwErr) {
    console.error("workout_insight: weather_error", wwErr);
  }

  let checkin: any = null;
  if (workout.start_time) {
    const startIso = new Date(workout.start_time).toISOString();
    const fromIso = new Date(new Date(startIso).getTime() - 48 * 3600 * 1000).toISOString();

    const { data: chk, error: chkErr } = await db
      .from("coach_checkins")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", fromIso)
      .lte("created_at", startIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (chkErr) console.error("workout_insight: checkin_error", chkErr);
    checkin = chk?.[0] ?? null;
  }

  const { data: zones, error: zErr } = await db
    .from("user_zones")
    .select("*")
    .eq("user_id", userId)
    .limit(50);

  if (zErr) console.error("workout_insight: zones_error", zErr);

  const workoutName =
    (workout as any)?.name != null && String((workout as any).name).trim()
      ? String((workout as any).name).trim()
      : null;

  const workoutDescription =
    (workout as any)?.description != null && String((workout as any).description).trim()
      ? String((workout as any).description).trim()
      : null;

  const facts = {
    workout,
    workout_name: workoutName,
    workout_description: workoutDescription,
    segments: segments ?? [],
    weather_row: ww ?? null,
    checkin,
    zones: zones ?? [],
    locale,
    followup_user_context: followupUserText,
    followup_source: source,
    force_regenerate: forceRegenerate,
    anchor_message_id: anchorMessageId,
  };

  const promptVersion = "workout_insight_v3";
  const model = process.env.OPENAI_WORKOUT_MODEL ?? COACH_MODELS.responder ?? "gpt-4o";
  const purpose = "workout_insight";

  const dedupSeed = forceRegenerate
    ? `${workoutId}:${promptVersion}:${locale}:${followupUserText ?? ""}:${Date.now()}`
    : `${workoutId}:${promptVersion}:${locale}`;

  const dedupKey = `workout_insight:${hashTextShort(dedupSeed)}`;

  const { data: reqRow, error: reqErr } = await db
    .from("ai_requests")
    .insert({
      user_id: userId,
      workout_id: workoutId,
      model,
      locale,
      purpose,
      input: facts,
      status: "started",
      dedup_key: dedupKey,
    })
    .select("id")
    .single();

  if (reqErr || !reqRow?.id) throw new Error(`Failed to insert ai_requests: ${reqErr?.message ?? "no id"}`);
  const requestId = String(reqRow.id);

  const system =
    locale?.startsWith("ru")
      ? [
          "Ты — внимательный и практичный тренер по выносливости.",
          "Опирайся только на данные из FACTS_JSON и FOLLOWUP_USER_CONTEXT.",
          "Не выдумывай числа, факты, цели, историю или травмы.",
          "Если пользователь дал субъективный фидбек, встрои его в анализ как главный контекст.",
          "Не называй человека 'пользователь'. Пиши естественно: 'ты отметил', 'по ощущениям', 'судя по описанию'.",
          "Не пиши сухо и канцелярски.",
          "Не советуй агрессивно наращивать нагрузку, если есть усталость, боль, плохой сон или плохое восстановление.",
          "Если данных недостаточно, прямо скажи это.",
          "Формат строго:",
          "## Кратко",
          "## Что хорошо",
          "## Риски",
          "## Что дальше",
          "## Вопросы",
          "В разделе 'Вопросы' давай 0–2 вопроса. Если вопросы не нужны — напиши просто '-'",
        ].join("\n")
      : [
          "You are a careful and practical endurance coach.",
          "Use only FACTS_JSON and FOLLOWUP_USER_CONTEXT.",
          "Do not invent numbers, facts, goals, history, or injuries.",
          "If there is subjective feedback, make it the main interpretation context.",
          "Do not refer to the person as 'the user'.",
          "Be natural and concise.",
          "Do not recommend increasing load if there are signs of fatigue, pain, poor sleep, or poor recovery.",
          "If data is insufficient, say so explicitly.",
          "Use sections:",
          "## Brief",
          "## What went well",
          "## Risks",
          "## What next",
          "## Questions",
          "Questions can be 0-2. If none are needed, output '-'",
        ].join("\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      content_md: { type: "string" },
      data: {
        type: "object",
        additionalProperties: true,
        properties: {
          positives: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          next_session_hint: { type: "string" },
          questions: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["title", "summary", "content_md", "data"],
  } as const;

  let llmJson: any = null;

  try {
    const followupBlock = followupUserText
      ? `\n\nFOLLOWUP_USER_CONTEXT:\n${followupUserText}\n`
      : "\n\nFOLLOWUP_USER_CONTEXT:\nnull\n";

    const resp = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: { name: "WorkoutInsight", schema },
      } as any,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "FACTS_JSON:\n" +
            JSON.stringify(facts) +
            followupBlock +
            "\nСделай полезный разбор одной конкретной тренировки.\n" +
            "Требования:\n" +
            "1) Если FOLLOWUP_USER_CONTEXT не пустой — обязательно учти его в 'Риски' и 'Что дальше'.\n" +
            "2) Если есть погода — используй её по делу.\n" +
            "3) Если есть усталость, тяжесть, боль, плохой сон, плохое восстановление — не советуй резко прибавлять.\n" +
            "4) Не пиши 'пользователь отметил'.\n" +
            "5) Не выдумывай факты.\n" +
            "6) Если вопросы не нужны — в разделе '## Вопросы' поставь '-'.",
        },
      ],
    });

    const txt = resp.choices?.[0]?.message?.content ?? "";
    llmJson = txt ? JSON.parse(txt) : null;

    await db
      .from("ai_requests")
      .update({
        status: "success",
        output: llmJson,
        raw_response: resp as any,
        tokens_prompt: (resp as any).usage?.prompt_tokens ?? null,
        tokens_completion: (resp as any).usage?.completion_tokens ?? null,
      })
      .eq("id", requestId);
  } catch (e: any) {
    await db
      .from("ai_requests")
      .update({
        status: "failed",
        error: e?.message ?? String(e),
      })
      .eq("id", requestId);

    throw e;
  }

  if (!llmJson?.content_md) throw new Error("LLM returned empty insight");

  const displayTitle = (llmJson?.title ?? "").trim() || workoutName || "Тренировка";

  await db.from("ai_outputs").insert({
    request_id: requestId,
    kind: "workout_insight",
    summary: llmJson.summary ?? null,
    data: llmJson.data ?? {},
    workout_id: workoutId,
    user_id: userId,
    locale,
  });

  const { data: insRow, error: insErr } = await db
    .from("ai_insights")
    .insert({
      user_id: userId,
      scope: "workout",
      entity_id: workoutId,
      period_from: null,
      period_to: null,
      sport: workout.sport ?? null,
      status: "active",
      title: displayTitle,
      summary: llmJson.summary ?? null,
      content_md: llmJson.content_md ?? null,
      data: llmJson.data ?? {},
      model,
      prompt_version: promptVersion,
      tokens_used: null,
      cost_usd: null,
    })
    .select(
      [
        "id",
        "user_id",
        "scope",
        "entity_id",
        "sport",
        "status",
        "title",
        "summary",
        "content_md",
        "data",
        "model",
        "prompt_version",
        "created_at",
      ].join(",")
    )
    .single();

  if (insErr || !insRow) throw new Error(`Failed to insert ai_insights: ${insErr?.message ?? "no row"}`);

  if (forceRegenerate) {
    const { error: supersedeErr } = await db
      .from("ai_insights")
      .update({ status: "superseded" })
      .eq("scope", "workout")
      .eq("entity_id", workoutId)
      .eq("status", "active")
      .neq("id", insRow.id);

    if (supersedeErr) {
      console.error("workout_insight: supersede_previous_error", supersedeErr);
    }
  }

  return insRow as WorkoutInsightRow;
}

const DEFAULT_CONTEXT_NEEDS: PlannerOut["needs"] = {
  workouts_window_days: 14,
  workouts_limit: 30,
  include_coach_home: false,
  include_thread_memory: true,
  include_geo: false,
  include_calendar: false,
};

export async function POST(req: NextRequest) {
  let stage = "start";
  let insertedUserMsg: any = null;
  let insertedThreadId: string | null = null;
  let insertedUserId: string | null = null;

  try {
    stage = "parse_body";
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const rawText = (body?.text ?? body?.message ?? "") as string;
    const userText = rawText?.trim() || "";
    const finalText = userText || "Пользователь хочет получить рекомендации по тренировкам.";

    const locale = (body?.locale ?? "ru") as string;
    const client_nonce = body?.client_nonce ?? null;
    const reqThreadId = body?.threadId ?? null;

    stage = "auth";
    let user: { id: string } | null = null;

    try {
      const supabaseAuth = await createClientWithCookies();
      const { data } = await supabaseAuth.auth.getUser();
      if (data?.user?.id) user = { id: data.user.id };
    } catch {}

    if (!user?.id) {
      const token = getBearerToken(req);
      if (token) {
        const { data } = await db.auth.getUser(token);
        if (data?.user?.id) user = { id: data.user.id };
      }
    }

    if (!user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    insertedUserId = user.id;

    stage = "thread_resolve";
    let threadId: string | null = reqThreadId;

    if (threadId) {
      const { data } = await db
        .from("coach_threads")
        .select("id,user_id")
        .eq("id", threadId)
        .maybeSingle();

      if (!data || data.user_id !== user.id) threadId = null;
    }

    if (!threadId) {
      const { data: existing } = await db
        .from("coach_threads")
        .select("id")
        .eq("user_id", user.id)
        .eq("scope", "general")
        .limit(1)
        .maybeSingle();

      if (existing) {
        threadId = existing.id;
      } else {
        const { data: created } = await db
          .from("coach_threads")
          .insert({
            user_id: user.id,
            subject: "Мой тренер",
            scope: "general",
            created_by: user.id,
            meta: {},
          })
          .select("id")
          .single();

        threadId = created?.id ?? null;
      }
    }

    if (!threadId) return NextResponse.json({ error: "thread_resolve_failed" }, { status: 500 });
    insertedThreadId = threadId;

    stage = "thread_meta_read";
    const { data: threadRow } = await db
      .from("coach_threads")
      .select("meta")
      .eq("id", threadId)
      .maybeSingle();

    const threadMeta = threadRow?.meta ?? {};
    const legacyThreadMemory = threadMeta?.memory ?? null;

    const memTop = await loadMemoryTopDirect({ supabase: db, userId: user.id });
    const memoryTopForLLM = normalizeMemoryForLLM(memTop?.items ?? []);
    const threadMemory = mergeLegacyMemory(memoryTopForLLM, legacyThreadMemory);

    getDialogState(threadMeta);

    stage = "insert_user_message";
    const { data: userMsgRow } = await db
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id,
        type: "user",
        body: finalText,
        meta: client_nonce ? { client_nonce } : null,
      })
      .select("*")
      .single();

    insertedUserMsg = userMsgRow;

    stage = "load_history";
    const { data: historyAll } = await db
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60);

    const recentHistory = pickRecentHistory(historyAll ?? [], 30);

    stage = "intent_detection";
    const generalPlanningIntent = isGeneralPlanningIntent(finalText);
    const multiWorkoutIntent = !generalPlanningIntent && isMultiWorkoutAnalysisIntent(finalText);

    if (multiWorkoutIntent) {
      stage = "multi_workout_analysis_load";

      const payload = await loadMultiWorkoutPayload({
        supabase: db,
        userId: user.id,
        userText: finalText,
      });

      let answer = "";

      try {
        if (payload.summary_windows.every((x) => x.workouts_count === 0)) {
          answer =
            "Пока я не вижу тренировок в истории, чтобы посчитать динамику. Как только появятся записи, смогу собрать сводку по объёму, километражу, времени и трендам.";
        } else if (payload.facts_only_recommended) {
          answer = buildLocalMultiWorkoutFactAnswer(payload) ?? "";
        } else {
          answer = await createMultiWorkoutAnalysisViaLLM({
            userText: finalText,
            locale,
            payload,
          });
        }
      } catch (e) {
        console.error("multi_workout_analysis_failed", e);
        answer = buildLocalMultiWorkoutFactAnswer(payload) ?? "";
      }

      if (!answer) {
        answer =
          buildLocalMultiWorkoutFactAnswer(payload) ??
          "Я посмотрел историю тренировок, но сейчас не смог собрать аккуратный ответ. Попробуй уточнить период: 4 недели, 3 месяца, 6 месяцев или всё время.";
      }

      const requestedWindowStats =
        payload.summary_windows.find((x) => x.label === payload.requested_window) ?? null;

      const ins = await insertCoachReply({
        db,
        threadId,
        userId: user.id,
        replyToId: userMsgRow.id,
        body: answer,
        stage: "multi_workout_analysis",
        meta: {
          model: payload.facts_only_recommended ? "local+sql" : COACH_MODELS.responder,
          question_kind: payload.question_kind,
          requested_window: payload.requested_window,
          facts_only_recommended: payload.facts_only_recommended,
          detailed_recent_workouts_count: payload.detailed_recent_workouts.length,
          monthly_buckets_count: payload.monthly_buckets.length,
          requested_window_workouts: requestedWindowStats?.workouts_count ?? null,
          all_time_workouts:
            payload.summary_windows.find((x) => x.label === "all_time")?.workouts_count ?? null,
        },
      });

      return NextResponse.json({
        threadId,
        userMessage: userMsgRow,
        coachMessage: ins.data,
      });
    }

    stage = "detect_workout_followup";
    const lastWorkoutBoundCoachMsg = !generalPlanningIntent
      ? await getLastWorkoutBoundCoachMessageBefore({
          db,
          threadId,
          beforeCreatedAt: userMsgRow.created_at,
        })
      : null;

    const replyWorkoutId = lastWorkoutBoundCoachMsg?.meta?.workout_id
      ? String(lastWorkoutBoundCoachMsg.meta.workout_id)
      : null;

    const isWorkoutFollowup =
      !generalPlanningIntent &&
      Boolean(replyWorkoutId) &&
      isLikelyWorkoutFollowup(finalText);

    if (isWorkoutFollowup && replyWorkoutId && lastWorkoutBoundCoachMsg) {
      stage = "workout_followup_insight";

      try {
        const previousUserFollowups = await getFollowupUserMessagesSinceAnchor({
          db,
          threadId,
          anchorCreatedAt: lastWorkoutBoundCoachMsg.created_at,
          beforeCreatedAt: userMsgRow.created_at,
        });

        const subjectiveFollowups = previousUserFollowups
          .filter((m) => isLikelyWorkoutFollowup(String(m.body ?? "")))
          .map((m) => String(m.body ?? "").trim())
          .filter(Boolean);

        const mergedFollowupText = [...subjectiveFollowups, finalText].join("\n");

        const insight = await createWorkoutInsightViaLLM({
          db,
          userId: user.id,
          workoutId: replyWorkoutId,
          locale,
          options: {
            forceRegenerate: true,
            followupUserText: mergedFollowupText,
            source: "reply_to_workout_bound_message",
            anchorMessageId: lastWorkoutBoundCoachMsg.id,
          },
        });

        const answerFromInsight =
          (insight?.content_md ?? "").trim() || (insight?.summary ?? "").trim();

        if (answerFromInsight) {
          const ins = await insertCoachReply({
            db,
            threadId,
            userId: user.id,
            replyToId: userMsgRow.id,
            body: answerFromInsight,
            stage: "workout_followup_insight",
            meta: {
              model: insight?.model ?? "llm",
              prompt_version: insight?.prompt_version ?? "workout_insight_v3",
              workout_id: replyWorkoutId,
              source: "reply_to_workout_bound_message",
              anchor_message_id: lastWorkoutBoundCoachMsg.id,
              force_regenerated: true,
              followup_messages_count: subjectiveFollowups.length + 1,
            },
          });

          return NextResponse.json({
            threadId,
            userMessage: userMsgRow,
            coachMessage: ins.data,
          });
        }
      } catch (e) {
        console.error("workout_followup_insight_failed", e);
      }
    }

    const wsLocal = buildWeeklyScheduleLocalResponse(finalText, threadMemory);
    if (wsLocal) {
      const ins = await insertCoachReply({
        db,
        threadId,
        userId: user.id,
        replyToId: userMsgRow.id,
        body: wsLocal,
        stage: "local_weekly_schedule",
        meta: { model: "local" },
      });

      return NextResponse.json({ threadId, userMessage: userMsgRow, coachMessage: ins.data });
    }

    stage = "planner";
    const planner = await runPlanner({ openai, userText: finalText, threadMemory, recentHistory });

    if (planner.memory_patch && Object.keys(planner.memory_patch).length) {
      await applyMemoryPatch({
        supabase: db,
        patch: planner.memory_patch,
        sourceRef: `thread:${threadId}`,
      });
    }

    stage = "build_context";
    const context = await buildCoachContext({
      supabase: db,
      userId: user.id,
      threadId,
      plannerNeeds: planner.needs ?? DEFAULT_CONTEXT_NEEDS,
    });

    const workoutIds = (context.workouts ?? [])
      .map((w: any) => String((w as any)?.id ?? ""))
      .filter(Boolean);

    const insightsByWorkoutId = await preloadInsightsForWorkouts({
      db,
      userId: user.id,
      workoutIds,
    });

    if (planner.fast_path?.enabled) {
      const wantsAnalysis = isWorkoutAnalysisIntent(finalText);
      const looksLikeFollowup = !generalPlanningIntent && isLikelyWorkoutFollowup(finalText);
      const kind = planner.fast_path.kind;
      const isLastOrNth = kind === "last_workout" || kind === "nth_workout";

      if (wantsAnalysis && isLastOrNth) {
        let targetWorkoutId: string | null = null;

        if (kind === "last_workout") {
          targetWorkoutId = (context.workouts?.[0] as any)?.id ?? null;
        } else {
          const rawNth = Number(planner.fast_path.nth ?? 2);
          const nth = Number.isFinite(rawNth) ? Math.trunc(rawNth) : 2;
          const idx = Math.max(0, Math.min(49, nth - 1));
          targetWorkoutId = (context.workouts?.[idx] as any)?.id ?? null;
        }

        const meta: Record<string, any> = {
          model: "fast_path",
          workout_insight_attempted: true,
          workout_insight_workout_id: targetWorkoutId,
          workout_insight_error: null,
        };

        if (targetWorkoutId) {
          try {
            const insight = await createWorkoutInsightViaLLM({
              db,
              userId: user.id,
              workoutId: targetWorkoutId,
              locale,
              options: looksLikeFollowup
                ? {
                    forceRegenerate: true,
                    followupUserText: finalText,
                    source: "analysis_request_with_subjective_feedback",
                  }
                : undefined,
            });

            const answerFromInsight =
              (insight?.content_md ?? "").trim() || (insight?.summary ?? "").trim();

            if (answerFromInsight) {
              const ins = await insertCoachReply({
                db,
                threadId,
                userId: user.id,
                replyToId: userMsgRow.id,
                body: answerFromInsight,
                stage: looksLikeFollowup ? "workout_followup_insight" : "workout_insight",
                meta: {
                  model: insight?.model ?? "llm",
                  prompt_version: insight?.prompt_version ?? "workout_insight_v3",
                  workout_id: targetWorkoutId,
                  source: looksLikeFollowup
                    ? "analysis_request_with_subjective_feedback"
                    : "analysis_request",
                  force_regenerated: looksLikeFollowup || undefined,
                },
              });

              return NextResponse.json({ threadId, userMessage: userMsgRow, coachMessage: ins.data });
            }
          } catch (e: any) {
            meta.workout_insight_error = e?.message ?? String(e);
          }
        } else {
          meta.workout_insight_error = "targetWorkoutId is null";
        }

        const answer = buildFastPathAnswer(
          planner.fast_path.kind,
          context.workouts,
          planner.fast_path.window_days ?? planner.needs?.workouts_window_days ?? 14,
          planner.fast_path.nth,
          planner.fast_path.from_iso,
          planner.fast_path.to_iso,
          insightsByWorkoutId
        );

        const ins = await insertCoachReply({
          db,
          threadId,
          userId: user.id,
          replyToId: userMsgRow.id,
          body: answer,
          stage: "fast_path",
          meta,
        });

        return NextResponse.json({ threadId, userMessage: userMsgRow, coachMessage: ins.data });
      }

      const answer = buildFastPathAnswer(
        planner.fast_path.kind,
        context.workouts,
        planner.fast_path.window_days ?? planner.needs?.workouts_window_days ?? 14,
        planner.fast_path.nth,
        planner.fast_path.from_iso,
        planner.fast_path.to_iso,
        insightsByWorkoutId
      );

      const ins = await insertCoachReply({
        db,
        threadId,
        userId: user.id,
        replyToId: userMsgRow.id,
        body: answer,
        stage: "fast_path",
        meta: { model: "fast_path" },
      });

      return NextResponse.json({ threadId, userMessage: userMsgRow, coachMessage: ins.data });
    }

    stage = "responder";

    let answer = "";

    try {
      answer = await runResponder({
        openai,
        userText: finalText,
        planner,
        threadMemory: mergeLegacyMemory(context.memory ?? null, legacyThreadMemory),
        workouts: context.workouts ?? [],
        coachHome: context.coachHome ?? null,
        recentHistory,
      });
    } catch (e) {
      const normalized = normalizeAIError(e);
      answer =
        userFacingAIErrorText(normalized) ||
        buildLocalWorkoutAnalysis(context.workouts?.[0]) ||
        buildFallbackCoachText(false);
    }

    const ins = await insertCoachReply({
      db,
      threadId,
      userId: user.id,
      replyToId: userMsgRow.id,
      body: answer,
      stage: "answer",
      meta: { model: COACH_MODELS.responder },
    });

    return NextResponse.json({ threadId, userMessage: userMsgRow, coachMessage: ins.data });
  } catch (err) {
    console.error("coach_send unexpected", {
      stage,
      err: util.inspect(err, { depth: 6 }),
    });

    if (insertedUserMsg && insertedThreadId && insertedUserId) {
      const fallback = buildFallbackCoachText(false);

      const ins = await insertCoachReply({
        db,
        threadId: insertedThreadId,
        userId: insertedUserId,
        replyToId: insertedUserMsg.id,
        body: fallback,
        stage: "internal_error",
        meta: { error: (err as any)?.message ?? String(err), stage },
      });

      return NextResponse.json({
        threadId: insertedThreadId,
        userMessage: insertedUserMsg,
        coachMessage: ins.data,
      });
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}