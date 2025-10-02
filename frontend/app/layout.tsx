// app/layout.tsx (server component)
import "./globals.css";
import PHProvider from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";
import AuthCookieSync from "@/components/auth/AuthCookieSync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function extractAccessTokenFromCookieJar(jar: any): string | null {
  const all = jar?.getAll?.() ?? [];
  const map: Record<string, string> = {};
  for (const c of all) map[c.name] = c.value;

  // 1) основной куки supabase
  if (map["sb-access-token"]) return map["sb-access-token"];

  // 2) проектный sb-<project>-auth-token / sb-<project>-access-token
  const sbKey = Object.keys(map).find(
    (k) => k.startsWith("sb-") && (k.includes("access") || k.includes("auth"))
  );
  if (sbKey) {
    const val = map[sbKey];
    // некоторые клиенты кладут base64-JSON с access_token внутри
    if (typeof val === "string" && val.startsWith("base64-")) {
      try {
        const decoded = Buffer.from(val.replace(/^base64-/, ""), "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // игнорируем, попробуем вернуть как есть ниже
      }
    }
    return val;
  }

  // 3) наша легаси-кука capyrun.auth: base64(JSON) с access_token
  if (map["capyrun.auth"]) {
    try {
      const decoded = Buffer.from(map["capyrun.auth"], "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (parsed?.access_token) return parsed.access_token;
    } catch {}
  }
  return null;
}

async function getServerUserFromCookie() {
  const jar = cookies();
  const token = extractAccessTokenFromCookieJar(jar);
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }
  const user = await res.json();
  return {
    id: user?.id ?? user?.sub,
    email: user?.email,
    user_metadata: user?.user_metadata ?? null,
    raw: user,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const serverUser = await getServerUserFromCookie();

  return (
    <html lang="en">
      <body>
        {/*
          Синхронизация httpOnly-кук Supabase при любых изменениях auth-состояния на клиенте.
        */}
        <AuthCookieSync />
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider initialUser={serverUser}>
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}