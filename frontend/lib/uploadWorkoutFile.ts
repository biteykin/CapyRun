// frontend/lib/uploadWorkoutFile.ts
import { supabase } from "@/lib/supabaseBrowser";

const CT_BY_EXT: Record<string, string> = {
  fit: "application/octet-stream",
  gpx: "application/gpx+xml",
  tcx: "application/vnd.garmin.tcx+xml",
  zip: "application/zip",
  json: "application/json",
  parquet: "application/vnd.apache.parquet",
  png: "image/png",
};

const KIND_BY_EXT: Record<string, string> = {
  fit: "source",
  gpx: "source",
  tcx: "source",
  zip: "source",
  json: "source",
  parquet: "source",
  png: "source",
};

// --- helpers ---
function extFromFile(file: File) {
  const n = typeof (file as any)?.name === "string" ? ((file as any).name as string) : "";
  const dot = n.lastIndexOf(".");
  const byName = dot >= 0 ? n.slice(dot + 1).toLowerCase() : "";
  if (byName) return byName;

  const ct = (file as any)?.type ? String((file as any).type) : "";
  const byType = ct.split("/").pop()?.toLowerCase() || "";
  if (byType === "x-garmin-fit" || byType === "octet-stream") return "fit";
  return byType || "fit";
}

function bytesToHex(buf: ArrayBuffer) {
  const v = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < v.length; i++) s += v[i].toString(16).padStart(2, "0");
  return s;
}
async function sha256Hex(file: File) {
  const ab = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", ab);
  return bytesToHex(digest);
}
function buildStoragePath(userId: string, ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const id = crypto.randomUUID();
  return `${userId}/${yyyy}/${mm}/${dd}/${id}.${ext || "bin"}`;
}

export type UploadResult =
  | { ok: true; id: string; duplicate?: false }
  | { ok: true; id: string; duplicate: true }
  | { ok: false; error: string };

export async function uploadWorkoutFile(
  file: File,
  opts?: { workoutId?: string | null; bucket?: string }
): Promise<UploadResult> {
  try {
    const bucket = opts?.bucket ?? "fits";
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return { ok: false, error: "No session" };

    if (!file || typeof file.size !== "number" || file.size <= 0) {
      return { ok: false, error: "Пустой файл или неизвестный размер" };
    }

    const ext = extFromFile(file);
    const contentType = file.type || CT_BY_EXT[ext] || "application/octet-stream";
    const kind = KIND_BY_EXT[ext] ?? "source";

    // 1) checksum & dedupe
    let sha256 = "";
    try {
      sha256 = await sha256Hex(file);
    } catch (e) {
      // не фейлим — просто не будет дедупликации
      console.warn("sha256 compute failed:", e);
    }
    if (sha256) {
      const { data: dup, error: dupErr } = await supabase
        .from("workout_files")
        .select("id")
        .eq("user_id", userId)
        .eq("checksum_sha256", sha256)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (!dupErr && dup?.id) {
        return { ok: true, id: dup.id, duplicate: true };
      }
    }

    // 2) pre-insert
    const storage_path = buildStoragePath(userId, ext);
    const insertPayload: any = {
      user_id: userId,
      workout_id: opts?.workoutId ?? null,
      source: "upload",
      kind, // <-- требует, чтобы БД принимала 'source' (см. SQL-миграцию ниже)
      content_type: contentType,
      storage_bucket: bucket,
      storage_path,
      filename: (file as any)?.name || null,
      extension: ext || null,
      size_bytes: file.size || null,
      status: "pending",
      checksum_sha256: sha256 || null,
    };

    const { data: pre, error: preErr } = await supabase
      .from("workout_files")
      .insert([insertPayload])
      .select("id")
      .single();

    if (preErr || !pre?.id) {
      const safe = preErr ? JSON.stringify(preErr, Object.getOwnPropertyNames(preErr)) : "undefined";
      console.error("workout_files insert error:", safe);
      return { ok: false, error: preErr?.message || "Insert failed" };
    }

    // 3) upload to Storage
    const up = await supabase.storage.from(bucket).upload(storage_path, file, {
      contentType,
      upsert: false,
    });

    if (up.error) {
      const human =
        up.error.message === "Bucket not found"
          ? "Хранилище не настроено: бакет 'fits' не существует. Создай бакет в Supabase Storage."
          : up.error.message;

      console.error("storage.upload error:", up.error);
      await supabase
        .from("workout_files")
        .update({
          status: "error",
          error_message: human,
        })
        .eq("id", pre.id);
      return { ok: false, error: human };
    }

    // 4) finalize
    await supabase
      .from("workout_files")
      .update({
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
      })
      .eq("id", pre.id);

    return { ok: true, id: pre.id };
  } catch (e: any) {
    console.error("uploadWorkoutFile fatal:", e?.message ?? e);
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
}