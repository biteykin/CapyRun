// app/(protected)/goals/onboarding/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import GoalsOnboardingFlow from "@/components/goals/GoalsOnboardingFlow.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsOnboardingPage() {
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

  return (
    <main className="w-full space-y-6">
      <section className="w-full">
        <GoalsOnboardingFlow />
      </section>
    </main>
  );
}