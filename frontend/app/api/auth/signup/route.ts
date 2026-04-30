import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClientWithCookies();
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/api/auth/confirm` : undefined,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user?.id) {
      await supabase.from("profiles").upsert(
        {
          user_id: data.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    return NextResponse.json({
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email ?? null,
          }
        : null,
      needsEmailConfirmation: !data.session,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
