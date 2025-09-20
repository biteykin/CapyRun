import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(_req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 👇 Плоский формат (не внутри json_schema)
    const format = {
      type: "json_schema" as const,
      name: "PingResult",
      strict: true,
      schema: {
        type: "object",
        required: ["pong", "date"],
        additionalProperties: false,
        properties: {
          pong: { type: "string", enum: ["pong"] },
          date: { type: "string" }
        }
      }
    };

    // input должен быть строкой
    const prompt = `You are a JSON bot. Output exactly: {"pong":"pong","date":"${today}"}.`;

    const r = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_output_tokens: 30,
      instructions: "Return strictly valid JSON that matches the schema.",
      input: prompt, // строка
      text: { format } // <-- теперь правильно
    });

    const usage: any = (r as any).usage ?? {};
    const output = (r as any).output_text as string | undefined;

    let parsed: any = null;
    try { parsed = output ? JSON.parse(output) : null; } catch {}

    return Response.json({
      ok: !!parsed,
      data: parsed,
      usage: {
        prompt_tokens: usage?.prompt_tokens ?? null,
        completion_tokens: usage?.completion_tokens ?? null,
        total_tokens: usage?.total_tokens ?? null
      }
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}
