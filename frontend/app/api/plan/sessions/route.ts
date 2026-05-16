//frontend/app/api/plan/sessions/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
    const plannedDate = String(body?.planned_date ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const sport = String(body?.sport ?? "run").trim();
    const notes = String(body?.notes ?? "").trim();
    const effort = String(body?.effort ?? "").trim();
    const hrZones = Array.isArray(body?.hr_zones) ? body.hr_zones.map(String) : [];
    const durationMin = numberOrNull(body?.duration_min);
    const distanceKm = numberOrNull(body?.distance_km);

    if (!plannedDate) {
      return NextResponse.json({ error: "planned_date is required" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!sport) {
      return NextResponse.json({ error: "sport is required" }, { status: 400 });
    }

    if (durationMin !== null && durationMin <= 0) {
      return NextResponse.json({ error: "duration_min must be greater than 0" }, { status: 400 });
    }

    if (distanceKm !== null && distanceKm <= 0) {
      return NextResponse.json({ error: "distance_km must be greater than 0" }, { status: 400 });
    }

    const structure = {
      source: "manual",
      goal: title,
      main: notes || null,
      notes: notes || null,
      effort: effort || null,
      hr_target: hrZones.length ? hrZones.join(", ") : null,
      hr_zones: hrZones,
      duration_min: durationMin,
      distance_km: distanceKm,
    };

    const { data, error } = await supabase
      .from("user_plan_sessions")
      .insert({
        user_id: user.id,
        user_plan_id: null,
        planned_date: plannedDate,
        sport,
        status: "planned",
        title,
        notes: notes || null,
        structure,
        updated_at: new Date().toISOString(),
      })
      .select("id, user_plan_id, planned_date, sport, status, title, notes, structure, link_workout_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
