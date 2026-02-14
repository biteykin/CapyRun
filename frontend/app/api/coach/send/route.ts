import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import util from "node:util";
import "server-only";

import { runPlanner } from "@/lib/coach/planner";
import { COACH_MODELS } from "@/lib/coach/modelConfig";
import { runResponder } from "@/lib/coach/responder";
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

// ⚠️ адаптируйте импорт под ваш серверный supabase-клиент
import { createClient, createClientWithCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV !== "production";
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Используем существующий admin client (SERVICE_ROLE_KEY)
const supabaseAdmin = createClient();

type SupabaseAdminClient = ReturnType<typeof createClient>;

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function insertCoachMessage(
  supabaseAdmin: SupabaseAdminClient,
  params: {
    thread_id: string;
    author_id: string;
    body: string;
    stage: string;
    meta?: Record<string, any>;
  }
) {
  const { thread_id, author_id, body, stage, meta } = params;
  return supabaseAdmin
    .from("coach_messages")
    .insert({
      thread_id,
      // IMPORTANT: coach_messages.author_id is NOT NULL (and used in RLS / FK),
      // so we must always set it.
      author_id,
      type: "coach",
      body,
      meta: { ...(meta ?? {}), stage },
    })
    // IMPORTANT: return full row so UI can render immediately (no realtime dependency)
    .select("*")
    .single();
}

async function findRecentSameFallback(
  supabaseAdmin: SupabaseAdminClient,
  params: {
    thread_id: string;
    error_code?: string;
    windowSeconds: number;
  }
) {
  const { thread_id, error_code, windowSeconds } = params;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Ищем последнюю заглушку за окно времени
  // и сравниваем error.code (если есть)
  const { data } = await supabaseAdmin
    .from("coach_messages")
    // include body so we can return a usable message when deduping
    .select("id, thread_id, author_id, type, body, created_at, meta")
    .eq("thread_id", thread_id)
    .eq("type", "coach")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data?.length) return null;
  const hit = data.find((m: any) => {
    const st = m?.meta?.stage;
    const code = m?.meta?.error?.code;
    return st === "internal_error_after_user_insert" && (error_code ? code === error_code : true);
  });
  return hit ?? null;
}

