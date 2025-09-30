import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClientWithCookies() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.SUPABASE_URL!,               // серверная переменная
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // серверная переменная
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // проигнорировать в Server Components
          }
        },
      },
    }
  )
}

export const createClient = () =>
  createServerClient({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  })