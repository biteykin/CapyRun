// app/api/coach/send/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("coach/send: auth.getUser error", userErr);
      return NextResponse.json(
        { error: "auth_error" },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      );
    }

    // ---- Разбор тела запроса ----
    const body = await req.json().catch(() => null) as
      | { threadId?: string | null; text?: string; message?: string }
      | null;

    if (!body) {
      return NextResponse.json(
        { error: "invalid_json_body" },
        { status: 400 },
      );
    }

    const { threadId: rawThreadId, text, message } = body;
    const prompt = (text ?? message ?? "").trim();

    if (!prompt) {
      return NextResponse.json(
        { error: "missing_text" },
        { status: 400 },
      );
    }

    // ---- Готовим thread ----
    let threadId = rawThreadId ?? null;

    if (threadId) {
      // Проверим, что тред реально принадлежит пользователю
      const { data: existing, error: threadErr } = await supabase
        .from("coach_threads")
        .select("id, user_id, created_by")
        .eq("id", threadId)
        .maybeSingle();

      if (threadErr) {
        console.error("coach/send: check thread error", threadErr);
        threadId = null; // создадим новый
      } else if (
        !existing ||
        (existing.user_id !== user.id && existing.created_by !== user.id)
      ) {
        // чужой тред — не используем
        threadId = null;
      }
    }

    // Если тред отсутствует/невалидный — создаём новый
    if (!threadId) {
      const { data: newThread, error: newThreadErr } = await supabase
        .from("coach_threads")
        .insert({
          user_id: user.id,
          subject: "Личный чат с тренером",
          scope: "user",
          ref_plan_id: null,
          ref_goal_id: null,
          ref_session_id: null,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (newThreadErr || !newThread) {
        console.error("coach/send: create thread error", newThreadErr);
        return NextResponse.json(
          { error: "thread_create_failed" },
          { status: 500 },
        );
      }

      threadId = newThread.id;
    }

    // ---- Вставляем сообщение пользователя в coach_messages ----
    const { data: userMessageRow, error: userMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id,
        type: "user", // coach_msg_type: 'user' | 'coach' | 'system' | 'note'
        body: prompt,
        meta: {},
      })
      .select("*")
      .single();

    if (userMsgErr || !userMessageRow) {
      console.error("coach/send: insert user message error", userMsgErr);
      return NextResponse.json(
        {
          error: "user_message_insert_failed",
          detail: userMsgErr?.message ?? null,
          code: userMsgErr?.code ?? null,
        },
        { status: 500 },
      );
    }

    // ---- Подтягиваем контекст последних сообщений (для GPT) ----
    const { data: history, error: histErr } = await supabase
      .from("coach_messages")
      .select("id, type, body, created_at, author_id")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (histErr) {
      console.error("coach/send: history load error", histErr);
    }

    // Превращаем историю в messages для GPT
    const chatMessages = [];

    chatMessages.push({
      role: "system" as const,
      content:
        "Ты — персональный тренер по бегу и физподготовке. " +
        "Общайся по-русски, дружелюбно и по делу. " +
        "Учитывай прошлые сообщения в этом диалоге как историю общения с атлетом.",
    });

    if (history && history.length > 0) {
      for (const m of history) {
        // user / coach / system → превращаем в роли GPT
        const role =
          m.type === "coach"
            ? ("assistant" as const)
            : m.type === "system"
            ? ("system" as const)
            : ("user" as const);

        chatMessages.push({
          role,
          content: m.body ?? "",
        });
      }
    } else {
      // Если история пустая — подсказка
      chatMessages.push({
        role: "system" as const,
        content:
          "Это первое сообщение в чате. Сначала узнай цели пользователя и текущий уровень, " +
          "а потом давай рекомендации по тренировкам.",
      });
    }

    // ---- Вызов OpenAI ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: chatMessages,
      temperature: 0.5,
      max_tokens: 800,
    });

    const answer =
      completion.choices[0]?.message?.content?.toString() ??
      "Я получил твоё сообщение, но не смог сформировать ответ. Попробуй переформулировать вопрос.";

    // ---- Сохраняем ответ тренера в coach_messages ----
    const { data: coachMessageRow, error: coachMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id, // пока считаем, что «системный» тренер привязан к тому же юзеру
        type: "coach",
        body: answer,
        meta: {
          model: "gpt-4.1-mini",
        },
      })
      .select("*")
      .single();

    if (coachMsgErr || !coachMessageRow) {
      console.error("coach/send: insert coach message error", coachMsgErr);
      return NextResponse.json(
        {
          error: "coach_message_insert_failed",
          detail: coachMsgErr?.message ?? null,
          code: coachMsgErr?.code ?? null,
        },
        { status: 500 },
      );
    }

    // ---- Успешный ответ для фронта ----
    return NextResponse.json({
      threadId,
      userMessage: userMessageRow,
      coachMessage: coachMessageRow,
    });
  } catch (e: any) {
    console.error("coach/send: unexpected error", e);
    return NextResponse.json(
      {
        error: "unexpected_error",
        detail: e?.message ?? String(e),
      },
      { status: 500 },
    );
  }
}