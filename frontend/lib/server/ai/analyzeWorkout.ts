// frontend/lib/server/ai/analyzeWorkout.ts
import OpenAI from "openai";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
// no extra deps

export type WorkoutInsightTone = "supportive" | "tough" | "analyst";
export type WorkoutInsightFocus = "recovery" | "performance" | "technique";

type AnalyzeWorkoutInput = {
  workoutId: string;
  locale?: string;
  force?: boolean;
  tone?: WorkoutInsightTone;
  focus?: WorkoutInsightFocus;
};

type WorkoutRow = {
  id: string;
  user_id: string;
  name: string | null;
  sport: string | null;
  start_time: string | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elev_gain_m: number | null;
  perceived_exertion: number | null;
  description: string | null;
};

type ProfileRow = {
  user_id: string;
  age: number | null;
  sex: string | null;
  weight_kg: number | null;
  rest_hr: number | null;
  hr_max: number | null;
  hr_zones: any;
};

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function supportsTemperature(model: unknown) {
  const m = typeof model === "string" ? model.toLowerCase() : "";
  if (!m) return false;
  // На практике "reasoning"/некоторые новые модели могут не поддерживать temperature.
  // Безопасное правило: отключаем temperature для gpt-5* (и похожих).
  // Если позже захочешь — расширим список.
  if (m.startsWith("gpt-5")) return false;
  return true;
}

