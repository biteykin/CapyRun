import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import GoalsListWithAdd from "@/components/goals/GoalsListWithAdd.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getGoalsViaApi() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";

  if (!host) {
    return {
      status: 401,
      json: null,
    };
  }

  const res = await fetch(`${proto}://${host}/api/goals`, {
    cache: "no-store",
    headers: { cookie },
  });

  const json = await res.json().catch(() => null);

  return {
    status: res.status,
    json,
  };
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const result = await getGoalsViaApi();

  if (result.status === 401) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent(`/goals`)}`);
    }
    redirect("/login");
  }

  if (result.status >= 400) {
    console.error("goals api fetch error", result.json);
  }

  const goals = result.json?.goals ?? [];
  const goalCompleted = Boolean(result.json?.goalCompleted);

  return (
    <main className="w-full space-y-6">
      <section className="w-full">
        <GoalsListWithAdd
          goals={goals}
          created={searchParams?.created === "1"}
          updated={searchParams?.updated === "1"}
          goalCompleted={goalCompleted}
        />
      </section>
    </main>
  );
}