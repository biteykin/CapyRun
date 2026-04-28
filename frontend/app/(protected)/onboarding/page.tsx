//frontend/app/(protected)/onboarding/page.tsx

import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { redirect } from "next/navigation";
import GoalsOnboardingFlow from "@/components/goals/GoalsOnboardingFlow.client";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding, onboarding_completed_at")
    .eq("user_id", user.id)
    .single();

  const onboarding = profile?.onboarding ?? {};

  // если уже прошёл — не пускаем
  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  // если цель не задана → шаг цели
  if (!onboarding.goal_done) {
    return (
      <GoalsOnboardingFlow mode="onboarding" />
    );
  }

  // иначе следующий шаг
  redirect("/onboarding/import");
}