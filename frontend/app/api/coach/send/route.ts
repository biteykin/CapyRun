import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import OpenAI from "openai";
import { z } from "zod";

import { runPlanner } from "@/lib/coach/planner";
import { runResponder } from "@/lib/coach/responder";
import { buildFastPathAnswer } from "@/lib/coach/fastPath";
import { buildCoachContext } from "@/lib/coach/context";
import {
  PlannerOut,
  WorkoutFact,
} from "@/lib/coach/types";
import {
  buildFallbackCoachText,
  clamp,
  didSaveToWorkoutDescription,
  normalizeErr,
  pickRecentHistory,
  buildLocalWorkoutAnalysis,
  buildLocalRpeFollowupAnswer,
} from "@/lib/coach/utils";

import { getDialogState, setDialogState, resetDialogState } from "@/lib/coach/dialogState";
import { routeIntent } from "@/lib/coach/intentRouter";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV !== "production";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type CoachInsertResult = { row: any | null; error: any | null };

async function insertCoachMessage(args: {
  supabase: any;
  threadId: string;
  userId: string;
  body: string;
  meta: any;
}): Promise<CoachInsertResult> {
  const { supabase, threadId, userId, body, meta } = args;
  const { data, error } = await supabase
    .from("coach_messages")
    .insert({
      thread_id: threadId,
      author_id: userId,
      type: "coach",
      body,
      meta,
    })
    .select("*")
    .single();
  return { row: data ?? null, error };
}

