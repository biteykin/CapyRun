import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function GET(req: Request) {
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
    const threadId = url.searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[api/coach/messages] select error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      messages: data ?? [],
    });
  } catch (error) {
    console.warn("[api/coach/messages] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
