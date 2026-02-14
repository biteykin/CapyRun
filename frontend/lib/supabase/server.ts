// frontend/lib/supabase/server.ts

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClientWithCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // ВАЖНО: user-scoped клиент должен быть на anon/publishable ключе
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // проигнорировать в Server Components
          }
        },
      },
    }
  );
}

/**
 * Admin client (SERVICE_ROLE).
 * Использовать ТОЛЬКО на сервере (API routes / cron / migrations),
 * и только когда действительно нужно обойти RLS.
 */
export const createAdminClient = () =>
  createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          // вне контекста запроса куки недоступны — возвращаем пустой список
          return [];
        },
        setAll() {
          // ничего не делаем
        },
      },
    }
  );

// Backward-compat, если много мест импортят createClient:
// лучше потом везде переименовать на createAdminClient.
export const createClient = createAdminClient;