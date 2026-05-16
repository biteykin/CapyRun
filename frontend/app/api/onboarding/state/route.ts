//frontend/app/api/onboarding/state/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "user_id, onboarding, onboarding_completed_at, sex, birth_date, height_cm, weight_kg, hr_rest, hr_max, display_name, avatar_url, country_code, city"
    )
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile,
  });
}