export async function POST(req: NextRequest) {
  let insertedThreadId: string | null = null;
  let insertedUserId: string | null = null;
  let insertedUserMsg: any | null = null;
  let stage = "start";

  try {
    stage = "parse_body";
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

    if (!HAS_OPENAI_KEY) {
      console.error("coach_send: OPENAI_API_KEY missing on server");
      // не роняем, но сразу видно, почему будет заглушка
    }

    // 2) Auth
    stage = "auth";
    const supabase = supabaseAdmin;
    let user: { id: string } | null = null;
    let userErr: any = null;

    try {
      // 2.1) Prefer auth cookie (если запрос идёт из браузера с сессией Supabase)
      const supabaseAuth = await createClientWithCookies();
      const { data, error } = await supabaseAuth.auth.getUser();
      if (!error && data?.user?.id) {
        user = { id: data.user.id };
      }
    } catch (e) {
      // cookie auth может быть недоступен — это не критично
    }

    // 2.2) Fallback: Bearer token (клиентский Supabase access_token)
    // Это нужно, потому что supabaseBrowser часто хранит сессию в localStorage, а не в cookies.
    if (!user?.id) {
      const token = getBearerToken(req);
      if (token) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data?.user?.id) {
          user = { id: data.user.id };
        } else {
          userErr = `Bearer auth failed: ${error?.message ?? "unknown"}`;
        }
      }
    }

    // 2.3) Legacy fallback (оставим на всякий случай для внутренних батчей)
    // Но лучше не использовать на фронте.
    if (!user?.id && body?.userId) {
      user = { id: String(body.userId) };
    }

    if (!user?.id) {
      userErr = "No auth user (cookie) and no userId in body";
    }

    if (userErr || !user) {
      console.error("coach_send: auth error", userErr);
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
    insertedUserId = user.id;

    // 3) Resolve thread
    stage = "thread_resolve";
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
    stage = "thread_meta_read";
    const { data: threadMetaRow, error: tMetaErr } = await supabase
      .from("coach_threads")
      .select("id, meta")
      .eq("id", threadId)
      .maybeSingle();

    if (tMetaErr) console.error("coach_send: thread_meta_read_error", tMetaErr);

    const threadMeta = (threadMetaRow as any)?.meta ?? {};
    const legacyThreadMemory = (threadMeta?.memory ?? null) as any | null;

    // ✅ Memory Engine v1: читаем структурированную память из coach_memory_items
    const memTop = await loadMemoryTopDirect({
      supabase,
      userId: user.id,
      category: null,
      goalId: null,
      sport: null,
      limit: 30,
      minImportance: 1,
    });
    const memoryTopForLLM = normalizeMemoryForLLM(memTop?.items ?? []);
    const threadMemory = mergeLegacyMemory(memoryTopForLLM ?? {}, legacyThreadMemory);

    const dialogState = getDialogState(threadMeta);

    // 4) Insert user message
    stage = "insert_user_message";
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
    stage = "re_read_user_message";
    const { data: userMsgFresh, error: userFreshErr } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("id", userMsgRow.id)
      .maybeSingle();

    const userMessage = userFreshErr || !userMsgFresh ? userMsgRow : userMsgFresh;
    const didSave = didSaveToWorkoutDescription((userMessage as any)?.meta);

    // 🚫 HARD DEDUP: если на это userMessage уже есть coach-ответ — ничего больше не делаем
    const { data: existingCoach } = await supabase
      .from("coach_messages")
      .select("id")
      .eq("thread_id", threadId)
      .eq("meta->>reply_to", userMessage.id)
      .limit(1);

    if (existingCoach && existingCoach.length > 0) {
      return NextResponse.json(
        {
          threadId,
          userMessage,
          coachMessage: null,
        },
        { status: 200 }
      );
    }

    // 5) Load recent history
    stage = "load_history";
    const { data: historyAll, error: histErr } = await supabase
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60);

    if (histErr) console.error("coach_send: history_error", histErr);
    let recentHistory = pickRecentHistory(historyAll ?? [], 30);

    // 5.05) Build unified context EARLY
    // IMPORTANT: context is used by scenario router and local handlers; must exist before routeIntent/scenario steps.
    stage = "build_context_early";
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

    // 5.1) EARLY LOCAL: user answered coach RPE question (легко/норм/тяжело) => do NOT call planner/responder
    const userShort = finalText.trim().toLowerCase();
    const isRpeWord = /^(легко|норм|нормально|тяжело)$/i.test(userShort);
    const lastCoachMsg = [...recentHistory].reverse().find((m) => m.type === "coach");
    const coachAskedRpe =
      typeof lastCoachMsg?.body === "string" &&
      /легко\/норм\/тяжело\?/i.test(lastCoachMsg.body);

    if (isRpeWord && coachAskedRpe) {
      const localFn = buildLocalRpeFollowupAnswer as any;
      const localText =
        typeof localFn === "function"
          ? localFn(context?.workouts?.[0] ?? null, userShort)
          : "Понял. Тогда следующую тренировку сделаем спокойной: 30–40 минут лёгкого бега в комфортном темпе + разминка/заминка. Хочешь, распишу конкретно по минутам?";

      const coachMeta = {
        model: "local",
        source: "api/coach/send",
        stage: "local_rpe_followup",
        rpe: userShort,
        client_nonce,
      };

      const { data: coachMsgRow, error: coachMsgErr } = await supabase
        .from("coach_messages")
        .insert({
          thread_id: threadId,
          author_id: user.id,
          type: "coach",
          body: localText,
          meta: { ...(coachMeta as any), reply_to: userMessage.id },
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
                  meta: { ...coachMeta, reply_to: userMessage.id, temp: true } as any,
                  created_at: new Date().toISOString(),
                }
              : coachMsgRow,
        },
        { status: 200 }
      );
    }

    // ---------------------------------------------------------------------------
    // HARD LOCAL: weekly_schedule rules (do not call planner/LLM)
    // ---------------------------------------------------------------------------
    const t = finalText.toLowerCase();
    const isWeeklyPlan = /план\s+на\s+недел/.test(t);
    const isOfpWhen = /когда.*офп/.test(t) || /на\s+какой\s+день.*офп/.test(t);

    const ws =
      (threadMemory?.preferences?.weekly_schedule ??
        threadMemory?.preferences?.weeklySchedule ??
        threadMemory?.weekly_schedule) ??
      null;

    const wsObj = ws && typeof ws === "object" ? ws : null;
    const runDays = Array.isArray(wsObj?.run_days) ? wsObj.run_days : [];
    const ofpDays = Array.isArray(wsObj?.ofp_days) ? wsObj.ofp_days : [];
    const hasWs = runDays.length || ofpDays.length;

    const dayRu = (d: string) =>
      ({
        mon: "Понедельник",
        tue: "Вторник",
        wed: "Среда",
        thu: "Четверг",
        fri: "Пятница",
        sat: "Суббота",
        sun: "Воскресенье",
      } as any)[String(d || "").toLowerCase()] ?? String(d || "");

    if (hasWs && (isWeeklyPlan || isOfpWhen)) {
      stage = "local_weekly_schedule";
      let localText = "";
      if (isOfpWhen) {
        const ofp = ofpDays.map(dayRu);
        localText = ofp.length ? `ОФП по weekly_schedule: ${ofp.join(", ")}.` : `По weekly_schedule у нас не задан день ОФП.`;
      } else {
        const mins = Number(threadMemory?.preferences?.preferred_session_minutes?.value ?? 40) || 40;
        const m = Math.max(20, Math.min(45, mins));
        const runText = `лёгкая ходьба или очень спокойный бег ${m} мин (комфортно, без усталости)`;
        const ofpText = `ОФП без ударной нагрузки ${m} мин: мобильность, баланс, растяжка`;

        const lines: string[] = [];
        runDays.map(dayRu).forEach((d: string) => lines.push(`- ${d}: ${runText}`));
        ofpDays.map(dayRu).forEach((d: string) => lines.push(`- ${d}: ${ofpText}`));
        lines.push(`- Остальные дни: отдых / прогулка 20–40 мин + лёгкая растяжка 5–10 мин`);
        localText = ["План на неделю без нагрузки по твоему weekly_schedule:", ...lines].join("\n");
      }

      const coachMeta = { model: "local_weekly_schedule", source: "api/coach/send", stage: "local_weekly_schedule", client_nonce };
      const { data: coachMsgRow, error: coachMsgErr } = await supabase
        .from("coach_messages")
        .insert({ thread_id: threadId, author_id: user.id, type: "coach", body: localText, meta: { ...(coachMeta as any), reply_to: userMessage.id } })
        .select("*")
        .single();

      return NextResponse.json(
        { threadId, userMessage, coachMessage: coachMsgErr || !coachMsgRow ? {
            id: "temp-coach",
            thread_id: threadId,
            author_id: user.id,
            type: "coach",
            body: localText,
            meta: { ...(coachMeta as any), reply_to: userMessage.id, temp: true },
            created_at: new Date().toISOString(),
          } : coachMsgRow },
        { status: 200 }
      );
    }

    // 6) Planner
    stage = "planner";
    let planner: PlannerOut;
    try {
      planner = await runPlanner({ openai, userText: finalText, threadMemory, recentHistory });
    } catch (e) {
      // --- Новый блок обработки ошибок OpenAI/planner ---
      const normalized = normalizeAIError(e);
      console.error("coach_send: planner_failed", normalized || e);
      let errText = "";
      if (normalized) {
        errText = userFacingAIErrorText(normalized) || buildFallbackCoachText(didSave);
      } else {
        errText = buildFallbackCoachText(didSave);
      }
      const fallbackMeta = {
        stage: "planner_failed",
        client_nonce,
        didSave,
        temp: false,
        error: normalized || (e as any),
      };

      const ins = await insertCoachMessage(supabaseAdmin, {
        thread_id: threadId,
        author_id: user.id,
        body: errText,
        stage: "planner_failed",
        meta: fallbackMeta,
      });

      return NextResponse.json(
        {
          threadId,
          userMessage,
          coachMessage:
            ins.data ??
            ({
              id: "temp-coach",
              thread_id: threadId,
              author_id: user.id,
              type: "coach",
              body: errText,
              meta: { ...fallbackMeta, temp: true },
              created_at: new Date().toISOString(),
            } as any),
          dbg: IS_DEV ? { stage: "planner_failed", error: normalized || e, has_openai_key: HAS_OPENAI_KEY } : undefined,
        },
        { status: 200 }
      );
    }

    // 6.1) Apply memory patch
    stage = "apply_memory_patch";
    if (planner?.memory_patch && Object.keys(planner.memory_patch).length) {
      await applyMemoryPatch({
        supabase,
        patch: planner.memory_patch,
        sourceRef: `thread:${threadId}`,
      });

      const nextLegacy = {
        ...(legacyThreadMemory ?? {}),
        ...planner.memory_patch,
        updated_at: new Date().toISOString(),
      };
      const nextMeta = { ...(threadMeta ?? {}), memory: nextLegacy };
      const { error: upMetaErr } = await supabase
        .from("coach_threads")
        .update({ meta: nextMeta })
        .eq("id", threadId);
      if (upMetaErr) console.error("coach_send: thread_meta_update_error", upMetaErr);
    }

    // 6.2) Intent routing
    stage = "intent_routing";
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
          model: COACH_MODELS.responder,
          source: "api/coach/send",
          stage: "clarify_only",
          planner,
          client_nonce,
        };

        const { data: coachMsgRow, error: coachMsgErr } = await supabase
          .from("coach_messages")
          .insert({
            thread_id: threadId,
            author_id: user.id,
            type: "coach",
            body: clarifyText,
            meta: { ...(coachMeta as any), reply_to: userMessage.id },
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
              meta: { ...(coachMeta as any), reply_to: userMessage.id },
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
        workout_id: context?.workouts?.[0]?.id ?? null,
      });
      await supabase.from("coach_threads").update({ meta: nextMeta }).eq("id", threadId);
    }

    if (routed.kind === "continue_scenario") {
      // продолжаем без повторных вопросов
    }

    // 8) Enrich context with plannerNeeds window (optional re-fetch)
    stage = "build_context_planner_needs";
    const context2 = await buildCoachContext({
      supabase,
      userId: user.id,
      threadId,
      plannerNeeds: planner.needs,
    });

    stage = "load_memory_top_2";
    const memTop2 = await loadMemoryTopDirect({
      supabase,
      userId: user.id,
      category: null,
      goalId: null,
      sport: null,
      limit: 30,
      minImportance: 1,
    });
    const memoryTopForLLM2 = normalizeMemoryForLLM(memTop2?.items ?? []);

    // 9) Fast-path
    stage = "fast_path_check";
    const fp = planner.fast_path;
    if (fp?.enabled && fp.kind) {
      const fastAnswer = buildFastPathAnswer(
        fp.kind,
        context2.workouts,
        fp.window_days ?? planner.needs.workouts_window_days ?? 14,
        (fp as any)?.nth
      );

      const coachMeta = {
        model: "fast_path_no_llm",
        source: "api/coach/send",
        client_nonce,
        fast_path: fp,
        used_workout_ids: context2.workouts.map((w: any) => w.id).filter(Boolean),
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
          meta: { ...(coachMeta as any), reply_to: userMessage.id },
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
            meta: { ...(coachMeta as any), reply_to: userMessage.id },
            created_at: new Date().toISOString(),
          } : coachMsgRow },
        { status: 200 }
      );
    }

    // 10) Responder
    stage = "responder";
    let answer = "";
    let responderError: string | null = null;

    try {
      answer = await runResponder({
        openai,
        userText: finalText,
        planner,
        threadMemory: mergeLegacyMemory(memoryTopForLLM2, context2.memory ?? null),
        workouts: context2.workouts ?? [],
        coachHome: context2.coachHome ?? null,
        recentHistory,
      });
    } catch (e) {
      // --- Новый блок обработки ошибок OpenAI/responder ---
      const normalized = normalizeAIError(e);
      console.error("coach_send: responder_failed", normalized || e);
      responderError = normalized ? String(normalized.message || normalized.type || normalized.error) : String(e);

      let fallbackAnswer = "";
      // 🔥 LOCAL FALLBACK FOR ANALYSIS QUESTIONS
      const workouts = context2 && context2.workouts ? context2.workouts : [];
      if (planner.intent === "analysis" && workouts.length > 0) {
        const local = buildLocalWorkoutAnalysis(workouts[0]);
        fallbackAnswer = local || buildFallbackCoachText(didSave);
      } else {
        fallbackAnswer = userFacingAIErrorText(normalized) || buildFallbackCoachText(didSave);
      }
      answer = fallbackAnswer;
    }

    const coachMeta = {
      model: COACH_MODELS.responder,
      source: "api/coach/send",
      stage: "answer",
      planner,
      workouts_window_days: planner.needs.workouts_window_days,
      used_workout_ids: context2.workouts.map((w: any) => w.id),
      has_coach_home: !!context2.coachHome,
      style_version: "v1_intent_planner_fastpath_memory",
      client_nonce,
      didSave,
      responder_failed: !!responderError,
      responder_error: IS_DEV ? responderError : null,
    };

    // Note: insertCoachMessage altered API: thread_id, body, stage, meta
    stage = "insert_coach_message";
    const ins = await insertCoachMessage(supabaseAdmin, {
      thread_id: threadId,
      author_id: user.id,
      body: answer,
      stage: "answer",
      meta: { ...(coachMeta as any), reply_to: userMessage.id },
    });

    if (ins.error || !ins.data) {
      console.error("coach_send: coach_message_insert_error", ins.error);
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
            meta: { ...(coachMeta as any), reply_to: userMessage.id },
            created_at: new Date().toISOString(),
          },
          dbg: IS_DEV
            ? {
                code: (ins.error as any)?.code ?? null,
                message: (ins.error as any)?.message ?? null,
                details: (ins.error as any)?.details ?? null,
              }
            : undefined,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ threadId, userMessage, coachMessage: ins.data }, { status: 200 });
  } catch (err) {
    // ВАЖНО: тут мы и падали — теперь покажем СТАДИЮ и ошибку
    console.error("coach_send: unexpected_error", { stage, err: util.inspect(err, { depth: 6 }) });

    if (insertedUserMsg && insertedThreadId && insertedUserId) {
      const didSave = didSaveToWorkoutDescription(insertedUserMsg.meta);
      try {
        const fallbackText = buildFallbackCoachText(didSave);
        const fallbackMeta = {
          stage: "internal_error_after_user_insert",
          failed_stage: stage,
          didSave,
          temp: false,
          // в dev кладём ошибку в meta, чтобы видеть в Supabase (аккуратно)
          error: IS_DEV ? (err as any)?.message ?? String(err) : undefined,
        };
        // dedup: has there already been a recent identical fallback for this error in this thread?
        const existing = await findRecentSameFallback(supabaseAdmin, {
          thread_id: insertedThreadId,
          windowSeconds: 180, // 3 минуты, чтобы не засорять
        });
        if (existing) {
          return NextResponse.json(
            {
              threadId: insertedThreadId,
              userMessage: insertedUserMsg,
              coachMessage: existing,
              deduped: true,
              dbg: IS_DEV ? { stage, error: (err as any)?.message ?? String(err) } : undefined,
            },
            { status: 200 }
          );
        }

        const ins = await insertCoachMessage(supabaseAdmin, {
          thread_id: insertedThreadId,
          author_id: insertedUserId,
          body: fallbackText,
          stage: "internal_error_after_user_insert",
          meta: fallbackMeta,
        });

        return NextResponse.json(
          {
            threadId: insertedThreadId,
            userMessage: insertedUserMsg,
            coachMessage:
              ins.data ??
              ({
                id: "temp-coach",
                thread_id: insertedThreadId,
                author_id: insertedUserId,
                type: "coach",
                body: fallbackText,
                meta: { ...fallbackMeta, temp: true },
                created_at: new Date().toISOString(),
              } as any),
            dbg: IS_DEV ? { stage, error: (err as any)?.message ?? String(err) } : undefined,
          },
          { status: 200 }
        );
      } catch (e) {
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
            dbg: IS_DEV ? { stage, error: (err as any)?.message ?? String(err) } : undefined,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}