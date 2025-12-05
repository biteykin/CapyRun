// /app/api/coach/test/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: message || "Привет" }
      ],
      max_tokens: 50,
    });

    return NextResponse.json({
      ok: true,
      answer: completion.choices[0].message.content,
    });
  } catch (e: any) {
    console.error("TEST API ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}