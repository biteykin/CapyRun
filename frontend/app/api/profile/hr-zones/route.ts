import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

type ZoneInput = {
  name?: unknown;
  min?: unknown;
  max?: unknown;
};

function normalizeZones(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const input = raw as Record<string, ZoneInput>;
  const allowedKeys = ["Z1", "Z2", "Z3", "Z4", "Z5"];
  const out: Record<string, { name: string; min: number; max: number }> = {};

  for (const key of allowedKeys) {
    const row = input[key];
    if (!row || typeof row !== "object") {
      return null;
    }

    const min = Number(row.min);
    const max = Number(row.max);
    const name = String(row.name ?? key).trim() || key;

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }

    if (min <= 0 || max <= 0 || min >= max) {
      return null;
    }

    out[key] = {
      name,
      min: Math.round(min),
      max: Math.round(max),
    };
  }

  return out;
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

    const body = await req.json().catch(() => null);
    const zones = normalizeZones(body?.hr_zones);

    if (!zones) {
      return NextResponse.json(
        { error: "Invalid hr_zones payload" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        hr_zones: zones,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("user_id, hr_zones, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
