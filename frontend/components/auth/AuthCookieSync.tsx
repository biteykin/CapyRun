"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseBrowser";

export default function AuthCookieSync() {
  useEffect(() => {
    // Любое изменение auth-состояния — шлём POST на /api/auth/callback,
    // чтобы серверные httpOnly-куки обновились.
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      try {
        await fetch("/api/auth/callback", { method: "POST" });
      } catch {
        // молча игнорируем (сетевые флаппи бывают)
      }
    });

    return () => {
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  return null;
}