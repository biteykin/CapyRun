import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: thread, error: threadError } = await supabase
      .from("coach_threads")
      .select("id")
      .eq("user_id", user.id)
      .eq("scope", "general")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    if (!thread?.id) {
      return NextResponse.json({ data: null });
    }

    const { data, error } = await supabase
      .from("coach_messages")
      .select("id, body, created_at, meta")
      .eq("thread_id", thread.id)
      .eq("type", "coach")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
