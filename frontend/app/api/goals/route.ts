import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

type GoalRow = Record<string, any>;

function getGoalCompletionPct(goal: GoalRow): number | null {
  const cache = goal?.progress_cache ?? {};
  const rawPct =
    cache.completion_pct ??
    cache.progress_pct ??
    cache.progress ??
    null;

  if (typeof rawPct === "number" && Number.isFinite(rawPct)) {
    return Math.max(0, Math.min(100, rawPct));
  }

  if (goal.date_from && goal.date_to) {
    const start = new Date(goal.date_from).getTime();
    const end = new Date(goal.date_to).getTime();
    const now = Date.now();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
    }
  }

  return null;
}

async function ensureCoachThread(params: {
  supabase: Awaited<ReturnType<typeof createClientWithCookies>>;
  userId: string;
}) {
  const { supabase, userId } = params;

  let { data: thread } = await supabase
    .from("coach_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("scope", "general")
    .limit(1)
    .maybeSingle();

  if (!thread?.id) {
    const { data: insertedThread } = await supabase
      .from("coach_threads")
      .insert({
        user_id: userId,
        subject: "Мой тренер",
        scope: "general",
        created_by: userId,
      })
      .select("id")
      .single();

    thread = insertedThread;
  }

  return thread?.id ? String(thread.id) : null;
}

async function autoCompleteGoals(params: {
  supabase: Awaited<ReturnType<typeof createClientWithCookies>>;
  userId: string;
  goals: GoalRow[];
}) {
  const { supabase, userId, goals } = params;
  const completedNowIds: string[] = [];

  for (const goal of goals) {
    const pct = getGoalCompletionPct(goal);

    if (goal.status !== "active" || typeof pct !== "number" || pct < 100) {
      continue;
    }

    const now = new Date().toISOString();

    await supabase
      .from("goals")
      .update({
        status: "completed",
        is_primary: false,
        progress_cache: {
          ...(goal.progress_cache || {}),
          completion_pct: 100,
        },
        updated_at: now,
      })
      .eq("id", goal.id)
      .eq("user_id", userId);

    const { data: remaining } = await supabase
      .from("goals")
      .select("id, date_to")
      .eq("user_id", userId)
      .eq("status", "active");

    if (remaining?.length) {
      const next = [...remaining].sort(
        (a, b) => new Date(a.date_to).getTime() - new Date(b.date_to).getTime()
      )[0];

      if (next?.id) {
        await supabase
          .from("goals")
          .update({ is_primary: true, updated_at: now })
          .eq("id", next.id)
          .eq("user_id", userId);
      }
    }

    completedNowIds.push(goal.id);

    const alreadySent = goal?.progress_cache?.coach_notified === true;
    if (alreadySent) continue;

    const threadId = await ensureCoachThread({ supabase, userId });
    if (!threadId) continue;

    const title = goal.title || "цель";

    await supabase.from("coach_messages").insert({
      thread_id: threadId,
      author_id: userId,
      type: "coach",
      body:
        `🎉 Поздравляю! Цель «${title}» завершена.\n\n` +
        `Это был важный этап: вы дошли до результата, сохранили фокус и закрыли цель на 100%.\n\n` +
        `Дальше можно спокойно подвести итоги, посмотреть, что сработало лучше всего, и поставить новую цель на следующий цикл.`,
      meta: {
        system: true,
        event: "goal_completed",
        goal_id: goal.id,
      },
    });

    await supabase
      .from("goals")
      .update({
        progress_cache: {
          ...(goal.progress_cache || {}),
          completion_pct: 100,
          coach_notified: true,
        },
        updated_at: now,
      })
      .eq("id", goal.id)
      .eq("user_id", userId);
  }

  return completedNowIds;
}

export async function GET() {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: goalsRaw, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const completedNowIds = await autoCompleteGoals({
      supabase,
      userId: user.id,
      goals: goalsRaw ?? [],
    });

    const { data: goals, error: afterError } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 });
    }

    return NextResponse.json({
      goals: goals ?? [],
      completedNowIds,
      goalCompleted: completedNowIds.length > 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const goal = body?.goal ?? body;

    const payload = {
      user_id: user.id,
      title: String(goal?.title ?? "").trim(),
      type: goal?.type ?? "custom",
      sport: goal?.sport ?? null,
      date_from: goal?.date_from ?? new Date().toISOString().slice(0, 10),
      date_to: goal?.date_to ?? null,
      status: goal?.status ?? "active",
      target_json: goal?.target_json ?? {},
      notes: goal?.notes ?? null,
      is_primary: Boolean(goal?.is_primary),
      updated_at: new Date().toISOString(),
    };

    if (!payload.title) {
      return NextResponse.json({ error: "Goal title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
