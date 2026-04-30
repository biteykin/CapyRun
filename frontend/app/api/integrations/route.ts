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

    const { data: conn, error } = await supabase
      .from("external_accounts")
      .select("id, provider, status, created_at, updated_at, last_synced_at, error_message")
      .eq("user_id", user.id)
      .eq("provider", "strava")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isConnected = !!conn && conn.status === "connected";

    return NextResponse.json({
      data: {
        strava: {
          connected: isConnected,
          id: conn?.id ?? null,
          provider: conn?.provider ?? "strava",
          status: conn?.status ?? "disconnected",
          created_at: conn?.created_at ?? null,
          updated_at: conn?.updated_at ?? null,
          last_synced_at: conn?.last_synced_at ?? null,
          error_message: conn?.error_message ?? null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
