// app/api/coach/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // --- 1. Читаем тело запроса максимально мягко ---
    let body: any = null;
    try {
      body = await req.json();
    } catch (e) {
      console.warn("coach_send: json_parse_failed", e);
      body = {};
    }

    // допускаем разные формы: {text}, {message}, {content}
    const rawText =
      (body?.text ??
        body?.message ??
        body?.content ??
        "") as string | undefined;

    const text = (rawText ?? "").toString().trim();

    // даже если текст пустой — НЕ возвращаем 400, а подставим дефолт
    const finalText =
      text ||
      "Пользователь не задал конкретный вопрос, но хочет получить рекомендации по тренировкам.";

    const reqThreadId = (body?.threadId ?? null) as string | null;

    // --- 2. Проверка пользователя через Supabase ---
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.error("coach_send: auth error", userErr);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // --- 3. Находим / создаём тред с тренером ---
    let threadId: string | null = reqThreadId;

    if (threadId) {
      const { data: threadRow, error: tErr } = await supabase
        .from("coach_threads")
        .select("id, user_id")
        .eq("id", threadId)
        .maybeSingle();

      if (tErr) {
        console.error("coach_send: thread_lookup_error", tErr);
        // продолжаем как будто треда нет
        threadId = null;
      } else if (!threadRow || threadRow.user_id !== user.id) {
        // чужой или не найден
        threadId = null;
      }
    }

    if (!threadId) {
      // пробуем найти существующий general-тред
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
        // но не ломаемся — просто попробуем создать новый
      }

      if (existing) {
        threadId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("coach_threads")
          .insert({
            user_id: user.id,
            subject: "Мой тренер",
            scope: "general", // <= важно: enum в БД должен содержать general
            created_by: user.id,
          })
          .select("id")
          .single();

        if (createErr || !created) {
          console.error("coach_send: thread_create_error", createErr);
          return NextResponse.json(
            { error: "thread_create_failed" },
            { status: 500 },
          );
        }

        threadId = created.id;
      }
    }

    if (!threadId) {
      return NextResponse.json(
        { error: "thread_resolve_failed" },
        { status: 500 },
      );
    }

    // --- 4. Сохраняем сообщение пользователя в coach_messages ---
    const { data: userMsgRow, error: userMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id,
        type: "user", // coach_msg_type enum
        body: finalText,
        meta: null,
      })
      .select("*")
      .single();

    if (userMsgErr || !userMsgRow) {
      console.error("coach_send: user_message_insert_error", userMsgErr);
      return NextResponse.json(
        { error: "user_message_insert_failed" },
        { status: 500 },
      );
    }

    // --- 5. История для контекста (последние 30 сообщений этого треда) ---
    const { data: history, error: histErr } = await supabase
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (histErr) {
      console.error("coach_send: history_error", histErr);
    }

    const messages: any[] = [];

    messages.push({
      role: "system",
      content:
        "Ты персональный беговой и фитнес-тренер. " +
        "Отвечай по-русски, коротко и по делу, без воды. " +
        "Ориентируйся на любителя, учитывай усталость, занятость и здоровье, " +
        "если пользователь это упоминает. Если нужно — задавай уточняющие вопросы.",
    });

    for (const m of history ?? []) {
      if (m.type === "user") {
        messages.push({ role: "user", content: m.body });
      } else if (m.type === "coach") {
        messages.push({ role: "assistant", content: m.body });
      } else if (m.type === "system" || m.type === "note") {
        messages.push({ role: "system", content: m.body });
      }
    }

    // страховка: если история пустая — всё равно кладём последний вопрос
    if (!history || history.length === 0) {
      messages.push({ role: "user", content: finalText });
    }

    // --- 6. Вызов OpenAI ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.4,
      max_tokens: 700,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "Извини, сейчас не получилось сформировать ответ. Попробуй ещё раз.";

    // --- 7. Сохраняем ответ «тренера» ---
    const { data: coachMsgRow, error: coachMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id, // пока нет отдельного coach-пользователя
        type: "coach",
        body: answer,
        meta: null,
      })
      .select("*")
      .single();

    if (coachMsgErr || !coachMsgRow) {
      console.error("coach_send: coach_message_insert_error", coachMsgErr);

      // Даже если не сохранили — всё равно отдаём ответ на фронт
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
            meta: null,
            created_at: new Date().toISOString(),
          },
        },
        { status: 500 },
      );
    }

    // --- 8. Отдаём в формате, который ждёт CoachChat.client.tsx ---
    return NextResponse.json(
      {
        threadId,
        userMessage: userMsgRow,
        coachMessage: coachMsgRow,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("coach_send: unexpected_error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}