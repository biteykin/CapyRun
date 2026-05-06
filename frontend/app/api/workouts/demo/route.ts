import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEMO_ID = "11111111-1111-4111-8111-111111111111";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: fixedDemo } = await supabase
    .from("workouts")
    .select("id")
    .eq("id", DEMO_ID)
    .in("visibility", ["public", "unlisted"])
    .limit(1);

  if (fixedDemo?.length) {
    return NextResponse.json({ demoWorkoutId: fixedDemo[0].id });
  }

  const { data: anyPublic } = await supabase
    .from("workouts")
    .select("id")
    .in("visibility", ["public", "unlisted"])
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ demoWorkoutId: anyPublic?.[0]?.id ?? null });
}

