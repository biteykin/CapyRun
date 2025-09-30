// frontend/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClientWithCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
 * Создаёт серверный клиент без контекста запроса.
 * Мы передаём пустые реализации getAll/setAll, чтобы удовлетворить новое API.
 */
export const createClient = () =>
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