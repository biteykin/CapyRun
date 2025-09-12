"use client";

import WorkoutsTable from "@/components/workouts/WorkoutsTable";
import WorkoutsAnalytics from "@/components/workouts/WorkoutsAnalytics";

export default function WorkoutsPage() {
  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="h-display text-2xl font-extrabold">Мои тренировки</h1>
      </div>
      <WorkoutsTable />
      <WorkoutsAnalytics />
    </main>
  );
}
