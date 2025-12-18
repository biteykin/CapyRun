// frontend/app/api/strava/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toIsoFromUnixSeconds(sec: unknown): string | null {
  const n = typeof sec === "number" ? sec : Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function parseScopes(scopeParam: string | null): string[] | null {
  if (!scopeParam) return null;
  const arr = scopeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectOk = new URL("/settings?strava=connected&autosync=1", base);
  const redirectErr = (reason: string, detail?: string) => {
    const u = new URL("/settings", base);
    u.searchParams.set("strava", "error");
    u.searchParams.set("reason", reason);
    if (detail) u.searchParams.set("detail", detail);
    return NextResponse.redirect(u);
  };

  try {
    // 0) user must be logged in (SSR cookies)
    const jar = await cookies();
    const supabase = createServerClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        cookies: {
          getAll: () => jar.getAll(),
          setAll: (cookiesToSet) =>
            cookiesToSet.forEach(({ name, value, options }) =>
              jar.set(name, value, options)
            ),
        },
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) console.error("strava/callback getUser error:", userErr);
    const user = userData?.user;
    if (!user) return redirectErr("no_session");

    // 1) CSRF state check
    const expectedState = jar.get("strava_oauth_state")?.value || null;
    if (!state || !expectedState || state !== expectedState) {
      return redirectErr("bad_state");
    }
    // одноразовость
    jar.set("strava_oauth_state", "", { path: "/", maxAge: 0 });

    // 2) Strava returned error
    if (error) return redirectErr("strava_denied", error);
    if (!code) return redirectErr("no_code");

    // 3) exchange code -> tokens
    const tokenResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("STRAVA_CLIENT_ID"),
        client_secret: env("STRAVA_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson: any = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error("strava token exchange failed:", tokenJson);
      return redirectErr(
        "token_exchange",
        tokenJson?.message || JSON.stringify(tokenJson)
      );
    }

    const access_token: string | null = tokenJson?.access_token ?? null;
    const refresh_token: string | null = tokenJson?.refresh_token ?? null;
    const token_type: string | null = tokenJson?.token_type ?? null;

    const expiresAtIso = toIsoFromUnixSeconds(tokenJson?.expires_at);
    const athlete = tokenJson?.athlete ?? null;

    const athleteId = athlete?.id != null ? String(athlete.id) : null;
    if (!access_token || !refresh_token || !athleteId) {
      return redirectErr("bad_token_payload");
    }

    const scopes = parseScopes(url.searchParams.get("scope"));

    const external_username: string | null = athlete?.username
      ? String(athlete.username)
      : null;

    const display_name: string | null =
      athlete?.firstname || athlete?.lastname
        ? [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ")
        : null;

    const avatar_url: string | null =
      athlete?.profile
        ? String(athlete.profile)
        : athlete?.profile_medium
          ? String(athlete.profile_medium)
          : null;

    // 4) upsert into external_accounts (строго по твоей схеме)
    const nowIso = new Date().toISOString();

    const { error: upErr } = await supabase
      .from("external_accounts")
      .upsert(
        {
          user_id: user.id,
          provider: "strava",
          external_user_id: athleteId,

          external_username,
          display_name,
          avatar_url,

          status: "connected",

          scopes, // text[]
          access_token,
          refresh_token,
          token_type,
          expires_at: expiresAtIso,

          auth_metadata: tokenJson, // jsonb (удобно для дебага/аудита)

          connected_at: nowIso,
          updated_at: nowIso,

          // если захочешь — можно сбрасывать прошлые ошибки синхры:
          last_sync_error: null,
          last_sync_error_code: null,
          error_message: null,
        } as any,
        { onConflict: "user_id,provider" }
      );

    if (upErr) {
      console.error("external_accounts upsert error:", upErr);
      return redirectErr("db_upsert", upErr.message);
    }

    return NextResponse.redirect(redirectOk);
  } catch (e: any) {
    console.error("strava/callback fatal:", e?.message ?? e);
    return redirectErr("callback", String(e?.message ?? "unknown"));
  }
}