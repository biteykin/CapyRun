//frontend/app/(protected)/onboarding/page.tsx

import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { redirect } from "next/navigation";
import GoalsOnboardingFlow from "@/components/goals/GoalsOnboardingFlow.client";
import OnboardingProfileStep from "@/components/onboarding/OnboardingProfileStep.client";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, onboarding, onboarding_completed_at, sex, birth_date, height_cm, weight_kg, hr_rest, hr_max, display_name, avatar_url, country_code, city")
    .eq("user_id", user.id)
    .single();

  const onboarding = profile?.onboarding ?? {};
  const requestedStep =
    typeof searchParams?.step === "string" ? searchParams.step : null;
  const stepParam =
    typeof searchParams?.step === "string"
      ? Number(searchParams.step)
      : null;
  const initialStep =
    stepParam === 1 || stepParam === 2 ? (stepParam as 1 | 2) : 1;
  const initialProfile = {
    user_id: user.id,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    sex: profile?.sex ?? null,
    birth_date: profile?.birth_date ?? null,
    height_cm: profile?.height_cm != null ? Number(profile.height_cm) : null,
    weight_kg: profile?.weight_kg != null ? Number(profile.weight_kg) : null,
    hr_rest: profile?.hr_rest ?? null,
    hr_max: profile?.hr_max ?? null,
    country_code: profile?.country_code ?? null,
    city: profile?.city ?? null,
  };

  // если уже прошёл — не пускаем
  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  if (requestedStep === "profile" || !onboarding.profile_done) {
    return (
      <OnboardingProfileStep
        initial={initialProfile}
        email={user.email ?? null}
      />
    );
  }

  // если цель не задана → шаг цели
  if (!onboarding.goal_done) {
    return (
      <GoalsOnboardingFlow
        mode="onboarding"
        initialProfile={initialProfile}
        initialStep={initialStep}
      />
    );
  }

  // иначе следующий шаг
  redirect("/onboarding/import");
}