export async function POST(req: NextRequest) {
  let insertedThreadId: string | null = null;
  let insertedUserId: string | null = null;
  let insertedUserMsg: any | null = null;

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
    const client_nonce = (body?.client_nonce ?? null) as string | null;

    const finalText =
      userText || "Пользователь не задал конкретный вопрос, но хочет получить рекомендации по тренировкам.";

    const reqThreadId = (body?.threadId ?? null) as string | null;

    // 2) Auth
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.error("coach_send: auth error", userErr);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    insertedUserId = user.id;

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

      if (exErr && exErr.code !== "PGRST116") console.error("coach_send: thread_select_error", exErr);

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
            meta: {},
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

    if (!threadId) return NextResponse.json({ error: "thread_resolve_failed" }, { status: 500 });
    insertedThreadId = threadId;

    // 3.1) Read thread meta (memory)
    const { data: threadMetaRow, error: tMetaErr } = await supabase
      .from("coach_threads")
      .select("id, meta")
      .eq("id", threadId)
      .maybeSingle();

    if (tMetaErr) console.error("coach_send: thread_meta_read_error", tMetaErr);

    const threadMeta = (threadMetaRow as any)?.meta ?? {};
    const threadMemory = (threadMeta?.memory ?? null) as any | null;

    const dialogState = getDialogState(threadMeta);

    // 4) Insert user message
    const { data: userMsgRow, error: userMsgErr } = await supabase
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

    if (userMsgErr || !userMsgRow) {
      console.error("coach_send: user_message_insert_error", userMsgErr);
      return NextResponse.json(
        {
          error: "user_message_insert_failed",
          dbg: IS_DEV
            ? {
                code: (userMsgErr as any)?.code ?? null,
                message: (userMsgErr as any)?.message ?? null,
                details: (userMsgErr as any)?.details ?? null,
              }
            : undefined,
        },
        { status: 500 }
      );
    }
    insertedUserMsg = userMsgRow;

    // 4.1) Re-read row to see trigger-updated meta
    const { data: userMsgFresh, error: userFreshErr } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("id", userMsgRow.id)
      .maybeSingle();

    const userMessage = userFreshErr || !userMsgFresh ? userMsgRow : userMsgFresh;
    const didSave = didSaveToWorkoutDescription((userMessage as any)?.meta);

    // 5) Load recent history
    const { data: historyAll, error: histErr } = await supabase
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60);

    if (histErr) console.error("coach_send: history_error", histErr);
    let recentHistory = pickRecentHistory(historyAll ?? [], 30);

    // 5.1) EARLY LOCAL: user answered coach RPE question (легко/норм/тяжело) => do NOT call planner/responder
    // Причина: иначе LLM часто "попугаит" прошлый ответ и повторяет вопрос.
    const userShort = finalText.trim().toLowerCase();
    const isRpeWord = /^(легко|норм|нормально|тяжело)$/i.test(userShort);
    const lastCoachMsg = [...recentHistory].reverse().find((m) => m.type === "coach");
    const coachAskedRpe =
      typeof lastCoachMsg?.body === "string" &&
      /легко\/норм\/тяжело\?/i.test(lastCoachMsg.body);

    if (isRpeWord && coachAskedRpe) {
      const context = await buildCoachContext({
        supabase,
        userId: user.id,
        threadId,
        plannerNeeds: {
          workouts_window_days: 14,
          workouts_limit: 30,
          include_coach_home: false,
          include_thread_memory: true,
          include_geo: false,
          include_calendar: false,
        } as any,
      });

      const localText = buildLocalRpeFollowupAnswer(context?.workouts?.[0] ?? null, userShort);
      const coachMeta = {
        model: "local",
        source: "api/coach/send",
        stage: "local_rpe_followup",
        rpe: userShort,
      };

      const { data: coachMsgRow, error: coachMsgErr } = await supabase
        .from("coach_messages")
        .insert({
          thread_id: threadId,
          author_id: user.id,
          type: "coach",
          body: localText,
          meta: coachMeta as any,
        })
        .select("*")
        .single();

      return NextResponse.json(
        {
          threadId,
          userMessage,
          coachMessage:
            coachMsgErr || !coachMsgRow
              ? {
                  id: "temp-coach",
                  thread_id: threadId,
                  author_id: user.id,
                  type: "coach",
                  body: localText,
                  meta: { ...coachMeta, temp: true } as any,
                  created_at: new Date().toISOString(),
                }
              : coachMsgRow,
        },
        { status: 200 }
      );
    }

    // 6) Planner
    let planner: PlannerOut;
    try {
      planner = await runPlanner({ openai, userText: finalText, threadMemory, recentHistory });
    } catch (e) {
      const ne = normalizeErr((e as any)?._planner ?? e);
      console.error("coach_send: planner_failed", ne);

      const fallbackText = buildFallbackCoachText(didSave);
      const fallbackMeta = { stage: "planner_failed", client_nonce, didSave, temp: false, error: ne };

      const ins = await insertCoachMessage({ supabase, threadId, userId: user.id, body: fallbackText, meta: fallbackMeta });

      return NextResponse.json(
        {
          threadId,
          userMessage,
          coachMessage:
            ins.row ??
            ({
              id: "temp-coach",
              thread_id: threadId,
              author_id: user.id,
              type: "coach",
              body: fallbackText,
              meta: { ...fallbackMeta, temp: true },
              created_at: new Date().toISOString(),
            } as any),
          dbg: IS_DEV ? { stage: "planner_failed", error: ne } : undefined,
        },
        { status: 200 }
      );
    }

    // 6.1) Apply memory patch
    if (planner?.memory_patch && Object.keys(planner.memory_patch).length) {
      const nextMemory = { ...(threadMemory ?? {}), ...planner.memory_patch, updated_at: new Date().toISOString() };
      const nextMeta = { ...(threadMeta ?? {}), memory: nextMemory };

      const { error: upMetaErr } = await supabase.from("coach_threads").update({ meta: nextMeta }).eq("id", threadId);
      if (upMetaErr) console.error("coach_send: thread_meta_update_error", upMetaErr);
    }

    // 6.2) Intent routing
    const routed = routeIntent({
      planner,
      dialogState,
      userText: finalText,
    });

    // 7) Clarify branch (only if NOT inside scenario)
    if (planner.response_mode === "clarify") {
      if (dialogState.scenario !== "idle") {
        // внутри сценария — не уточняем повторно
      } else {
        const clarifyText =
          (planner.clarify_question ?? "").trim() ||
          "Подскажи, пожалуйста, чуть больше деталей — что именно ты хочешь получить от тренера?";

        const coachMeta = {
          model: "gpt-4.1-mini",
          source: "api/coach/send",
          stage: "clarify_only",
          planner,
          client_nonce, // ✅ важно для дедупликации optimistic/temp на фронте
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

        return NextResponse.json(
          { threadId, userMessage, coachMessage: coachMsgRow ?? {
              id: "temp-coach",
              thread_id: threadId,
              author_id: user.id,
              type: "coach",
              body: clarifyText,
              meta: coachMeta as any,
              created_at: new Date().toISOString(),
            } },
          { status: 200 }
        );
      }
    }

    // 7.1) Scenario handling
    if (routed.kind === "start_workout_review") {
      const nextMeta = setDialogState(threadMeta, {
        scenario: "workout_review",
        step: "await_feedback",
        workout_id: context.workouts[0]?.id,
      });
      await supabase.from("coach_threads").update({ meta: nextMeta }).eq("id", threadId);
    }

    if (routed.kind === "continue_scenario") {
      // продолжаем без повторных вопросов
    }

    // 8) Build unified context
    const context = await buildCoachContext({
      supabase,
      userId: user.id,
      threadId,
      plannerNeeds: planner.needs,
    });

    // 9) Fast-path
    const fp = planner.fast_path;
    if (fp?.enabled && fp.kind) {
      const fastAnswer = buildFastPathAnswer(
        fp.kind,
        context.workouts,
        fp.window_days ?? planner.needs.workouts_window_days ?? 14
      );

      const coachMeta = {
        model: "fast_path_no_llm",
        source: "api/coach/send",
        client_nonce, // ✅ важно для дедупликации optimistic/temp на фронте
        fast_path: fp,
        used_workout_ids: context.workouts.map((w: any) => w.id).filter(Boolean),
        workouts_window_days: fp.window_days ?? planner.needs.workouts_window_days ?? 14,
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

      return NextResponse.json(
        { threadId, userMessage, coachMessage: coachMsgErr || !coachMsgRow ? {
            id: "temp-coach",
            thread_id: threadId,
            author_id: user.id,
            type: "coach",
            body: fastAnswer,
            meta: coachMeta as any,
            created_at: new Date().toISOString(),
          } : coachMsgRow },
        { status: 200 }
      );
    }

    // 10) Responder
    let answer = "";
    let responderError: string | null = null;

    try {
      answer = await runResponder({
        openai,
        userText: finalText,
        planner,
        recentHistory,
        context,
      });
    } catch (e) {
      console.error("coach_send: responder_failed", e);
      responderError = String(e);

      const workouts = context?.workouts ?? [];

      // 🔥 LOCAL FALLBACK: analysis
      if (planner.intent === "analysis" && workouts.length > 0) {
        answer = buildLocalWorkoutAnalysis(workouts[0]) ?? buildFallbackCoachText(didSave);
      }

      // 🔥 LOCAL FALLBACK: simple facts about last workout
      else if (planner.intent === "simple_fact" && workouts.length > 0) {
        answer = buildLocalWorkoutAnalysis(workouts[0]);
      }

      else {
        answer = buildFallbackCoachText(didSave);
      }
    }

    const coachMeta = {
      model: "gpt-4.1-mini",
      source: "api/coach/send",
      stage: "answer",
      planner,
      workouts_window_days: planner.needs.workouts_window_days,
      used_workout_ids: context.workouts.map((w: any) => w.id),
      has_coach_home: !!context.coachHome,
      style_version: "v1_intent_planner_fastpath_memory",
      client_nonce,
      didSave,
      responder_failed: !!responderError,
      responder_error: IS_DEV ? responderError : null,
    };

    const { row: coachMsgRow, error: coachMsgErr } = await insertCoachMessage({
      supabase,
      threadId,
      userId: user.id,
      body: answer,
      meta: coachMeta as any,
    });

    if (coachMsgErr || !coachMsgRow) {
      console.error("coach_send: coach_message_insert_error", coachMsgErr);
      return NextResponse.json(
        {
          error: "coach_message_insert_failed",
          threadId,
          userMessage,
          coachMessage: {
            id: "temp-coach",
            thread_id: threadId,
            author_id: user.id,
            type: "coach",
            body: answer,
            meta: coachMeta as any,
            created_at: new Date().toISOString(),
          },
          dbg: IS_DEV
            ? {
                code: (coachMsgErr as any)?.code ?? null,
                message: (coachMsgErr as any)?.message ?? null,
                details: (coachMsgErr as any)?.details ?? null,
              }
            : undefined,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ threadId, userMessage, coachMessage: coachMsgRow }, { status: 200 });
  } catch (err) {
    console.error("coach_send: unexpected_error", err);

    if (insertedUserMsg && insertedThreadId && insertedUserId) {
      const didSave = didSaveToWorkoutDescription(insertedUserMsg.meta);
      try {
        const supabase = await createSupabaseServerClient();
        const fallbackText = buildFallbackCoachText(didSave);
        const fallbackMeta = { stage: "internal_error_after_user_insert", didSave, temp: false };
        const ins = await insertCoachMessage({
          supabase,
          threadId: insertedThreadId,
          userId: insertedUserId,
          body: fallbackText,
          meta: fallbackMeta,
        });

        return NextResponse.json(
          {
            threadId: insertedThreadId,
            userMessage: insertedUserMsg,
            coachMessage:
              ins.row ??
              ({
                id: "temp-coach",
                thread_id: insertedThreadId,
                author_id: insertedUserId,
                type: "coach",
                body: fallbackText,
                meta: { ...fallbackMeta, temp: true },
                created_at: new Date().toISOString(),
              } as any),
          },
          { status: 200 }
        );
      } catch {
        return NextResponse.json(
          {
            threadId: insertedThreadId,
            userMessage: insertedUserMsg,
            coachMessage: {
              id: "temp-coach",
              thread_id: insertedThreadId,
              author_id: insertedUserId,
              type: "coach",
              body: buildFallbackCoachText(didSave),
              meta: { temp: true, error: "internal_error_after_user_insert", didSave },
              created_at: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}