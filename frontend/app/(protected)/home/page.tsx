"use client";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import MyWorkoutsDashboardClient from "@/components/workouts/MyWorkoutsDashboard.client";

export default function ProtectedHomePage() {
  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }]} />
      </div>

      {/* Заглушка: используем уже готовую аналитику из раздела тренировок */}
      <MyWorkoutsDashboardClient daysDefault={30} />
    </main>
  );
}
