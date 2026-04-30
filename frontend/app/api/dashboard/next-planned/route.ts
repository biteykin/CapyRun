import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

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

    const { data, error } = await supabase
      .from("user_plan_sessions")
      .select("id, planned_date, title, sport, status, structure")
      .eq("user_id", user.id)
      .gte("planned_date", todayISO())
      .in("status", ["planned", "moved"])
      .order("planned_date", { ascending: true })
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
