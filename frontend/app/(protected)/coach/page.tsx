// frontend/app/(protected)/coach/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

import CoachChat from "@/components/coach/CoachChat.client";
import CoachHome from "@/components/coach/CoachHome.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // A) Coach Home (состояние)
  const { data: coachHome, error: coachHomeErr } = await supabase.rpc("get_coach_home", {
    p_scope: "global",
    p_goal_id: null,
    p_include_snapshot_payload: false,
  });

  // (не валим страницу — просто покажем "пусто", но ошибку залогируем)
  if (coachHomeErr) {
    console.error("get_coach_home rpc error", coachHomeErr);
  }

  // B) Ищем/создаём основной тред "Мой тренер"
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

  // C) Подтягиваем последние сообщения по треду
  const { data: messages, error: msgErr } = await supabase
    .from("coach_messages")
    .select("id, thread_id, author_id, type, body, meta, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (msgErr) {
    console.error("coach_messages select error", msgErr);
  }

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">Тренер</h1>
      <p className="text-sm text-muted-foreground">
        Здесь можно задавать вопросы тренеру, получать комментарии по тренировкам и рекомендации по плану.
      </p>

      {/* Coach Home */}
      <CoachHome
        data={coachHome ?? null}
        error={coachHomeErr ? String((coachHomeErr as any).message ?? coachHomeErr) : null}
      />

      {/* Chat */}
      {/* 
        Делаем фиксированную область (и flex-контекст), чтобы чат НЕ вылезал по высоте.
        Внутри CoachChat должен быть контейнер со скроллом (обычно messages-list: overflow-y-auto; min-h-0).
      */}
      <section className="flex min-h-0 flex-col">
        <div className="h-[520px] max-h-[70vh] min-h-0 flex flex-col">
          <CoachChat threadId={thread.id} initialMessages={messages ?? []} currentUserId={user.id} />
        </div>
      </section>
    </main>
  );
}