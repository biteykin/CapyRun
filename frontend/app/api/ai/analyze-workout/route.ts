// app/api/ai/analyze-workout/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ТОЛЬКО на сервере
);

export async function POST(req: NextRequest) {
  try {
    const { workoutId, locale = "ru" } = await req.json();

    // 1) Подготовим вход (минимальные данные)
    // NOTE: здесь — заглушки. Подставь реальные выборки из своих таблиц.
    const { data: user } = await supabaseAdmin
      .from("profiles")
      .select("id, age, sex, weight_kg, rest_hr")
      .limit(1)
      .single();

    const { data: w } = await supabaseAdmin
      .from("workouts")
      .select("id, sport, start_time, duration_s, distance_m, avg_hr, max_hr, elevation_gain_m, rpe, notes")
      .eq("id", workoutId)
      .single();

    if (!w) return Response.json({ error: "Workout not found" }, { status: 404 });

    const input = {
      user: {
        age: user?.age ?? 30,
        sex: user?.sex ?? "other",
        weight_kg: user?.weight_kg ?? undefined,
        rest_hr: user?.rest_hr ?? undefined
      },
      workout: {
        sport: w.sport,
        start_iso: w.start_time,
        duration_s: w.duration_s,
        distance_m: w.distance_m,
        avg_hr: w.avg_hr,
        max_hr: w.max_hr,
        elevation_gain_m: w.elevation_gain_m,
        rpe: w.rpe,
        notes: w.notes
      }
    };

    // 2) Достаём активную версию промпта
    const { data: tmpl } = await supabaseAdmin
      .from("prompt_templates")
      .select("id, code, current_version_id")
      .eq("code", "workout_analysis")
      .single();

    const { data: ver } = await supabaseAdmin
      .from("prompt_template_versions")
      .select("id, model, temperature, prompt_md, output_schema")
      .eq("id", tmpl!.current_version_id)
      .single();

    const { data: loc } = await supabaseAdmin
      .from("prompt_locale_overrides")
      .select("prompt_md")
      .eq("template_version_id", ver!.id)
      .eq("locale", locale)
      .maybeSingle();

    const instructions = (loc?.prompt_md ?? ver!.prompt_md) + "\nВерни только JSON.";

    // 3) Идемпотентность
    const dedup_key = crypto
      .createHash("sha256")
      .update(JSON.stringify({ locale, input }))
      .digest("hex");

    // 4) Вызов OpenAI Responses API (Structured Outputs)
    const r = await openai.responses.create({
      model: ver!.model || "gpt-4o-mini",
      instructions,
      input,
      response_format: { type: "json_schema", json_schema: ver!.output_schema as any }
    });

    const usage = (r as any).usage ?? {};
    const output_text = (r as any).output_text as string | undefined;
    let parsed: any = null;
    if (output_text) {
      try { parsed = JSON.parse(output_text); } catch {}
    }

    // 5) Логируем запрос/ответ
    const { data: reqRow } = await supabaseAdmin
      .from("ai_requests")
      .insert([{
        user_id: user?.id ?? null,
        template_id: tmpl!.id,
        template_version_id: ver!.id,
        model: ver!.model,
        locale,
        purpose: "workout_analysis",
        input,
        output: parsed,
        raw_response: r,
        status: parsed ? "success" : "failed",
        error: parsed ? null : "parse_error",
        tokens_prompt: usage?.prompt_tokens ?? null,
        tokens_completion: usage?.completion_tokens ?? null,
        usd_cost: null, // при желании рассчитаешь отдельно
        workout_id: workoutId,
        dedup_key
      }])
      .select()
      .single();

    // 6) Сохраняем нормализованный итог для UI
    if (parsed) {
      await supabaseAdmin.from("ai_outputs").insert([{
        request_id: reqRow!.id,
        kind: "workout_insight",
        summary: parsed.summary,
        data: parsed,
        workout_id: workoutId
      }]);
    }

    return Response.json({ ok: true, data: parsed ?? null });
  } catch (e: any) {
    console.error("/api/ai/analyze-workout error", e);
    return Response.json({ error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}