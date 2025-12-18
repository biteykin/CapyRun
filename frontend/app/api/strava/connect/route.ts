// frontend/app/api/strava/connect/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getRequiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  try {
    const jar = await cookies();

    const supabase = createServerClient(
      getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        cookies: {
          getAll() {
            return jar.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              jar.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("strava/connect getUser error:", userErr);
    }

    if (!user) {
      return NextResponse.redirect(new URL("/login", getRequiredEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"));
    }

    const clientId = getRequiredEnv("STRAVA_CLIENT_ID");
    const redirectUri =
      process.env.STRAVA_REDIRECT_URI || "http://localhost:3000/api/strava/callback";

    // state: связываем с юзером (и защитимся от CSRF)
    const state = `${user.id}.${crypto.randomUUID()}.${Date.now()}`;

    // сохраним state в cookie (httpOnly), чтобы callback проверил
    jar.set("strava_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // локально false; на проде будет true (https)
      path: "/",
      maxAge: 60 * 10, // 10 минут
    });

    const authUrl = new URL("https://www.strava.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("approval_prompt", "auto");
    authUrl.searchParams.set("scope", "read,activity:read_all");
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (e: any) {
    console.error("strava/connect fatal:", e?.message ?? e);

    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = new URL("/settings", base);
    url.searchParams.set("strava", "error");
    url.searchParams.set("reason", "connect");
    url.searchParams.set("detail", String(e?.message ?? "unknown"));
    return NextResponse.redirect(url.toString());
  }
}