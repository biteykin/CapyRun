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

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id, user_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goalError) {
      return NextResponse.json({ error: goalError.message }, { status: 500 });
    }

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (goal.status === "completed") {
      return NextResponse.json(
        { error: "Completed goal cannot be primary" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await supabase
      .from("goals")
      .update({ is_primary: false, updated_at: now })
      .eq("user_id", user.id)
      .eq("is_primary", true);

    const { data, error } = await supabase
      .from("goals")
      .update({ is_primary: true, updated_at: now })
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
