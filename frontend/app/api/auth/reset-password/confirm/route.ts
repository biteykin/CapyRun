import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tokenHash = String(body?.tokenHash ?? "").trim();
    const type = String(body?.type ?? "recovery") as "recovery";
    const password = String(body?.password ?? "");

    if (!tokenHash) {
      return NextResponse.json(
        { error: "tokenHash is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClientWithCookies();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: verifyError.message },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
