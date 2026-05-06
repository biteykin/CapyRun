import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

type AnyRow = Record<string, unknown>;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: workout } = await supabase
    .from("workouts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("workout_files")
    .select("*")
    .eq("workout_id", id)
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const files = Array.isArray(data) ? data : [];

  files.sort((a: AnyRow, b: AnyRow) => {
    const ad = new Date(
      (a.uploaded_at ?? a.created_at ?? a.inserted_at ?? 0) as string | number
    ).getTime();
    const bd = new Date(
      (b.uploaded_at ?? b.created_at ?? b.inserted_at ?? 0) as string | number
    ).getTime();
    return bd - ad;
  });

  return NextResponse.json({
    files,
    file: files[0] ?? null,
  });
}
