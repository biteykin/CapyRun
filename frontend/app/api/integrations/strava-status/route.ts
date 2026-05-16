//frontend/app/api/integrations/strava-status/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn, error } = await supabase
    .from("external_accounts")
    .select("id, provider, status, created_at, updated_at, last_synced_at, error_message")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    conn: conn ?? null,
    isConnected: !!conn && conn.status === "connected",
  });
}

