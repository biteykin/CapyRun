import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const workoutId = url.searchParams.get("workoutId");
    const limitRaw = Number(url.searchParams.get("limit") ?? 500);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 500;

    let query = supabase
      .from("workout_files")
      .select(
        "id,user_id,workout_id,filename,status,error_message,created_at,uploaded_at,processed_at,storage_bucket,storage_path,size_bytes,kind,content_type"
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workoutId) {
      query = query.eq("workout_id", workoutId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
