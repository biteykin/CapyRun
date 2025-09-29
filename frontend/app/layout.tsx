// app/layout.tsx (server component)
import "./globals.css";
import PHProvider from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function extractAccessTokenFromCookies(cookieHeader: string | undefined): Promise<string | null> {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map(p => p.trim()).filter(Boolean);
  const map: Record<string,string> = {};
  for (const p of pairs) {
    const [k,...r] = p.split("=");
    map[k] = r.join("=");
  }

  // Primary candidate
  if (map["sb-access-token"]) return map["sb-access-token"];

  // project-specific cookie like sb-<proj>-auth-token etc.
  const sbKey = Object.keys(map).find(k => k.startsWith("sb-") && k.includes("access") || k.includes("auth"));
  if (sbKey) return map[sbKey];

  // capyrun.auth: base64(JSON) with access_token
  if (map["capyrun.auth"]) {
    try {
      const decoded = Buffer.from(map["capyrun.auth"], "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (parsed?.access_token) return parsed.access_token;
    } catch (e) {
      // ignore
    }
  }

  return null;
}

async function getServerUserFromCookie() {
  const cookieHeader = cookies().toString() || "";
  const token = await extractAccessTokenFromCookies(cookieHeader);
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
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider initialUser={serverUser}>
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
