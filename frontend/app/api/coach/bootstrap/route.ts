//frontend/app/api/coach/bootstrap/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

const PAGE_SIZE = 30;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threadRes = await supabase
    .from("coach_threads")
    .select("*")
    .eq("user_id", user.id)
    .eq("scope", "general")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let thread = threadRes.data;
  const threadErr = threadRes.error;

  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });

  if (!thread) {
    const { data: inserted, error: insertErr } = await supabase
      .from("coach_threads")
      .insert({
        user_id: user.id,
        subject: "Мой тренер",
        scope: "general",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    thread = inserted;
  }

  const { data: messagesDesc, error: msgErr } = await supabase
    .from("coach_messages")
    .select("id, thread_id, author_id, type, body, meta, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const { data: unreadCount, error: unreadErr } = await supabase.rpc(
    "get_thread_unread_count",
    {
      p_thread_id: thread.id,
    }
  );

  if (unreadErr) return NextResponse.json({ error: unreadErr.message }, { status: 500 });

  return NextResponse.json({
    user: { id: user.id },
    thread,
    messages: (messagesDesc ?? []).slice(0, PAGE_SIZE).reverse(),
    hasMoreMessages: (messagesDesc ?? []).length > PAGE_SIZE,
    unreadCount: Number(unreadCount ?? 0),
  });
}

