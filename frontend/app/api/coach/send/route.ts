import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import util from "node:util";
import "server-only";

import { runPlanner } from "@/lib/coach/planner";
import { COACH_MODELS } from "@/lib/coach/modelConfig";
import { runResponder, buildWeeklyScheduleLocalResponse } from "@/lib/coach/responder";
import { buildFastPathAnswer } from "@/lib/coach/fastPath";
import { buildCoachContext } from "@/lib/coach/context";
import { PlannerOut } from "@/lib/coach/types";

import {
  buildFallbackCoachText,
  didSaveToWorkoutDescription,
  pickRecentHistory,
  buildLocalWorkoutAnalysis,
  buildLocalRpeFollowupAnswer,
} from "@/lib/coach/utils";

import { getDialogState, setDialogState } from "@/lib/coach/dialogState";
import { routeIntent } from "@/lib/coach/intentRouter";

import {
  loadMemoryTopDirect,
  normalizeMemoryForLLM,
  mergeLegacyMemory,
  applyMemoryPatch,
} from "@/lib/coach/memoryStore";

import { normalizeAIError, userFacingAIErrorText } from "@/lib/coach/openaiError";
import { createAdminClient, createClientWithCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV !== "production";
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const db = createAdminClient();

type DbClient = ReturnType<typeof createAdminClient>;

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
    // 1️⃣ Parse body
    stage = "parse_body";
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const rawText = (body?.text ?? body?.message ?? "") as string;
    const userText = rawText?.trim() || "";
    const finalText =
      userText || "Пользователь хочет получить рекомендации по тренировкам.";

    const client_nonce = body?.client_nonce ?? null;
    const reqThreadId = body?.threadId ?? null;

    // 2️⃣ Auth
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

    if (!user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    insertedUserId = user.id;

    // 3️⃣ Resolve thread
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

    if (!threadId) {
      return NextResponse.json({ error: "thread_resolve_failed" }, { status: 500 });
    }

    insertedThreadId = threadId;

    // 4️⃣ Read thread meta
    stage = "thread_meta_read";
    const { data: threadRow } = await db
      .from("coach_threads")
      .select("meta")
      .eq("id", threadId)
      .maybeSingle();

    const threadMeta = threadRow?.meta ?? {};
    const legacyThreadMemory = threadMeta?.memory ?? null;

    const memTop = await loadMemoryTopDirect({
      supabase: db,
      userId: user.id,
    });

    const memoryTopForLLM = normalizeMemoryForLLM(memTop?.items ?? []);
    const threadMemory = mergeLegacyMemory(memoryTopForLLM, legacyThreadMemory);

    const dialogState = getDialogState(threadMeta);

    // 5️⃣ Insert user message
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

    // 6️⃣ Load history
    stage = "load_history";
    const { data: historyAll } = await db
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60);

    const recentHistory = pickRecentHistory(historyAll ?? [], 30);

    // 7️⃣ Weekly local
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

      return NextResponse.json({
        threadId,
        userMessage: userMsgRow,
        coachMessage: ins.data,
      });
    }

    // 8️⃣ Planner
    stage = "planner";
    const planner = await runPlanner({
      openai,
      userText: finalText,
      threadMemory,
      recentHistory,
    });

    // Apply memory patch
    if (planner.memory_patch && Object.keys(planner.memory_patch).length) {
      await applyMemoryPatch({
        supabase: db,
        patch: planner.memory_patch,
        sourceRef: `thread:${threadId}`,
      });
    }

    // 9️⃣ Build context after planner
    stage = "build_context";
    const context = await buildCoachContext({
      supabase: db,
      userId: user.id,
      threadId,
      plannerNeeds: planner.needs,
    });

    // 🔟 Fast path
    if (planner.fast_path?.enabled) {
      const answer = buildFastPathAnswer(
        planner.fast_path.kind,
        context.workouts,
        planner.fast_path.window_days ?? planner.needs.workouts_window_days ?? 14,
        planner.fast_path.nth
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

      return NextResponse.json({
        threadId,
        userMessage: userMsgRow,
        coachMessage: ins.data,
      });
    }

    // 1️⃣1️⃣ Responder
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

    return NextResponse.json({
      threadId,
      userMessage: userMsgRow,
      coachMessage: ins.data,
    });
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