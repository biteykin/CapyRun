// components/goals/GoalsListWithAdd.client.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import GoalsList from "./GoalsList.client";

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  status: string;
  date_from: string;
  date_to: string;
  target_json: any;
};

type Props = {
  goals: GoalRow[];
  created?: boolean;
  updated?: boolean;
  goalCompleted?: boolean;
};

export default function GoalsListWithAdd({
  goals,
  created = false,
  updated = false,
  goalCompleted = false,
}: Props) {
  const router = useRouter();

  return (
    <GoalsList
      goals={goals}
      created={created}
      updated={updated}
      goalCompleted={goalCompleted}
      onAddGoal={() => router.push("/goals/onboarding")}
      onEditGoals={() => router.push("/goals/manage")} // пока заглушка
    />
  );
}