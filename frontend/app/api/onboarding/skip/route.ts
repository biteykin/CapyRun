//frontend/app/api/onboarding/skip/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentProfile, error: currentError } = await supabase
      .from("profiles")
      .select("onboarding")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const currentOnboarding =
      (currentProfile?.onboarding as Record<string, any> | null) ?? {};

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          onboarding_completed_at: now,
          onboarding: {
            ...currentOnboarding,
            status: "skipped",
            skipped_at: now,
            completed_at: now,
            updated_at: now,
          },
          updated_at: now,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
