// app/(protected)/workouts/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WorkoutsTable from "@/components/workouts/WorkoutsTable";
import WorkoutsEmptyState from "@/components/workouts/WorkoutsEmptyState";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

type WorkoutRow = {
  id: string;
  user_id: string;
  start_time: string;
  local_date: string | null;
  uploaded_at: string;
  sport: string | null;
  sub_sport: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  calories_kcal: number | null;
  name: string | null;
  visibility: string | null;
  weekday_iso: number | null;
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

// Парсим твою capyrun.auth (base64-JSON) и вытаскиваем токены
async function readLegacyTokensFromCapyCookie() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("capyrun.auth")?.value;
    if (!raw) return null;
    const b64 = raw.startsWith("base64-") ? raw.slice(7) : raw;
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const s =
      json?.currentSession ??
      json?.session ??
      json?.state?.session ??
      json;

    const access_token: string | undefined = s?.access_token;
    const refresh_token: string | undefined = s?.refresh_token;
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch {}
  return null;
}

export default async function WorkoutsPage() {
  const supabase = await createSupabaseServerClient();

  // 1) Пытаемся получить user из sb-кук
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2) Если пусто — «горячий» фоллбек: поднять сессию из capyrun.auth в рамках этого же запроса
  if (!user) {
    const legacy = await readLegacyTokensFromCapyCookie();
    if (legacy?.access_token && legacy?.refresh_token) {
      // НЕЛЬЗЯ сетить куки из Server Component — отправляемся в Route Handler
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent("/workouts")}`);
    }
  }

  const uid = user?.id ?? null;

  // 3) Если сервак всё ещё не видит юзера — показываем заглушку (после первого ответа браузер пошлёт sb-куки, и всё встанет)
  if (!uid) {
    const demo = await apiGet<{ demoWorkoutId: string | null }>("/api/workouts/demo");
    const demoWorkoutId = demo?.demoWorkoutId ?? null;

    return <WorkoutsEmptyState demoWorkoutId={demoWorkoutId} />;
  }

  const workoutsJson = await apiGet<{
    workouts?: WorkoutRow[];
    items?: WorkoutRow[];
    data?: WorkoutRow[];
  }>("/api/workouts?limit=1000");

  const rows =
    workoutsJson?.workouts ??
    workoutsJson?.items ??
    workoutsJson?.data ??
    [];

  const workoutsCount = rows.length;

  // 5) 0 → заглушка с демо
  if (workoutsCount === 0) {
    const demo = await apiGet<{ demoWorkoutId: string | null }>("/api/workouts/demo");
    const demoWorkoutId = demo?.demoWorkoutId ?? null;

    return <WorkoutsEmptyState demoWorkoutId={demoWorkoutId} />;
  }

  // читаем предпочитаемый размер страницы из cookie (5..50, по умолчанию 10)
  const cookieStore = await cookies();
  const pageSizeRaw = cookieStore.get("wt_page_size")?.value;
  const initialPageSize = (() => {
    const n = parseInt(pageSizeRaw || "", 10);
    if (Number.isFinite(n)) return Math.min(50, Math.max(5, n));
    return 10;
  })();

  return (
    <main>
      <WorkoutsTable
        initialRows={rows}
        showEmptyState={false}
        initialPageSize={initialPageSize}
      />
    </main>
  );
}