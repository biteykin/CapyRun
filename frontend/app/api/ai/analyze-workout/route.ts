// frontend/app/api/ai/analyze-workout/route.ts
import { NextRequest } from "next/server";
import { analyzeWorkout } from "@/lib/server/ai/analyzeWorkout";

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isTone(v: unknown): v is "supportive" | "tough" | "analyst" {
  return v === "supportive" || v === "tough" || v === "analyst";
}

function isFocus(v: unknown): v is "recovery" | "performance" | "technique" {
  return v === "recovery" || v === "performance" || v === "technique";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workoutId = body?.workoutId;
    const locale = isStr(body?.locale) ? body.locale : "ru";
    const force = !!body?.force;
    const tone = isTone(body?.tone) ? body.tone : "supportive";
    const focus = isFocus(body?.focus) ? body.focus : "recovery";

    if (!workoutId || !isStr(workoutId)) {
      return Response.json({ error: "workoutId is required" }, { status: 400 });
    }

    const result = await analyzeWorkout({
      workoutId,
      locale,
      force,
      tone,
      focus,
    });
    return Response.json(result);
  } catch (e: any) {
    console.error("/api/ai/analyze-workout error", e);
    return Response.json({ error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}