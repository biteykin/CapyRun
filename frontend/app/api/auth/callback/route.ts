// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies(); // ⬅️ ВАЖНО: await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Можно и cookieStore.set(name, value, options), но объектная форма типобезопаснее
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );

  try {
    const { event, session } = await req.json();

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      await supabase.auth.setSession(session);
    }
    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}