//frontend/app/(protected)/home/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import MyWorkoutsDashboardClient from "@/components/workouts/MyWorkoutsDashboard.client";

export default async function ProtectedHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent("/")}`);
    }
    redirect("/login");
  }

  // Имя для приветствия — только display_name из профиля (без e-mail / метаданных)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const userName =
    profile?.display_name?.trim()?.length
      ? profile.display_name.trim()
      : null;

  return (
    <main className="w-full space-y-5">
      <MyWorkoutsDashboardClient daysDefault={30} userName={userName} />
    </main>
  );
}