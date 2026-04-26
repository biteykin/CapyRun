//frontend/app/(public)/reset-password/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const qs = useSearchParams();

  const token_hash = qs.get("token_hash");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);

    try {
      // подтверждаем токен
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token_hash!,
        type: "recovery",
      });

      if (error) throw error;

      // обновляем пароль
      const { error: updErr } = await supabase.auth.updateUser({
        password,
      });

      if (updErr) throw updErr;

      router.replace("/home");
    } catch (e) {
      alert("Ошибка сброса пароля");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-bold">Новый пароль</h1>

      <input
        className="input w-full"
        type="password"
        placeholder="Введите новый пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="btn btn-primary w-full"
        onClick={handleReset}
        disabled={loading}
      >
        Сохранить пароль
      </button>
    </div>
  );
}