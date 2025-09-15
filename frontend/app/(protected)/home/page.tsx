"use client";
import MyWorkoutsDashboardClient from "@/components/workouts/MyWorkoutsDashboard.client";

export default function ProtectedHomePage() {
  return (
    <main>
      {/* Заглушка: используем уже готовую аналитику из раздела тренировок */}
      <MyWorkoutsDashboardClient daysDefault={30} />
    </main>
  );
}
