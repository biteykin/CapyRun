//frontend/app/(protected)/coach/page.tsx

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

import CoachChat from "@/components/coach/CoachChat.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COACH_MESSAGES_PAGE_SIZE = 30;

export default async function CoachPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent(`/coach`)}`);
    }
    redirect("/login");
  }

  let { data: thread, error: threadErr } = await supabase
    .from("coach_threads")
    .select("*")
    .eq("user_id", user.id)
    .eq("scope", "general")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (threadErr) {
    console.error("coach_threads select error", threadErr);
  }

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

    if (insertErr) {
      console.error("coach_threads insert error", insertErr);
      throw new Error("Не удалось создать диалог с тренером");
    }

    thread = inserted;
  }

  const { data: messagesDesc, error: msgErr } = await supabase
    .from("coach_messages")
    .select("id, thread_id, author_id, type, body, meta, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(COACH_MESSAGES_PAGE_SIZE + 1);

  if (msgErr) {
    console.error("coach_messages select error", msgErr);
  }

  const hasMoreMessages = (messagesDesc ?? []).length > COACH_MESSAGES_PAGE_SIZE;
  const messages = (messagesDesc ?? [])
    .slice(0, COACH_MESSAGES_PAGE_SIZE)
    .reverse();

  const { data: unreadCount, error: unreadErr } = await supabase.rpc("get_thread_unread_count", {
    p_thread_id: thread.id,
  });

  if (unreadErr) {
    console.error("get_thread_unread_count rpc error", unreadErr);
  }

  return (
    <main className="flex h-[calc(100svh-4rem-2rem)] min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CoachChat
          threadId={thread.id}
          initialMessages={messages}
          initialHasMoreMessages={hasMoreMessages}
          currentUserId={user.id}
          initialUnreadCount={Number(unreadCount ?? 0)}
        />
      </section>
    </main>
  );
}