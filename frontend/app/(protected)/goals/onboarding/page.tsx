// app/(protected)/goals/onboarding/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import GoalsOnboardingFlow from "@/components/goals/GoalsOnboardingFlow.client";
import { differenceInYears } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsOnboardingPage({
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
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/goals/onboarding`)}`
      );
    }
    redirect("/login");
  }

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("sex, birth_date, height_cm, weight_kg")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    console.error("goals onboarding profile fetch error", profErr);
  }

  const initialProfile = {
    sex: prof?.sex ?? null,
    age:
      prof?.birth_date
        ? differenceInYears(new Date(), new Date(prof.birth_date))
        : null,
    birth_date: prof?.birth_date ?? null,
    height_cm: prof?.height_cm != null ? Number(prof.height_cm) : null,
    weight_kg: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
  };

  const goalId =
    typeof searchParams?.id === "string" ? searchParams.id : null;

  const { data: editGoal, error: editGoalErr } = goalId
    ? await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", goalId)
        .maybeSingle()
    : { data: null, error: null };

  if (editGoalErr) {
    console.error("goal edit fetch error", editGoalErr);
  }

  return (
    <main className="w-full space-y-6">
      <section className="w-full">
        <GoalsOnboardingFlow
          initialProfile={initialProfile}
          editGoal={editGoal ?? null}
        />
      </section>
    </main>
  );
}