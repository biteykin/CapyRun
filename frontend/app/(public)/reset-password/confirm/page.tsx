//frontend/app/(public)/reset-password/confirm/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccess(true);

      setTimeout(() => {
        router.replace("/home");
      }, 1500);
    } catch (err: any) {
      setError("Не удалось обновить пароль. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">
            Новый пароль
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            Задайте новый пароль для вашего аккаунта
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="space-y-2 block">
                <span className="text-sm">Новый пароль</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm">Повторите пароль</span>
                <input
                  className="input"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                />
              </label>

              {error && (
                <div className="alert alert-error">
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Сохраняем…" : "Сохранить пароль"}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-[rgba(26,158,58,0.22)] bg-[rgba(197,237,208,0.55)] px-4 py-3 text-sm font-medium text-[rgb(26,158,58)] text-center">
              Пароль обновлён. Сейчас перенаправим вас в сервис…
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <button
            type="button"
            className="text-sm underline"
            onClick={() => router.push("/login")}
          >
            Вернуться к входу
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}