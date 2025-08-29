import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // fallback на случай переезда

// В dev подстрахуемся от случайного secret
if (process.env.NODE_ENV !== "production") {
  if (key.startsWith("sb_secret_")) {
    // не кидаем исключение, но сделаем заметным
    console.error("❌ Supabase: в браузер попал SECRET. Нужен publishable/anon.");
  }
}

export const supabase = createBrowserClient(url, key);
