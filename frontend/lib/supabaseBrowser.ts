import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Жёсткая диагностика env в браузере
if (typeof window !== "undefined") {
  if (!URL || !KEY) {
    console.error("[Supabase] ENV missing. Put NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in frontend/.env.local");
  } else {
    console.log("[Supabase] URL:", URL, "| ANON:", KEY.slice(0, 6) + "…" + KEY.slice(-6));
  }
}

export const supabase = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "capyrun.auth",
  },
});

// Временный dev-пинг (можно удалить после проверки)
export async function __devPingSupabase() {
  try {
    const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY } });
    console.log("[Supabase] auth/v1/health =", r.status);
  } catch (e) {
    console.error("[Supabase] health fetch failed:", e);
  }
}
