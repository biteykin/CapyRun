// app/(protected)/plan/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PlansCalendarHost from "@/components/plans/PlansCalendarHost.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanSessionStatus =
  | "planned"
  | "completed"
  | "missed"
  | "canceled"
  | "moved";

export default async function PlansPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/plan`)}`
      );
    }
    redirect("/login");
  }

  const today = new Date();

  // Берём довольно широкий диапазон, чтобы захватить и старые, и будущие тренировки
  const from = new Date(today);
  from.setDate(from.getDate() - 180);
  const to = new Date(today);
  to.setDate(to.getDate() + 180);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // 1) Плановые сессии
  const { data: planSessions } = await supabase
    .from("user_plan_sessions")
    .select("id, planned_date, title, status, link_workout_id")
    .eq("user_id", user.id)
    .gte("planned_date", fromStr)
    .lte("planned_date", toStr);

  // 2) Фактические тренировки
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, local_date, name")
    .eq("user_id", user.id)
    .gte("local_date", fromStr)
    .lte("local_date", toStr);

  type CalendarEvent = {
    id: string;
    date: string; // YYYY-MM-DD
    title: string;
    colorHex?: string;
  };

  const events: CalendarEvent[] = [];

  // Цвета: берём из тех, что уже договорились в Colors
  const COLOR_DONE = "#2D7601";   // bg-success
  const COLOR_MISSED = "#F6B021"; // bg-yellow
  const COLOR_PLANNED = "#0C5BF9"; // data-color-11

  // 1) Мапим плановые сессии
  if (planSessions) {
    for (const s of planSessions as any[]) {
      if (!s.planned_date) continue;

      let color: string;

      switch (s.status as PlanSessionStatus | null) {
        case "completed":
          color = COLOR_DONE;
          break;
        case "missed":
        case "canceled":
          color = COLOR_MISSED;
          break;
        case "moved":
        case "planned":
        default:
          color = COLOR_PLANNED;
      }

      events.push({
        id: `plan-${s.id}`,
        date: s.planned_date as string,
        title: s.title || "Плановая тренировка",
        colorHex: color,
      });
    }
  }

  // 2) Мапим фактические тренировки (отдельными событиями)
  if (workouts) {
    for (const w of workouts as any[]) {
      const d = w.local_date as string | null;
      if (!d) continue;

      events.push({
        id: `w-${w.id}`,
        date: d,
        title: w.name || "Тренировка",
        // считаем, что факт = выполнено
        colorHex: COLOR_DONE,
      });
    }
  }

  const initialMonthISO = today.toISOString();

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">План тренировок</h1>
      <PlansCalendarHost events={events} initialMonthISO={initialMonthISO} />
    </main>
  );
}