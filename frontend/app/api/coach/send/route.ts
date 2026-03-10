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

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db = createAdminClient();
type DbClient = ReturnType<typeof createAdminClient>;

type WorkoutInsightRow = {
  id: string;
  user_id: string;
  scope: string; // 'workout'
  entity_id: string; // workout_id
  sport: string | null;
  status: string; // 'active'
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

type CoachMessageLite = {
  id: string;
  type: string;
  body: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

type WorkoutInsightBuildOptions = {
  forceRegenerate?: boolean;
  followupUserText?: string | null;
  source?: string | null;
};

function hashTextShort(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function isWorkoutBoundCoachMeta(meta: Record<string, any> | null | undefined) {
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

function isWorkoutAnalysisIntent(text: string) {
  const t = (text ?? "").toLowerCase();
  return (
    t.includes("проанализ") ||
    t.includes("анализ") ||
    t.includes("разбор") ||
    t.includes("разбери") ||
    t.includes("оцен") ||
    t.includes("как прошла") ||
    t.includes("как была") ||
    (t.includes("последн") && t.includes("трениров"))
  );
}

function isLikelyWorkoutFollowup(text: string) {
  const t = (text ?? "").toLowerCase().trim();
  if (!t) return false;

  return (
    t.includes("ощущ") ||
    t.includes("самочув") ||
    t.includes("нагруз") ||
    t.includes("устал") ||
    t.includes("усталост") ||
    t.includes("тяжело") ||
    t.includes("тяжел") ||
    t.includes("легко") ||
    t.includes("норм") ||
    t.includes("неплохо") ||
    t.includes("плохо") ||
    t.includes("дискомфорт") ||
    t.includes("бол") ||
    t.includes("забол") ||
    t.includes("тянет") ||
    t.includes("сводит") ||
    t.includes("икр") ||
    t.includes("бедр") ||
    t.includes("голен") ||
    t.includes("колен") ||
    t.includes("спин") ||
    t.includes("стоп") ||
    t.includes("ступн") ||
    t.includes("ног") ||
    t.includes("дых") ||
    t.includes("пульс") ||
    t.includes("сердц") ||
    t.includes("восстанов") ||
    t.includes("сон") ||
    t.includes("спал") ||
    t.includes("спалось") ||
    t.includes("поел") ||
    t.includes("ел ") ||
    t.startsWith("ел") ||
    t.includes("пил") ||
    t.includes("вода") ||
    t.includes("жажд") ||
    t.includes("rpe") ||
    /\b[1-9]\/10\b/.test(t) ||
    /\b10\/10\b/.test(t) ||
    /\brpe\s*[1-9]\b/.test(t) ||
    /\brpe\s*10\b/.test(t)
  );
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

async function getLastWorkoutBoundCoachMessageBefore(params: {
  db: DbClient;
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
  };

  const promptVersion = "workout_insight_v2";
  const model = process.env.OPENAI_WORKOUT_MODEL ?? COACH_MODELS.responder ?? "gpt-4.1-mini";
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
          "Опирайся ТОЛЬКО на данные из FACTS_JSON и FOLLOWUP_USER_CONTEXT.",
          "Не выдумывай числа, факты, цели, травмы или историю тренировок.",
          "Если пользователь дал субъективный фидбек (усталость, боль, RPE, сон, восстановление) — обязательно встрои это в анализ как главный контекст интерпретации.",
          "Не давай общих абстрактных советов. Привязывай выводы к этой конкретной тренировке.",
          "Если данные неполные или подозрительные — прямо укажи это в разделе рисков.",
          "Пиши компактно, по делу, без воды.",
          "Верни СТРОГО JSON по схеме.",
        ].join("\n")
      : [
          "You are a careful and practical endurance coach.",
          "Use ONLY values from FACTS_JSON and FOLLOWUP_USER_CONTEXT.",
          "Do not invent numbers, facts, goals, injuries, or history.",
          "If the user provided subjective feedback (fatigue, pain, RPE, sleep, recovery), incorporate it explicitly as the main interpretation context.",
          "Avoid generic advice; tie conclusions to this exact workout.",
          "If data is incomplete or suspicious, state that clearly in risks.",
          "Be concise and specific.",
          "Return STRICT JSON matching the schema.",
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
      temperature: 0.35,
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
            "\nСделай максимально полезный разбор одной конкретной тренировки.\n" +
            "Формат content_md:\n" +
            "## Кратко\n" +
            "## Что хорошо\n" +
            "## Риски\n" +
            "## Что дальше\n" +
            "## Вопросы\n\n" +
            "Требования:\n" +
            "1) Если FOLLOWUP_USER_CONTEXT не пустой, обязательно учти его в разделах 'Риски' и 'Что дальше'.\n" +
            "2) Если есть погода — используй её конкретно, без общих фраз.\n" +
            "3) Если пользователь жалуется на усталость, боль, тяжесть, плохой сон, плохое восстановление — не предлагай безусловно усиливать нагрузку.\n" +
            "4) Если данных недостаточно — прямо скажи это.\n" +
            "5) Не выдумывай чисел.",
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

    stage = "detect_workout_followup";
    const lastWorkoutBoundCoachMsg = await getLastWorkoutBoundCoachMessageBefore({
      db,
      threadId,
      beforeCreatedAt: userMsgRow.created_at,
    });

    const replyWorkoutId = lastWorkoutBoundCoachMsg?.meta?.workout_id
      ? String(lastWorkoutBoundCoachMsg.meta.workout_id)
      : null;

    const isWorkoutFollowup = Boolean(replyWorkoutId) && isLikelyWorkoutFollowup(finalText);

    if (isWorkoutFollowup && replyWorkoutId) {
      stage = "workout_followup_insight";

      try {
        const insight = await createWorkoutInsightViaLLM({
          db,
          userId: user.id,
          workoutId: replyWorkoutId,
          locale,
          options: {
            forceRegenerate: true,
            followupUserText: finalText,
            source: "reply_to_workout_bound_message",
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
              prompt_version: insight?.prompt_version ?? "workout_insight_v2",
              workout_id: replyWorkoutId,
              source: "reply_to_workout_bound_message",
              force_regenerated: true,
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

    const workoutIds = (context.workouts ?? []).map((w: any) => String((w as any)?.id ?? "")).filter(Boolean);
    const insightsByWorkoutId = await preloadInsightsForWorkouts({
      db,
      userId: user.id,
      workoutIds,
    });

    if (planner.fast_path?.enabled) {
      const wantsAnalysis = isWorkoutAnalysisIntent(finalText);
      const looksLikeFollowup = isLikelyWorkoutFollowup(finalText);
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
                  prompt_version: insight?.prompt_version ?? "workout_insight_v2",
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