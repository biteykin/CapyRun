// frontend/app/api/profile/me/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const PROFILE_PATCH_FIELDS = [
  "display_name",
  "avatar_url",
  "locale",
  "timezone",
  "country_code",
  "country",
  "city",
  "unit_system",
  "username",
  "bio",
  "gender",
  "sex",
  "birth_date",
  "height_cm",
  "weight_kg",
  "default_workout_privacy",
] as const;

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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
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
    const patch: Record<string, unknown> = {};

    for (const field of PROFILE_PATCH_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        patch[field] = body[field];
      }
    }

    // UI местами может отправлять gender, а в таблице используется sex.
    // Держим обратную совместимость и сохраняем в реальную колонку profiles.sex.
    if (Object.prototype.hasOwnProperty.call(patch, "gender")) {
      patch.sex = patch.gender;
      delete patch.gender;
    }

    // Старое поле country оставляем для совместимости,
    // но реальная колонка в profiles у нас country_code.
    if (Object.prototype.hasOwnProperty.call(patch, "country")) {
      patch.country_code = patch.country;
      delete patch.country;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: "No supported profile fields provided" },
        { status: 400 }
      );
    }

    const height =
      patch.height_cm == null || patch.height_cm === ""
        ? null
        : Number(patch.height_cm);
    const weight =
      patch.weight_kg == null || patch.weight_kg === ""
        ? null
        : Number(patch.weight_kg);

    if (height !== null && (!Number.isFinite(height) || height < 80 || height > 250)) {
      return NextResponse.json(
        { error: "Рост должен быть в диапазоне 80–250 см" },
        { status: 400 }
      );
    }

    if (weight !== null && (!Number.isFinite(weight) || weight < 25 || weight > 250)) {
      return NextResponse.json(
        { error: "Вес должен быть в диапазоне 25–250 кг" },
        { status: 400 }
      );
    }

    if ("height_cm" in patch) patch.height_cm = height;
    if ("weight_kg" in patch) patch.weight_kg = weight;

    patch.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          ...patch,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
