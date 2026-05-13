//frontend/app/api/coach/unread-count/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

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

    const { data, error } = await supabase.rpc("get_unread_count_global");

    if (error) {
      console.warn("[api/coach/unread-count] rpc error", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      count: Number(data) || 0,
    });
  } catch (error) {
    console.warn("[api/coach/unread-count] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}