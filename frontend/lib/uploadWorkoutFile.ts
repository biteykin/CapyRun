// frontend/lib/uploadWorkoutFile.ts

export type UploadResult =
  | { ok: true; id: string; duplicate?: false }
  | { ok: true; id: string; duplicate: true }
  | { ok: false; error: string };

export async function uploadWorkoutFile(
  file: File,
  opts?: { workoutId?: string | null; bucket?: string }
): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append("file", file);

    if (opts?.workoutId) {
      form.append("workoutId", opts.workoutId);
    }

    const res = await fetch("/api/workout-files/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        error: json?.error ?? `HTTP ${res.status}`,
      };
    }

    return json as UploadResult;
  } catch (e: any) {
    console.error("uploadWorkoutFile fatal:", e?.message ?? e);
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
}