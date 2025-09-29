import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash") ?? "";
  const type = (searchParams.get("type") ?? "email") as
    | "signup" | "email" | "recovery" | "magiclink" | "invite";

  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash });

  return NextResponse.redirect(
    new URL(error ? `/login?error=${encodeURIComponent(error.message)}` : "/home", origin)
  );
}