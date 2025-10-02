// frontend/app/layout.tsx
import "./globals.css";
import PHProvider from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthCookieSync from "@/components/auth/AuthCookieSync";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// аккуратно вытаскиваем access_token из набора куки Next.js
async function getServerUserFromCookie() {
  const jar = await cookies();

  // 1) прямой sb-access-token (JWT)
  let token = jar.get("sb-access-token")?.value || null;

  // 2) проектный sb-<ref>-auth-token (base64(JSON))
  if (!token) {
    for (const c of jar.getAll()) {
      if (c.name.startsWith("sb-") && c.name.endsWith("-auth-token")) {
        try {
          const decoded = Buffer.from(c.value, "base64").toString("utf8");
          const parsed = JSON.parse(decoded);
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        } catch {
          // пропускаем битые/не наши значения
        }
      }
    }
  }

  // 3) наш legacy storageKey (если вдруг остался)
  if (!token) {
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      try {
        const decoded = Buffer.from(legacy, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed?.access_token) token = parsed.access_token;
      } catch {
        // ignore
      }
    }
  }

  if (!token) return null;

  // Вытаскиваем пользователя у Supabase
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const user = await res.json();
  return {
    id: user?.id ?? user?.sub,
    email: user?.email ?? null,
    user_metadata: user?.user_metadata ?? null,
    raw: user,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const serverUser = await getServerUserFromCookie();

  return (
    <html lang="en">
      <body>
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider initialUser={serverUser}>
            {/* важнo: держим синхронизацию httpOnly-куки после логина/логаута */}
            <AuthCookieSync />
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}