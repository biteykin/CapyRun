// app/(protected)/goals/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import GoalsListWithAdd from "@/components/goals/GoalsListWithAdd.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/goals`)}`
      );
    }
    redirect("/login");
  }

  const { data: goalsRaw, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("goals fetch error", error);
  }

  // --- АВТОЗАВЕРШЕНИЕ ЦЕЛЕЙ ---
  const completedNowIds: string[] = [];

  if (goalsRaw?.length) {
    for (const g of goalsRaw) {
      const cache = g?.progress_cache ?? {};
      const rawPct =
        cache.completion_pct ??
        cache.progress_pct ??
        cache.progress ??
        null;

      let pct = typeof rawPct === "number" ? rawPct : null;

      if (pct == null && g.date_from && g.date_to) {
        const start = new Date(g.date_from).getTime();
        const end = new Date(g.date_to).getTime();
        const now = Date.now();

        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
        }
      }

      if (g.status === "active" && typeof pct === "number" && pct >= 100) {
        await supabase
          .from("goals")
          .update({
            status: "completed",
            is_primary: false,
            progress_cache: {
              ...(g.progress_cache || {}),
              completion_pct: 100,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", g.id);

        // --- НАЗНАЧАЕМ НОВУЮ ГЛАВНУЮ ---
        const { data: remaining } = await supabase
          .from("goals")
          .select("id, date_to")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (remaining?.length) {
          const next = [...remaining].sort(
            (a, b) => new Date(a.date_to).getTime() - new Date(b.date_to).getTime()
          )[0];

          if (next?.id) {
            await supabase
              .from("goals")
              .update({ is_primary: true })
              .eq("id", next.id);
          }
        }

        completedNowIds.push(g.id);

        const alreadySent = g?.progress_cache?.coach_notified === true;

        if (!alreadySent) {
          let { data: thread } = await supabase
            .from("coach_threads")
            .select("id")
            .eq("user_id", user.id)
            .eq("scope", "general")
            .limit(1)
            .maybeSingle();

          if (!thread?.id) {
            const { data: insertedThread } = await supabase
              .from("coach_threads")
              .insert({
                user_id: user.id,
                subject: "Мой тренер",
                scope: "general",
                created_by: user.id,
              })
              .select("id")
              .single();

            thread = insertedThread;
          }

          if (thread?.id) {
            const title = g.title || "цель";

            await supabase.from("coach_messages").insert({
              thread_id: thread.id,
              author_id: user.id,
              type: "coach",
              body: `🎉 Поздравляю! Цель «${title}» завершена.\n\nЭто был важный этап: вы дошли до результата, сохранили фокус и закрыли цель на 100%.\n\nДальше можно спокойно подвести итоги, посмотреть, что сработало лучше всего, и поставить новую цель на следующий цикл.`,
              meta: {
                system: true,
                event: "goal_completed",
                goal_id: g.id,
              },
            });

            await supabase
              .from("goals")
              .update({
                progress_cache: {
                  ...(g.progress_cache || {}),
                  completion_pct: 100,
                  coach_notified: true,
                },
              })
              .eq("id", g.id);
          }
        }
      }
    }
  }

  const { data: goalsAfterCompletion } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="w-full space-y-6">
      <section className="w-full">
        <GoalsListWithAdd
          goals={goalsAfterCompletion ?? goalsRaw ?? []}
          created={searchParams?.created === "1"}
          updated={searchParams?.updated === "1"}
          goalCompleted={completedNowIds.length > 0}
        />
      </section>
    </main>
  );
}