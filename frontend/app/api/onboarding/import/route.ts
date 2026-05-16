//frontend/app/api/onboarding/import/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const ALLOWED_CHOICES = new Set(["strava", "upload", "manual", "skipped"]);

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
    const choice = String(body?.choice ?? "");

    if (!ALLOWED_CHOICES.has(choice)) {
      return NextResponse.json(
        { error: "Invalid import choice" },
        { status: 400 }
      );
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const current = (profileRow?.onboarding as Record<string, any> | null) ?? {};
    const completedSteps = Array.isArray(current.completed_steps)
      ? current.completed_steps
      : [];

    const now = new Date().toISOString();

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: now,
        onboarding: {
          ...current,
          status: choice === "skipped" ? "skipped" : "completed",
          step: "done",
          import_choice: choice,
          import_done: choice !== "skipped",
          skipped_import: choice === "skipped",
          completed_steps: [...new Set([...completedSteps, "import"])],
          completed_at: now,
          updated_at: now,
        },
        updated_at: now,
      })
      .eq("user_id", user.id)
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
