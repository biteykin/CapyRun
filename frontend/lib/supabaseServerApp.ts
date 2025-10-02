// frontend/lib/supabaseServerApp.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  // В Server Components: можно только читать куки
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // новое API @supabase/ssr
        getAll() {
          return cookieStore.getAll();
        },
        // запись куки в Server Components запрещена — делаем no-op
        setAll(_cookiesToSet) {
          // no-op в Server Components
        },
      },
    }
  );
}