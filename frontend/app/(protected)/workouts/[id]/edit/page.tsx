// frontend/app/(protected)/workouts/[id]/edit/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import WorkoutEditForm from "@/components/workouts/WorkoutEditForm.client";

async function apiGet(path: string, returnTo: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}${path}`, {
    cache: "no-store",
    headers: { cookie: h.get("cookie") ?? "" },
  });
  if (res.status === 401) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent(returnTo)}`);
    redirect("/login");
  }
  if (res.status === 404) redirect("/workouts");
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return res.json();
}

type PageProps = { params: { id: string } };

export default async function EditWorkoutPage({ params }: PageProps) {
  const workoutId = params.id;
  const { workout, initialSubOptions } = await apiGet(
    `/api/workouts/${workoutId}/edit-data`,
    `/workouts/${workoutId}/edit`
  );

  return (
    <main className="w-full space-y-5">
      <h1 className="text-2xl font-extrabold">Редактировать тренировку</h1>
      {/* WorkoutEditForm теперь использует Button (primary/secondary) для submit/cancel */}
      <WorkoutEditForm workout={workout} initialSubOptions={initialSubOptions} />
    </main>
  );
}