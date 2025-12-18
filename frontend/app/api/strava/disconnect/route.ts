import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST() {
  try {
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

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("external_accounts")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        // чистим секреты и состояние синка
        access_token: null,
        refresh_token: null,
        token_type: null,
        expires_at: null,
        scopes: null,
        auth_metadata: null,
        last_sync_cursor: null,
        last_sync_status: "never",
        last_sync_error: null,
        last_sync_error_code: null,
        last_synced_at: null,
        last_sync_at: null,
        error_message: null,
        updated_at: nowIso,
      } as any)
      .eq("user_id", user.id)
      .eq("provider", "strava");

    if (error) {
      return NextResponse.json(
        { ok: false, reason: "db_update", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: "disconnect_fatal", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, reason: "method_not_allowed" }, { status: 405 });
}