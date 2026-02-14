import * as React from "react";
import "server-only";

import "./globals.css";
import PHProvider from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthCookieSync from "@/components/auth/AuthCookieSync";
import { cookies } from "next/headers";

// В RootLayout не делаем сетевых запросов: любые сетевые сбои не должны ломать портал.

// Получение токена из cookies — обёрнуто в функцию, чтобы не потерять текущую логику
async function getTokenSomehow() {
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

  return token;
}

function base64UrlDecodeToString(input: string) {
  // JWT использует base64url
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecodeToString(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

async function getServerUserFromCookie() {
  const token = await getTokenSomehow();
  if (!token) return null;

  // Вместо сетевого запроса читаем payload из JWT (устойчиво, без fetch).
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Supabase обычно кладёт sub и email в payload
  const id = payload?.sub ?? payload?.user_id ?? payload?.id ?? null;
  const email = payload?.email ?? null;
  const user_metadata = payload?.user_metadata ?? payload?.app_metadata ?? null;

  if (!id) return null;

  return {
    id,
    email,
    user_metadata,
    raw: payload,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUserFromCookie();

  return (
    <html lang="ru">
      <body>
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider initialUser={user}>
            {/* важнo: держим синхронизацию httpOnly-куки после логина/логаута */}
            <AuthCookieSync />
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}