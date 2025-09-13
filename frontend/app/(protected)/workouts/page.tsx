// app/(protected)/workouts/page.tsx
import WorkoutsTable from "@/components/workouts/WorkoutsTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import MyWorkoutsDashboardClient from "@/components/workouts/MyWorkoutsDashboard.client";

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
  name: string | null;
  visibility: string | null;
  weekday_iso: number | null;
};

export default async function WorkoutsPage() {
  const supabase = createSupabaseServerClient();

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
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="h-display text-2xl font-extrabold">Мои тренировки</h1>
      </div>

      {/* Таблица получает данные пропсами (компонент клиентский) */}
      <WorkoutsTable initialRows={workouts} />

      {/* Дашборд через клиентский враппер с dynamic({ ssr:false }) */}
      <MyWorkoutsDashboardClient daysDefault={30} />
    </main>
  );
}