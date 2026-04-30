import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

async function getUser() {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user, error: userError } = await getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const goal = body?.goal ?? body;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowed = [
      "title",
      "type",
      "sport",
      "date_from",
      "date_to",
      "status",
      "target_json",
      "notes",
      "progress_cache",
      "is_primary",
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(goal ?? {}, key)) {
        patch[key] = goal[key];
      }
    }

    if (typeof patch.title === "string") {
      patch.title = patch.title.trim();
      if (!patch.title) {
        return NextResponse.json({ error: "Goal title is required" }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("goals")
      .update(patch)
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user, error: userError } = await getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