function mdEscape(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function buildContentMd(parsed: any) {
  const summary = typeof parsed?.summary === "string" ? parsed.summary : "";
  const positives = Array.isArray(parsed?.positives) ? parsed.positives.filter((x: any) => typeof x === "string") : [];
  const risks = Array.isArray(parsed?.risks) ? parsed.risks.filter((x: any) => typeof x === "string") : [];
  const nextHint = typeof parsed?.next_session_hint === "string" ? parsed.next_session_hint : "";

  const lines: string[] = [];
  if (summary) {
    lines.push("## Кратко");
    lines.push(mdEscape(summary));
    lines.push("");
  }

  if (positives.length) {
    lines.push("## Что хорошо");
    for (const p of positives) lines.push(`- ${mdEscape(p)}`);
    lines.push("");
  }

  if (risks.length) {
    lines.push("## Риски / что улучшить");
    for (const r of risks) lines.push(`- ${mdEscape(r)}`);
    lines.push("");
  }

  if (nextHint) {
    lines.push("## Следующая тренировка");
    lines.push(mdEscape(nextHint));
    lines.push("");
  }

  // fallback, чтобы всегда был не пустой markdown
  if (!lines.length) return "## Инсайт\nНет данных.";
  return lines.join("\n").trim() + "\n";
}

function normalizeSport(s: unknown) {
  const v = typeof s === "string" ? s.toLowerCase().trim() : "";
  return v || null;
}

function promptVersionLabel(ver: { version?: number | null; id?: string | null }) {
  // В ai_insights.prompt_version мы храним короткий человекочитаемый идентификатор.
  // Если есть integer version — используем vN, иначе вернём id.
  if (isNum(ver?.version)) return `v${ver.version}`;
  return ver?.id ?? null;
}

export async function analyzeWorkout({
  workoutId,
  locale = "ru",
  force = false,
  tone = "supportive",
  focus = "recovery",
}: AnalyzeWorkoutInput) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1) Грузим тренировку (и user_id владельца)
  const { data: w, error: wErr } = await supabaseAdmin
    .from("workouts")
    .select(
      "id, user_id, name, sport, start_time, duration_sec, moving_time_sec, distance_m, avg_hr, max_hr, elev_gain_m, perceived_exertion, description"
    )
    .eq("id", workoutId)
    .single();

  if (wErr) throw new Error(wErr.message);
  if (!w) throw new Error("Workout not found");

  const workout = w as WorkoutRow;
  const userId = workout.user_id;

  // 2.1) Доп. заметки (если используешь таблицу notes)
  // Это важно: пользователь мог писать комментарии не в workouts.description
  const { data: notesRows, error: notesErr } = await supabaseAdmin
    .from("notes")
    .select("content")
    .eq("user_id", userId)
    .eq("entity_type", "workout")
    .eq("entity_id", workoutId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (notesErr) {
    // не фейлим анализ из-за notes
    console.warn("notes fetch error", notesErr);
  }
  const extraNotes: string[] =
    Array.isArray(notesRows)
      ? notesRows
          .map((r: any) => (typeof r?.content === "string" ? r.content.trim() : ""))
          .filter((x: string) => x.length > 0)
      : [];

  // 2) Профиль владельца тренировки (не обязателен)
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("user_id, age, sex, weight_kg, rest_hr, hr_max, hr_zones")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = (prof as ProfileRow | null) ?? null;

  const input = {
    user: {
      age: profile?.age ?? 30,
      sex: profile?.sex ?? "other",
      weight_kg: profile?.weight_kg ?? undefined,
      rest_hr: profile?.rest_hr ?? undefined,
      hr_max: profile?.hr_max ?? undefined,
      hr_zones: profile?.hr_zones ?? undefined,
    },
    workout: {
      id: workout.id,
      sport: workout.sport,
      name: workout.name ?? undefined,
      start_iso: workout.start_time,
      duration_s: workout.duration_sec,
      moving_time_s: workout.moving_time_sec ?? null,
      distance_m: workout.distance_m,
      avg_hr: workout.avg_hr,
      max_hr: workout.max_hr,
      elevation_gain_m: workout.elev_gain_m ?? null,
      rpe: workout.perceived_exertion ?? null,
      // ВАЖНО: "notes" — это то, что модель обязана учитывать как пользовательский контекст
      user_notes: workout.description ?? null,
      extra_notes: extraNotes.length ? extraNotes : null,
    },
    meta: force
      ? {
          // nonce гарантирует новый запрос даже если остальной input совпадает
          nonce: `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`,
        }
      : undefined,
  };

  const preferences = {
    tone,
    focus,
    // можно расширять позже (например, "direct" / "more_detail")
  };

  // 3) Достаём активную версию промпта
  const { data: tmpl, error: tmplErr } = await supabaseAdmin
    .from("prompt_templates")
    .select("id, code, current_version_id")
    .eq("code", "workout_analysis")
    .single();

  if (tmplErr) throw new Error(tmplErr.message);
  if (!tmpl?.current_version_id) throw new Error("workout_analysis has no current_version_id");

  const { data: ver, error: verErr } = await supabaseAdmin
    .from("prompt_template_versions")
    .select("id, version, model, temperature, prompt_md, output_schema")
    .eq("id", tmpl.current_version_id)
    .single();

  if (verErr) throw new Error(verErr.message);
  if (!ver?.output_schema) throw new Error("Prompt version output_schema is missing");

  const { data: loc } = await supabaseAdmin
    .from("prompt_locale_overrides")
    .select("prompt_md")
    .eq("template_version_id", ver.id)
    .eq("locale", locale)
    .maybeSingle();

  const basePrompt = `${(loc?.prompt_md ?? ver.prompt_md) || ""}`.trim();
  const prefsHint = [
    "ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ (важно):",
    `- tone: ${tone} (supportive = поддерживающий, tough = строгий, analyst = аналитичный)`,
    `- focus: ${focus} (recovery = восстановление/риски, performance = результат/качество, technique = техника)`,
    "Адаптируй формулировки и акценты под эти предпочтения, не нарушая JSON-схему.",
  ].join("\n");

  const instructions = `${basePrompt}\n\n${prefsHint}\n\nВерни только JSON.`;

  // 4) Идемпотентность (на уровне ai_requests)
  const dedup_key = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        workoutId,
        locale,
        template_version_id: ver.id,
        input,
        preferences,
      })
    )
    .digest("hex");

  // (опционально) быстрый кэш, если force=false
  if (!force) {
    const { data: existingReq } = await supabaseAdmin
      .from("ai_requests")
      .select("id, output, status")
      .eq("dedup_key", dedup_key)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReq?.output) {
      return {
        ok: true,
        cached: true,
        data: existingReq.output,
        request_id: existingReq.id ?? null,
        dedup_key,
      };
    }
  }

  // 5) Вызов OpenAI Responses API (Structured Outputs)
  const outSchema = ver.output_schema as any;
  const jsonSchema = outSchema?.schema ?? outSchema; // поддержим оба формата на всякий случай

  // Responses API: input должен быть строкой или массивом input items.
  // Самый надёжный способ: передаём JSON строкой + строгий text.format=json_schema.
  const r = await openai.responses.create({
    model: ver.model || "gpt-4o-mini",
    instructions,
    input: JSON.stringify({
      ...input,
      preferences,
    }),
    text: { format: { type: "json_schema", json_schema: ver.output_schema as any } } as any,
  });

  const usage = (r as any).usage ?? {};
  const output_text = (r as any).output_text as string | undefined;
  let parsed: any = null;
  if (output_text) {
    try {
      parsed = JSON.parse(output_text);
    } catch {
      parsed = null;
    }
  }

  // 6) Логируем запрос/ответ
  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("ai_requests")
    .insert([
      {
        user_id: userId,
        template_id: tmpl.id,
        template_version_id: ver.id,
        model: ver.model,
        locale,
        purpose: "workout_analysis",
        input: { ...input, preferences },
        output: parsed,
        raw_response: r,
        status: parsed ? "success" : "failed",
        error: parsed ? null : "parse_error",
        tokens_prompt: usage?.prompt_tokens ?? usage?.input_tokens ?? null,
        tokens_completion: usage?.completion_tokens ?? usage?.output_tokens ?? null,
        usd_cost: null,
        workout_id: workoutId,
        dedup_key,
      },
    ])
    .select()
    .single();

  if (reqErr) throw new Error(reqErr.message);

  // 7) Сохраняем нормализованный итог для UI (ai_outputs)
  if (parsed) {
    const { error: outErr } = await supabaseAdmin.from("ai_outputs").insert([
      {
        request_id: reqRow!.id,
        user_id: userId,
        kind: "workout_insight",
        summary: typeof parsed?.summary === "string" ? parsed.summary : null,
        data: parsed,
        locale,
        workout_id: workoutId,
      },
    ]);
    if (outErr) throw new Error(outErr.message);
  }

  // 8) Генерим content_md и пишем в ai_insights через RPC
  if (parsed) {
    const content_md = buildContentMd(parsed);
    const p_sport = normalizeSport(workout.sport);

    const tokensTotal: number | null =
      (isNum(usage?.total_tokens) ? usage.total_tokens : null) ??
      (isNum(usage?.prompt_tokens) || isNum(usage?.completion_tokens)
        ? Number((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0))
        : null) ??
      (isNum(usage?.input_tokens) || isNum(usage?.output_tokens)
        ? Number((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0))
        : null);

    const { error: insightErr } = await supabaseAdmin.rpc("upsert_ai_insight", {
      p_user_id: userId,
      p_scope: "workout",
      p_summary: typeof parsed?.summary === "string" ? parsed.summary : "",
      p_content_md: content_md,
      p_entity_id: workoutId,
      p_period_from: null,
      p_period_to: null,
      p_sport: p_sport,
      p_title: workout.name ?? "Разбор тренировки",
      p_data: { ...parsed, preferences },
      p_model: ver.model ?? null,
      p_prompt_version: promptVersionLabel(ver) ?? null,
      p_tokens: tokensTotal,
      p_cost: 0,
    });

    if (insightErr) throw new Error(insightErr.message);
    return {
      ok: true,
      cached: false,
      data: parsed,
      request_id: reqRow?.id ?? null,
      dedup_key,
      content_md,
    };
  }

  return {
    ok: !!parsed,
    cached: false,
    data: parsed,
    request_id: reqRow?.id ?? null,
    dedup_key,
  };
}