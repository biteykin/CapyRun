import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("goals")
      .update({
        status: "completed",
        is_primary: false,
        progress_cache: {
          completion_pct: 100,
        },
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goal: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
