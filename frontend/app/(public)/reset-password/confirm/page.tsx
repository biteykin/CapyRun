//frontend/app/(public)/reset-password/confirm/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Eye, EyeOff } from "lucide-react";

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

  const tokenHash = params.get("token_hash");
  const type = (params.get("type") ?? "recovery") as "recovery";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function getStrength(p: string) {
    let score = 0;
    if (p.length >= 6) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { label: "Слабый", color: "bg-red-400", pct: 25 };
    if (score === 2) return { label: "Средний", color: "bg-yellow-400", pct: 50 };
    if (score === 3) return { label: "Хороший", color: "bg-blue-500", pct: 75 };
    return { label: "Сильный", color: "bg-emerald-500", pct: 100 };
  }

  const strength = getStrength(password);

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
      if (!tokenHash) {
        throw new Error("Ссылка для восстановления пароля недействительна.");
      }

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (verifyErr) throw verifyErr;

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccess(true);

      setTimeout(() => {
        router.replace("/home");
      }, 1500);
    } catch (err: any) {
      console.error("reset password failed", err);
      setError(
        String(err?.message ?? "")
          .toLowerCase()
          .includes("expired")
          ? "Ссылка для восстановления пароля устарела. Запросите новое письмо."
          : "Не удалось обновить пароль. Попробуйте запросить новое письмо для восстановления."
      );
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
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${strength.color}`}
                        style={{ width: `${strength.pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Надёжность: {strength.label}
                    </div>
                  </div>
                )}
              </label>

              <label className="space-y-2 block">
                <span className="text-sm">Повторите пароль</span>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPass2 ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass2((s) => !s)}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                    aria-label={showPass2 ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPass2 ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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