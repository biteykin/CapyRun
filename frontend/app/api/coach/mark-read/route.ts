//frontend/app/api/coach/mark-read/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

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

    const body = await req.json();
    const threadId = body.threadId as string | undefined;

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.rpc("coach_mark_thread_read", {
      p_thread_id: threadId,
    });

    if (error) {
      console.warn("[api/coach/mark-read] rpc error", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[api/coach/mark-read] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}