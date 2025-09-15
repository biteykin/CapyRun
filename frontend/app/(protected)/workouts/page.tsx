// app/(protected)/workouts/page.tsx
import WorkoutsTable from "@/components/workouts/WorkoutsTable";
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

export default async function WorkoutsPage() {
  const supabase = await createSupabaseServerClient();

  // Один RPC вместо водопада запросов
  const { data, error } = await supabase.rpc("list_dashboard", {
    limit_files: 0,
    limit_workouts: 200,
  });

  if (error) {
    // в dev увидишь причину, UI не падает
    console.error("list_dashboard error:", error);
  }

  const workouts = (Array.isArray(data?.workouts) ? data?.workouts : []) as WorkoutRow[];

  return (
    <main>
      <WorkoutsTable initialRows={workouts} />
    </main>
  );
}