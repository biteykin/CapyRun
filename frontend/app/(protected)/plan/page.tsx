import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PlansCalendarHost from "@/components/plans/PlansCalendarHost.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// маппинг статусов → цвет из UI-токенов
const STATUS_DEFAULT_COLOR = {
  planned:  "#0C5BF9", // data-color-11
  completed: "#2D7601", // bg-success
  missed:   "#EB3646", // data-color-5
  moved:    "#D8DAD5", // bg-border-light, например
  canceled: "#F6B021", // bg-yellow
} as const;

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

  // select без color_hex
  const { data: sessions } = await supabase
    .from("user_plan_sessions")
    .select("id, planned_date, title, status")
    .eq("user_id", user.id)
    .order("planned_date", { ascending: true });

  // события для календаря
  const events =
    sessions?.map((s) => ({
      id: s.id,
      date: s.planned_date,
      title: s.title ?? "Тренировка",
      status: s.status as keyof typeof STATUS_DEFAULT_COLOR,
      colorHex: STATUS_DEFAULT_COLOR[s.status as keyof typeof STATUS_DEFAULT_COLOR],
    })) ?? [];

  const initialMonthISO = new Date().toISOString();

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">План тренировок</h1>
      <PlansCalendarHost events={events} initialMonthISO={initialMonthISO} />
    </main>
  );
}