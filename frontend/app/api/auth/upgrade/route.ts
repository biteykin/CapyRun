// app/api/auth/upgrade/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/workouts";

  const jar = await cookies();
  const raw = jar.get("capyrun.auth")?.value;

  // Если легаси-куки нет — просто редиректим назад
  if (!raw) {
    return NextResponse.redirect(new URL(returnTo, req.url));
  }

  try {
    const b64 = raw.startsWith("base64-") ? raw.slice(7) : raw;
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const s = json?.currentSession ?? json?.session ?? json?.state?.session ?? json;

    const access_token: string | undefined = s?.access_token;
    const refresh_token: string | undefined = s?.refresh_token;

    if (access_token && refresh_token) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  } catch {
    // игнор — всё равно пойдём по редиректу
  } finally {
    // Сносим легаси-куку, чтобы не циклилось
    jar.set("capyrun.auth", "", { path: "/", maxAge: 0 });
  }

  // Сформируем редирект и ПЕРЕНЕСЁМ куки из jar в ответ
  const res = NextResponse.redirect(new URL(returnTo, req.url));

  // В NextResponse нет setAll, поэтому вручную:
  for (const c of jar.getAll()) {
    // getAll() отдаёт { name, value, ...options }
    const { name, value, ...options } = c as any;
    try {
      res.cookies.set(name, value, options);
    } catch {
      // пропускаем странные/только-для-чтения куки
    }
  }

  return res;
}