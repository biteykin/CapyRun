// frontend/app/(onboarding)/onboarding/finalizing/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingFinalizingClient from "@/components/onboarding/OnboardingFinalizing.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function OnboardingFinalizingPage() {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const baseUrl = await getBaseUrl();

  const res = await fetch(`${baseUrl}/api/onboarding/state`, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/login");
  if (!res.ok) redirect("/login");

  const json = await res.json();
  const profile = json.profile;

  // Должен быть только что закончен онбординг.
  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  // Защита от прямого перехода после того как анимация уже была показана.
  const completedMs = new Date(profile.onboarding_completed_at).getTime();
  const ageMs = Date.now() - completedMs;
  if (ageMs > 10 * 60 * 1000) {
    redirect("/coach");
  }

  return <OnboardingFinalizingClient />;
}
