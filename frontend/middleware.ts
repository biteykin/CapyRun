// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Распарсить твою жирную capyrun.auth (base64-JSON) */
function parseCapyRunCookie(req: NextRequest): { access_token?: string; refresh_token?: string } | null {
  const raw = req.cookies.get("capyrun.auth")?.value;
  if (!raw) return null;
  try {
    const b64 = raw.startsWith("base64-") ? raw.slice(7) : raw;
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const s = json?.currentSession ?? json?.session ?? json?.state?.session ?? json;
    const access_token = s?.access_token;
    const refresh_token = s?.refresh_token;
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch {}
  return null;
}

export async function middleware(req: NextRequest) {
  // пропускаем статику/картинки/иконки
  const p = req.nextUrl.pathname;
  if (
    p.startsWith("/_next/") ||
    p.startsWith("/static/") ||
    p.startsWith("/favicon") ||
    p.startsWith("/images/") ||
    p.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // 1) если нет sb-кук — засеем их из capyrun.auth (если есть)
  const hasSbAccess = req.cookies.has("sb-access-token");
  const hasSbRefresh = req.cookies.has("sb-refresh-token");
  if (!hasSbAccess || !hasSbRefresh) {
    const tokens = parseCapyRunCookie(req);
    if (tokens?.access_token && tokens?.refresh_token) {
      // локально secure: false, в проде поставь true
      res.cookies.set({
        name: "sb-access-token",
        value: tokens.access_token,
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });
      res.cookies.set({
        name: "sb-refresh-token",
        value: tokens.refresh_token,
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
      });
      // подчистим жирную куку
      res.cookies.set({
        name: "capyrun.auth",
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  }

  // 2) создаём supabase-клиент в middleware через createServerClient
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // читаем из req
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        // записываем в res (оборачиваем через try/catch не нужно — middleware ok)
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // 3) попросим supabase актуализировать сессию и куки
  await supabase.auth.getSession();

  return res;
}

// обработать все пути, кроме статических
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};