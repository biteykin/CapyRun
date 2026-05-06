"use client";

export type WorkoutVisualsResponse = {
  streams: { s?: unknown } | null;
  gps: { s?: unknown } | null;
  profile: {
    hr_max: number | null;
    hr_zones: unknown | null;
  } | null;
};

const cache = new Map<string, Promise<WorkoutVisualsResponse>>();

export function loadWorkoutVisuals(workoutId: string) {
  const cached = cache.get(workoutId);
  if (cached) return cached;

  const promise = fetch(`/api/workouts/${workoutId}/visuals`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  }).then(async (res) => {
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json as WorkoutVisualsResponse;
  });

  cache.set(workoutId, promise);
  return promise;
}

