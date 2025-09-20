// lib/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // можно оставить тот же ключ; теперь это не критично
    storageKey: "capyrun.auth",
  },
});
