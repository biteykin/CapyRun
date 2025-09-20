// app/(protected)/workouts/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
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
  let {
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
    // Подтянем демо, если есть
    const DEMO_ID = "11111111-1111-4111-8111-111111111111";
    let demoWorkoutId: string | null = null;

    const { data: fixedDemo } = await supabase
      .from("workouts")
      .select("id")
      .eq("id", DEMO_ID)
      .in("visibility", ["public", "unlisted"])
      .limit(1);

    if (fixedDemo?.length) {
      demoWorkoutId = fixedDemo[0].id;
    } else {
      const { data: anyPublic } = await supabase
        .from("workouts")
        .select("id")
        .in("visibility", ["public", "unlisted"])
        .order("created_at", { ascending: false })
        .limit(1);
      demoWorkoutId = anyPublic?.[0]?.id ?? null;
    }

    return <WorkoutsEmptyState demoWorkoutId={demoWorkoutId} />;
  }

  // 4) Считаем ТОЛЬКО свои тренировки
  const { count } = await supabase
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);
  const workoutsCount = count ?? 0;

  // 5) 0 → заглушка с демо
  if (workoutsCount === 0) {
    const DEMO_ID = "11111111-1111-4111-8111-111111111111";
    let demoWorkoutId: string | null = null;

    const { data: fixedDemo } = await supabase
      .from("workouts")
      .select("id")
      .eq("id", DEMO_ID)
      .in("visibility", ["public", "unlisted"])
      .limit(1);

    if (fixedDemo?.length) {
      demoWorkoutId = fixedDemo[0].id;
    } else {
      const { data: anyPublic } = await supabase
        .from("workouts")
        .select("id")
        .in("visibility", ["public", "unlisted"])
        .order("created_at", { ascending: false })
        .limit(1);
      demoWorkoutId = anyPublic?.[0]?.id ?? null;
    }

    return <WorkoutsEmptyState demoWorkoutId={demoWorkoutId} />;
  }

  // 6) >0 → выбираем строго свои записи и показываем таблицу
  const { data: rows, error: selectErr } = await supabase
    .from("workouts")
    .select(`
      id,
      user_id,
      start_time,
      local_date,
      uploaded_at,
      sport,
      sub_sport,
      duration_sec,
      distance_m,
      avg_hr,
      calories_kcal,
      name,
      visibility,
      weekday_iso
    `)
    .eq("user_id", uid)
    .order("start_time", { ascending: false })
    .limit(200);

  if (selectErr) {
    console.error("workouts select error:", selectErr);
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
        initialRows={(rows ?? []) as WorkoutRow[]}
        showEmptyState={false}
        initialPageSize={initialPageSize}
      />
    </main>
  );
}