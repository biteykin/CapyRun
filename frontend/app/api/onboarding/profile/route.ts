//frontend/app/api/onboarding/profile/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";
import { buildEstimatedHrProfile } from "@/lib/training/hr-zones";

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

export async function PATCH(req: Request) {
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
    const now = new Date().toISOString();

    const { data: currentProfile, error: currentError } = await supabase
      .from("profiles")
      .select("onboarding")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const currentOnboarding =
      (currentProfile?.onboarding as Record<string, any> | null) ?? {};

    const completedSteps = Array.isArray(currentOnboarding.completed_steps)
      ? currentOnboarding.completed_steps
      : [];

    const heightCm = numberOrNull(body.height_cm);
    const weightKg = numberOrNull(body.weight_kg);
    const validationError = validateProfileNumbers(heightCm, weightKg);
    const estimatedHrProfile = buildEstimatedHrProfile({
      birthDate: body.birth_date ?? null,
      sex: body.sex ?? null,
      fallbackToDefault: true,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const patch = {
      user_id: user.id,
      display_name: body.display_name ?? null,
      avatar_url: body.avatar_url ?? null,
      sex: body.sex ?? null,
      birth_date: body.birth_date ?? null,
      height_cm: heightCm,
      weight_kg: weightKg,
      ...(estimatedHrProfile
        ? {
            hr_max: estimatedHrProfile.hrMax,
            hr_zones: estimatedHrProfile.hrZones,
          }
        : {}),
      country_code: body.country_code ?? null,
      city: body.city ?? null,
      timezone: body.timezone ?? null,
      onboarding: {
        ...currentOnboarding,
        status: "in_progress",
        step: "goal",
        profile_done: true,
        completed_steps: [...new Set([...completedSteps, "profile"])],
        updated_at: now,
      },
      updated_at: now,
    };

    const { data: profile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(patch, { onConflict: "user_id" })
      .select("*")
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
