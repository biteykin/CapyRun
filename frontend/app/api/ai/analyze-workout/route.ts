// frontend/app/api/ai/analyze-workout/route.ts
import { NextRequest } from "next/server";
import { analyzeWorkout } from "@/lib/server/ai/analyzeWorkout";

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const { workoutId, locale = "ru" } = await req.json();
    if (!workoutId || !isStr(workoutId)) {
      return Response.json({ error: "workoutId is required" }, { status: 400 });
    }

    const result = await analyzeWorkout({ workoutId, locale });
    return Response.json(result);
  } catch (e: any) {
    console.error("/api/ai/analyze-workout error", e);
    return Response.json({ error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}