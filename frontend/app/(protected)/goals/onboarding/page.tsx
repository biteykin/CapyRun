// app/(protected)/goals/onboarding/page.tsx

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import GoalsOnboardingFlow from "@/components/goals/GoalsOnboardingFlow.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function apiGet(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}${path}`, {
    cache: "no-store",
    headers: { cookie: h.get("cookie") ?? "" },
  });
  if (res.status === 401) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent(`/goals/onboarding`)}`);
    redirect("/login");
  }
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return res.json();
}

export default async function GoalsOnboardingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const goalId =
    typeof searchParams?.id === "string" ? searchParams.id : null;
  const qs = goalId ? `?id=${encodeURIComponent(goalId)}` : "";
  const { initialProfile, editGoal } = await apiGet(`/api/goals/onboarding-data${qs}`);

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