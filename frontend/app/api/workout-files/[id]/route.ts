import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("workout_files")
    .select("id, user_id, storage_bucket, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.storage_bucket && row.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from(row.storage_bucket)
      .remove([row.storage_path]);

    if (storageErr) {
      console.warn("workout file storage remove failed", storageErr.message);
    }
  }

  const { error: updateErr } = await supabase
    .from("workout_files")
    .update({
      deleted_at: new Date().toISOString(),
      status: "archived",
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

