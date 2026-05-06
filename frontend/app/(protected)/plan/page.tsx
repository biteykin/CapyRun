// app/(protected)/plan/page.tsx
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PlansCalendarHost from "@/components/plans/PlansCalendarHost.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActiveGoal = {
  id: string;
  title: string | null;
  type: string | null;
  sport: string | null;
  date_to: string | null;
} | null;

type PlanCalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "goal" | "planned" | "workout";
  sport: string | null;
  status: string | null;
  source: "goal" | "plan" | "workout";
  [key: string]: unknown;
};

async function apiUrl(path: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}${path}`;
}

async function apiGet<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const res = await fetch(await apiUrl(path), {
    method: "GET",
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

export default async function PlansPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/plan`)}`
      );
    }
    redirect("/login");
  }

  const calendar = await apiGet<{
    events?: PlanCalendarEvent[];
    activeGoal?: ActiveGoal;
    initialMonthISO?: string;
  }>("/api/plan/calendar");

  const today = new Date();
  const initialMonthISO =
    calendar?.initialMonthISO ??
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  return (
    <main className="w-full space-y-5">
      <PlansCalendarHost
        events={calendar?.events ?? []}
        initialMonthISO={initialMonthISO}
        activeGoal={calendar?.activeGoal ?? null}
      />
    </main>
  );
}