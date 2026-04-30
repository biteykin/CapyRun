// frontend/components/auth/AuthCookieSync.tsx

"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseBrowser";

export default function AuthCookieSync() {
  useEffect(() => {
    const isLogoutInProgress = () => {
      try {
        return window.sessionStorage.getItem("capyrun:logout-in-progress") === "1";
      } catch {
        return false;
      }
    };

    // 1) cинхронизируем при любых изменениях авторизации
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isLogoutInProgress()) return;

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
      if (isLogoutInProgress()) return;

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