// components/workouts/MyWorkoutsDashboard.client.tsx
"use client";

import dynamic from "next/dynamic";

// переноcим dynamic в клиентский файл
const MyWorkoutsDashboard = dynamic(
  () => import("@/components/workouts/MyWorkoutsDashboard"),
  { ssr: false }
);

export default MyWorkoutsDashboard;