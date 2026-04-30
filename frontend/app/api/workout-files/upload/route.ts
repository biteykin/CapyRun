import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const CT_BY_EXT: Record<string, string> = {
  fit: "application/octet-stream",
  gpx: "application/gpx+xml",
  tcx: "application/vnd.garmin.tcx+xml",
  zip: "application/zip",
};

function extFromName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "fit";
}

function buildStoragePath(userId: string, ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${userId}/${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${crypto.randomUUID()}.${ext}`;
}

function bytesToHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const workoutIdRaw = form.get("workoutId");
    const workoutId =
      typeof workoutIdRaw === "string" && workoutIdRaw.trim()
        ? workoutIdRaw.trim()
        : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
    }

    const ext = extFromName(file.name);
    const contentType = file.type || CT_BY_EXT[ext] || "application/octet-stream";
    const arrayBuffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const checksum = bytesToHex(digest);

    const { data: duplicate } = await supabase
      .from("workout_files")
      .select("id")
      .eq("user_id", user.id)
      .eq("checksum_sha256", checksum)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) {
      return NextResponse.json({ ok: true, id: duplicate.id, duplicate: true });
    }

    const bucket = "fits";
    const storagePath = buildStoragePath(user.id, ext);
    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from("workout_files")
      .insert({
        user_id: user.id,
        workout_id: workoutId,
        source: "upload",
        kind: "source",
        content_type: contentType,
        storage_bucket: bucket,
        storage_path: storagePath,
        filename: file.name || null,
        extension: ext,
        size_bytes: file.size,
        status: "pending",
        checksum_sha256: checksum,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return NextResponse.json(
        { error: insertError?.message ?? "Insert failed" },
        { status: 500 }
      );
    }

    const upload = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (upload.error) {
      await supabase
        .from("workout_files")
        .update({
          status: "error",
          error_message: upload.error.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);

      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    await supabase
      .from("workout_files")
      .update({
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
