import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClientWithCookies();
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: origin ? `${origin}/reset-password/confirm` : undefined,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
