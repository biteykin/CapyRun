import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

const PROFILE_PATCH_FIELDS = [
  "display_name",
  "avatar_url",
  "locale",
  "timezone",
  "country",
  "city",
  "unit_system",
  "username",
  "bio",
  "gender",
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
      .eq("id", user.id)
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

    if (!Object.keys(patch).length) {
      return NextResponse.json(
        { error: "No supported profile fields provided" },
        { status: 400 }
      );
    }

    patch.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
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
