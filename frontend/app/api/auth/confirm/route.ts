// frontend/app/api/auth/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;

  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "signup") as
    | "signup"
    | "email"
    | "recovery"
    | "magiclink"
    | "invite";

  const successUrl = new URL("/home", origin);
  const errorUrl = new URL("/login?error=confirm_failed", origin);

  const res = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (!token_hash) {
    return NextResponse.redirect(errorUrl);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    console.error("email confirm failed", error.message);
    return NextResponse.redirect(errorUrl);
  }

  return res;
}