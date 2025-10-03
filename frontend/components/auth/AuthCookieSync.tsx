"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseBrowser";

export default function AuthCookieSync() {
  useEffect(() => {
    // 1) cинхронизируем при любых изменениях авторизации
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session }),
        });
      } catch (e) {
        console.error("auth/callback sync failed", e);
      }
    });

    // 2) инициализация: если уже есть сессия — проставим куки
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event: "TOKEN_REFRESHED", session: data.session }),
        });
      }
    });

    return () => {
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, []);

  return null;
}