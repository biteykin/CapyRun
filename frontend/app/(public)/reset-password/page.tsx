"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function ResetPasswordRequestPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      setError("Не удалось отправить письмо. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">
            Восстановление пароля
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            Введите email — мы отправим ссылку для сброса пароля
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="space-y-2 block">
                <span className="text-sm">Email</span>
                <input
                  className="input"
                  type="email"
                  placeholder="yourname@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? "Отправляем…" : "Восстановить пароль"}
              </button>
            </form>
          ) : (
            <div
              className="rounded-2xl border border-[rgba(26,158,58,0.22)] bg-[rgba(197,237,208,0.55)] px-4 py-3 text-sm font-medium text-[rgb(26,158,58)] text-center"
            >
              Мы отправили письмо с восстановлением пароля на указанный адрес
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <div className="text-sm text-center text-[var(--text-secondary)] space-x-3">
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/login?mode=login")}
            >
              Войти
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/login?mode=signup")}
            >
              Регистрация
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}