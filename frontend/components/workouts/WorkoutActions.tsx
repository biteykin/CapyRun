// frontend/components/workouts/WorkoutActions.tsx

"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function WorkoutActions({ workoutId }: { workoutId: string }) {
  const router = useRouter();

  const onDelete = async () => {
    if (!confirm("Удалить тренировку?")) return;

    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      router.push("/workouts");
      router.refresh();
    } catch (e: unknown) {
      // eslint-disable-next-line no-alert
      alert(`Ошибка удаления: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Button variant="danger" onClick={onDelete}>
      Удалить
    </Button>
  );
}
