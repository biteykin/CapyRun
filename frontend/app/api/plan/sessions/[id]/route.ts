//frontend/app/api/plan/sessions/[id]/route.ts

import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const plannedDate = body?.planned_date;

    if (!isIsoDate(plannedDate)) {
      return NextResponse.json(
        { error: "planned_date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (plannedDate < todayIso()) {
      return NextResponse.json(
        { error: "Planned workout cannot be moved to the past" },
        { status: 400 }
      );
    }

    const { data: session, error: readError } = await supabase
      .from("user_plan_sessions")
      .select("id, user_id, status, planned_date, title, sport, notes, structure")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status === "completed" || session.status === "missed") {
      return NextResponse.json(
        { error: "Only active planned workouts can be moved" },
        { status: 400 }
      );
    }

    if (String(session.planned_date) < todayIso()) {
      return NextResponse.json(
        { error: "Past planned workouts cannot be moved" },
        { status: 400 }
      );
    }

    const title =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const sport =
      typeof body?.sport === "string" ? body.sport.trim() : undefined;
    const notes =
      body && Object.prototype.hasOwnProperty.call(body, "notes")
        ? body.notes == null
          ? null
          : String(body.notes)
        : undefined;
    const effort =
      body && Object.prototype.hasOwnProperty.call(body, "effort")
        ? body.effort == null
          ? null
          : String(body.effort)
        : undefined;
    const durationMin =
      body && Object.prototype.hasOwnProperty.call(body, "duration_min")
        ? body.duration_min == null
          ? null
          : Number(body.duration_min)
        : undefined;
    const distanceKm =
      body && Object.prototype.hasOwnProperty.call(body, "distance_km")
        ? body.distance_km == null
          ? null
          : Number(body.distance_km)
        : undefined;
    const hrZones =
      body && Object.prototype.hasOwnProperty.call(body, "hr_zones")
        ? Array.isArray(body.hr_zones)
          ? body.hr_zones.map((z: unknown) => String(z)).filter(Boolean)
          : []
        : undefined;

    if (title !== undefined && !title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    if (
      durationMin !== undefined &&
      durationMin !== null &&
      (!Number.isFinite(durationMin) || durationMin <= 0)
    ) {
      return NextResponse.json(
        { error: "duration_min must be positive" },
        { status: 400 }
      );
    }

    if (
      distanceKm !== undefined &&
      distanceKm !== null &&
      (!Number.isFinite(distanceKm) || distanceKm <= 0)
    ) {
      return NextResponse.json(
        { error: "distance_km must be positive" },
        { status: 400 }
      );
    }

    const currentStructure =
      session.structure && typeof session.structure === "object"
        ? (session.structure as Record<string, unknown>)
        : {};

    const nextStructure: Record<string, unknown> = {
      ...currentStructure,
    };

    if (notes !== undefined) nextStructure.notes = notes;
    if (effort !== undefined) nextStructure.effort = effort;
    if (durationMin !== undefined) nextStructure.duration_min = durationMin;
    if (distanceKm !== undefined) nextStructure.distance_km = distanceKm;
    if (hrZones !== undefined) nextStructure.hr_zones = hrZones;

    const updatePayload: Record<string, unknown> = {
      planned_date: plannedDate,
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updatePayload.title = title;
    if (sport !== undefined) updatePayload.sport = sport;
    if (notes !== undefined) updatePayload.notes = notes;
    updatePayload.structure = nextStructure;

    const { data, error } = await supabase
      .from("user_plan_sessions")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, planned_date, status, title, sport, notes, structure")
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClientWithCookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session, error: readError } = await supabase
      .from("user_plan_sessions")
      .select("id, user_id, user_plan_id, structure")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const structure = session.structure as Record<string, any> | null;
    const isManual =
      structure?.source === "manual" ||
      !session.user_plan_id;

    if (isManual) {
      const { error } = await supabase
        .from("user_plan_sessions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, action: "deleted" });
    }

    const { error } = await supabase
      .from("user_plan_sessions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "canceled" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
