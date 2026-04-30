import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workout } = await supabase
    .from("workouts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!workout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("entity_type", "workout")
    .eq("entity_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ insight: data ?? null });
}
