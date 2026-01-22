// app/(protected)/coach/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import CoachChat from "@/components/coach/CoachChat.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CoachHomeState = {
  readiness_score?: number | null;
  form_score?: number | null;
  adherence_score?: number | null;
  trend?: string | null;
  risk_level?: string | null;
  recommendation?: string | null;
  next_actions?: Array<{ type?: string; title?: string; details?: string }> | null;
  signals?: any;
};

type CoachHomeSnapshot = {
  id?: string;
  scope?: string | null;
  goal_id?: string | null;
  reason?: string | null;
  status?: string | null;
  as_of?: string | null;
};

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

  // 0) Coach Home (state + snapshot meta)
  const { data: coachHome, error: coachHomeErr } = await supabase.rpc("get_coach_home", {
    p_scope: "global",
    p_goal_id: null,
    p_include_snapshot_payload: false,
  });

  if (coachHomeErr) {
    console.error("get_coach_home rpc error", coachHomeErr);
  }

  const state = (coachHome?.state ?? null) as CoachHomeState | null;
  const snapshot = (coachHome?.snapshot ?? null) as CoachHomeSnapshot | null;

  // 1) Ищем/создаём основной тред "Мой тренер"
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

  // 2) Подтягиваем последние сообщения по этому треду
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

      {/* Coach Home summary */}
      <section className="rounded-xl border bg-background p-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Сводка</div>
            <div className="text-xs text-muted-foreground">
              {snapshot?.as_of ? `Обновлено: ${new Date(snapshot.as_of).toLocaleString()}` : "Обновление: —"}
            </div>
          </div>

          {coachHomeErr ? (
            <div className="mt-2 text-sm text-destructive">
              Не удалось загрузить сводку тренера. Проверь логи сервера.
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Readiness</div>
                  <div className="text-xl font-bold">{state?.readiness_score ?? "—"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Form</div>
                  <div className="text-xl font-bold">{state?.form_score ?? "—"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Adherence</div>
                  <div className="text-xl font-bold">{state?.adherence_score ?? "—"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Risk</div>
                  <div className="text-xl font-bold">{state?.risk_level ?? "—"}</div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Рекомендация</div>
                <div className="mt-1 text-sm">{state?.recommendation ?? "—"}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Следующие действия</div>
                <div className="mt-2 space-y-2">
                  {(state?.next_actions ?? []).length ? (
                    (state?.next_actions ?? []).map((a, idx) => (
                      <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{a.title ?? "Без названия"}</div>
                          <div className="text-xs text-muted-foreground">{a.type ?? ""}</div>
                        </div>
                        {a.details ? <div className="mt-1 text-sm text-muted-foreground">{a.details}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Пока нет рекомендаций по действиям.</div>
                  )}
                </div>
              </div>

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Диагностика (state/snapshot)
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify({ state, snapshot }, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </section>

      <CoachChat threadId={thread.id} initialMessages={messages ?? []} currentUserId={user.id} />
    </main>
  );
}