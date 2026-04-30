// frontend/app/api/goals/onboarding/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validateProfileNumbers(heightCm: number | null, weightKg: number | null) {
  if (heightCm !== null && (heightCm < 80 || heightCm > 250)) {
    return "Рост должен быть в диапазоне 80–250 см";
  }

  if (weightKg !== null && (weightKg < 25 || weightKg > 250)) {
    return "Вес должен быть в диапазоне 25–250 кг";
  }

  return null;
}

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
    const mode = String(body?.mode ?? "initial");
    const editGoalId = body?.editGoalId ? String(body.editGoalId) : null;
    const profile = body?.profile ?? {};
    const goal = body?.goal ?? {};

    const heightCm = numberOrNull(profile.height_cm);
    const weightKg = numberOrNull(profile.weight_kg);
    const validationError = validateProfileNumbers(heightCm, weightKg);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const title = String(goal?.title ?? "").trim();
    const dateTo = String(goal?.date_to ?? "").trim();

    if (!title) {
      return NextResponse.json({ error: "Goal title is required" }, { status: 400 });
    }

    if (!dateTo) {
      return NextResponse.json({ error: "Goal date is required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const profilePatch: Record<string, unknown> = {
      user_id: user.id,
      updated_at: now,
    };

    if (profile.sex !== undefined) {
      profilePatch.sex = profile.sex ?? null;
    }

    if (
      profile.birth_date !== undefined &&
      profile.birth_date !== null &&
      profile.birth_date !== ""
    ) {
      profilePatch.birth_date = profile.birth_date;
    }

    if (profile.height_cm !== undefined) {
      profilePatch.height_cm = heightCm;
    }

    if (profile.weight_kg !== undefined) {
      profilePatch.weight_kg = weightKg;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profilePatch, { onConflict: "user_id" });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const goalPayload = {
      user_id: user.id,
      title,
      type: goal.type ?? "custom",
      sport: goal.sport ?? null,
      date_from: goal.date_from ?? now.slice(0, 10),
      date_to: dateTo,
      status: "active",
      target_json: goal.target_json ?? {},
      notes: goal.notes ?? null,
      updated_at: now,
    };

    let goalRow = null;

    if (editGoalId) {
      const { data, error } = await supabase
        .from("goals")
        .update(goalPayload)
        .eq("id", editGoalId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      goalRow = data;
    } else {
      const { data, error } = await supabase
        .from("goals")
        .insert(goalPayload)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      goalRow = data;
    }

    if (mode === "onboarding") {
      const { data: profileRow, error: onboardingReadError } = await supabase
        .from("profiles")
        .select("onboarding")
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingReadError) {
        return NextResponse.json(
          { error: onboardingReadError.message },
          { status: 500 }
        );
      }

      const current = (profileRow?.onboarding as Record<string, any> | null) ?? {};
      const completedSteps = Array.isArray(current.completed_steps)
        ? current.completed_steps
        : [];

      const { error: onboardingUpdateError } = await supabase
        .from("profiles")
        .update({
          onboarding: {
            ...current,
            status: "in_progress",
            step: "import",
            goal_done: true,
            profile_done: true,
            completed_steps: [...new Set([...completedSteps, "intro", "profile", "goal"])],
            updated_at: now,
          },
          primary_sport: goal.sport ?? "run",
          updated_at: now,
        })
        .eq("user_id", user.id);

      if (onboardingUpdateError) {
        return NextResponse.json(
          { error: onboardingUpdateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ goal: goalRow });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
