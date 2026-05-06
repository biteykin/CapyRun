//frontend/app/(protected)/layout.tsx

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Shell from "@/components/Shell";

async function apiUrl(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const res = await fetch(await apiUrl("/api/profile/onboarding-status"), {
    cache: "no-store",
    headers: { cookie: h.get("cookie") ?? "" },
  });

  if (res.status === 401) redirect("/login");
  if (!res.ok) redirect("/login");

  const json = await res.json();

  if (!json?.onboardingDone) {
    redirect("/onboarding");
  }

  return <Shell>{children}</Shell>;
}