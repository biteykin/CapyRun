// frontend/app/api/coach/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

type WorkoutRow = {
  id: string;
  sport: string | null;
  start_time: string | null;
  distance_m: number | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

function safeNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtKm(distance_m: number | null): string | null {
  const m = safeNum(distance_m);
  if (!m || m <= 0) return null;
  const km = m / 1000;
  // 1 знак, но если почти целое — показываем целое
  const r1 = Math.round(km * 10) / 10;
  const isInt = Math.abs(r1 - Math.round(km)) < 0.05;
  return isInt ? `${Math.round(km)} км` : `${r1.toFixed(1)} км`;
}

function fmtMin(sec: number | null): string | null {
  const s = safeNum(sec);
  if (!s || s <= 0) return null;
  const mm = Math.floor(s / 60);
  const ss = Math.round(s - mm * 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function isoOrNull(s: any): string | null {
  const v = typeof s === "string" ? s : null;
  return v && v.length >= 10 ? v : null;
}

// компактный контекст тренировки, чтобы модель не фантазировала
function buildWorkoutsContext(workouts: WorkoutRow[]) {
  if (!workouts.length) {
    return {
      text:
        "Тренировки за последние 14 дней: данных нет (или нет start_time в этих тренировках).",
      usedIds: [],
    };
  }

  const lines: string[] = [];
  for (const w of workouts) {
    const dateIso = isoOrNull(w.start_time);
    const day = dateIso ? dateIso.slice(0, 10) : "дата неизвестна";
    const sport = (w.sport || "other").toLowerCase();

    const dist = fmtKm(w.distance_m);
    const dur = fmtMin(w.duration_sec);
    const mov = fmtMin(w.moving_time_sec);

    const avgHr = safeNum(w.avg_hr);
    const maxHr = safeNum(w.max_hr);

    lines.push(
      [
        `- ${day} • ${sport}`,
        dist ? `• дистанция: ${dist}` : `• дистанция: нет данных`,
        dur ? `• время: ${dur}` : `• время: нет данных`,
        mov ? `• moving: ${mov}` : `• moving: нет данных`,
        avgHr ? `• avgHR: ${Math.round(avgHr)}` : `• avgHR: нет данных`,
        maxHr ? `• maxHR: ${Math.round(maxHr)}` : `• maxHR: нет данных`,
        `• workout_id: ${w.id}`,
      ].join(" ")
    );
  }

  return {
    text:
      "Тренировки за последние 14 дней (используй ТОЛЬКО эти данные, ничего не выдумывай):\n" +
      lines.join("\n"),
    usedIds: workouts.map((w) => w.id),
  };
}

export async function POST(req: NextRequest) {
  try {
    // --- 1) Читаем тело запроса максимально мягко ---
    let body: any = null;
    try {
      body = await req.json();
    } catch (e) {
      console.warn("coach_send: json_parse_failed", e);
      body = {};
    }

    // допускаем разные формы: {text}, {message}, {content}
    const rawText =
      (body?.text ?? body?.message ?? body?.content ?? "") as string | undefined;

    const text = (rawText ?? "").toString().trim();

    // даже если текст пустой — НЕ возвращаем 400, а подставим дефолт
    const finalText =
      text ||
      "Пользователь не задал конкретный вопрос, но хочет получить рекомендации по тренировкам.";

    const reqThreadId = (body?.threadId ?? null) as string | null;

    // --- 2) Проверка пользователя через Supabase ---
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.error("coach_send: auth error", userErr);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // --- 3) Находим / создаём тред с тренером ---
    let threadId: string | null = reqThreadId;

    if (threadId) {
      const { data: threadRow, error: tErr } = await supabase
        .from("coach_threads")
        .select("id, user_id")
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
          })
          .select("id")
          .single();

        if (createErr || !created) {
          console.error("coach_send: thread_create_error", createErr);
          return NextResponse.json(
            { error: "thread_create_failed" },
            { status: 500 }
          );
        }

        threadId = created.id;
      }
    }

    if (!threadId) {
      return NextResponse.json(
        { error: "thread_resolve_failed" },
        { status: 500 }
      );
    }

    // --- 4) Сохраняем сообщение пользователя ---
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
      return NextResponse.json(
        { error: "user_message_insert_failed" },
        { status: 500 }
      );
    }

    // --- 5) История треда (последние 30 сообщений) ---
    const { data: history, error: histErr } = await supabase
      .from("coach_messages")
      .select("type, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (histErr) {
      console.error("coach_send: history_error", histErr);
    }

    // --- 5.1) Тренировки за 14 дней (контекст) ---
    // Берём только те поля, которые у тебя реально есть и уже используются.
    const { data: workouts14d, error: wErr } = await supabase
      .from("workouts")
      .select(
        "id, sport, start_time, distance_m, duration_sec, moving_time_sec, avg_hr, max_hr"
      )
      .eq("user_id", user.id)
      .not("start_time", "is", null)
      .gte("start_time", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
      .order("start_time", { ascending: false })
      .limit(12);

    if (wErr) {
      console.error("coach_send: workouts_context_error", wErr);
    }

    const workouts: WorkoutRow[] = (workouts14d ?? []) as any;
    const workoutsCtx = buildWorkoutsContext(workouts);

    // --- 6) Сообщения в OpenAI ---
    const messages: any[] = [];

    // Системные правила: дружелюбно, мотивирующе, но без фантазий.
    messages.push({
      role: "system",
      content:
        [
          "Ты персональный тренер для любителя (бег/ОФП). Пиши по-русски, дружелюбно и мотивирующе (как хороший тренер), но без воды.",
          "",
          "КРИТИЧЕСКОЕ ПРАВИЛО ПРО ДАННЫЕ:",
          "- Если тебя спрашивают про тренировки/цифры/даты — используй ТОЛЬКО данные из блока «Тренировки за последние 14 дней».",
          "- НИЧЕГО НЕ ВЫДУМЫВАЙ. Если поля нет (например калории/темп/пульсовые зоны) — так и скажи: «нет данных».",
          "- Если пользователь просит «последние N тренировок», бери N из этого блока (если их меньше — скажи сколько есть).",
          "",
          "СТИЛЬ:",
          "- Короткие абзацы, списки, понятные пояснения.",
          "- 1–2 предложения поддержки/подбадривания там, где уместно.",
          "- Если запрос про план на сегодня — предложи 1 вариант тренировки + как размяться/замяться + ориентиры по усилию (RPE/пульс если есть).",
          "",
          "ФОРМАТ ОТВЕТА (если вопрос про анализ тренировок):",
          "1) Короткий вывод (1–2 строки).",
          "2) Факты по тренировкам (список с датой и цифрами).",
          "3) Рекомендация на сегодня/ближайшие 2–3 дня (1 вариант).",
          "4) Уточняющий вопрос (1 шт.) если нужно для точности.",
        ].join("\n"),
    });

    // Добавляем контекст тренировок отдельным system сообщением
    messages.push({
      role: "system",
      content: workoutsCtx.text,
    });

    // История диалога
    for (const m of history ?? []) {
      if (m.type === "user") messages.push({ role: "user", content: m.body });
      else if (m.type === "coach") messages.push({ role: "assistant", content: m.body });
      else if (m.type === "system" || m.type === "note")
        messages.push({ role: "system", content: m.body });
    }

    // страховка: если история пустая — кладём вопрос
    if (!history || history.length === 0) {
      messages.push({ role: "user", content: finalText });
    }

    // --- 7) Вызов OpenAI ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.55,
      max_tokens: 900,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "Извини, сейчас не получилось сформировать ответ. Попробуй ещё раз.";

    // --- 8) Сохраняем ответ «тренера» + meta (для отладки: какие тренировки использовались) ---
    const coachMeta = {
      used_workout_ids: workoutsCtx.usedIds,
      workouts_window_days: 14,
      source: "api/coach/send",
      model: "gpt-4.1-mini",
    };

    const { data: coachMsgRow, error: coachMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: threadId,
        author_id: user.id, // пока нет отдельного coach-пользователя
        type: "coach",
        body: answer,
        meta: coachMeta,
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
            meta: coachMeta,
            created_at: new Date().toISOString(),
          } as RawMessage,
        },
        { status: 500 }
      );
    }

    // --- 9) Отдаём формат, который ждёт CoachChat.client.tsx ---
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