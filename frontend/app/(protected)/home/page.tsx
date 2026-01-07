export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import MyWorkoutsDashboardClient from "@/components/workouts/MyWorkoutsDashboard.client"; // Это дашборд с данными по тренировкам

export default async function ProtectedHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // если нет текущего юзера — проверим легаси-куку и уйдём в апгрейд
  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent("/")}`);
    }
    redirect("/login"); // или твой путь логина
  }

  return (
    <main className="space-y-6 p-6">
      <MyWorkoutsDashboardClient daysDefault={30} />
    </main>
  );
}