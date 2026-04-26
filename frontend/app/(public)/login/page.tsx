//frontend/app/(public)/login/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Eye, EyeOff } from "lucide-react";
import posthog from "posthog-js";

// shadcn-ui контейнеры (оформление полей/кнопок НЕ трогаем)
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const initialMode = (qs.get("mode") as Mode) || "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function mapAuthError(err: any): string {
    const msg = String(err?.message || "").toLowerCase();

    if (msg.includes("invalid login credentials")) {
      return "Неверный email или пароль";
    }

    if (msg.includes("email not confirmed")) {
      return "Подтвердите email, чтобы войти";
    }

    if (msg.includes("user already registered")) {
      return "Пользователь уже существует. Попробуйте войти";
    }

    if (msg.includes("password should be at least")) {
      return "Пароль слишком короткий";
    }

    if (msg.includes("invalid email")) {
      return "Некорректный email";
    }

    if (msg.includes("rate limit")) {
      return "Слишком много попыток. Попробуйте позже";
    }

    return "Ошибка авторизации. Попробуйте ещё раз";
  }

  useEffect(() => {
    // Если уже есть сессия — редирект
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace("/home");
    });
  }, [router]);

  useEffect(() => {
    const m = (qs.get("mode") as Mode) || "login";
    setMode(m);
  }, [qs]);

  const title = useMemo(
    () => (mode === "login" ? "Войти в CapyRun" : "Создать аккаунт"),
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      async function syncServerSession(session: any) {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "SIGNED_IN", session }),
        });
      }

      async function ensureProfile(userId: string) {
        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      if (mode === "login") {
        posthog.capture("login_submitted", {
          email_domain: email.split("@")[1] || null,
        });

        const { data, error: signErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signErr) throw signErr;

        // Если сервер вернул session — редиректим сразу
        if (data?.session) {
          // Сразу синхронизируем httpOnly-куки на сервере
          await syncServerSession(data.session);
          router.replace("/home");
          return;
        }

        // Иногда cookie/сессия ставится асинхронно (magic link flow или redirect). Делаем короткий retry getSession
        for (let i = 0; i < 3; i++) {
          const { data: retrySession } = await supabase.auth.getSession();
          if (retrySession?.session) {
            await syncServerSession(retrySession.session);
          }
          const { data: sessData } = await supabase.auth.getSession();
          if (sessData?.session) {
            router.replace("/home");
            return;
          }
          await new Promise((res) => setTimeout(res, 300));
        }

        setError(
          "Вход не завершён: сессия не найдена. Проверьте почту или повторите попытку."
        );
      } else {
        posthog.capture("signup_submitted", {
          email_domain: email.split("@")[1] || null,
        });

        const { data, error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
          },
        });

        if (!signErr && data?.session) {
          await syncServerSession(data.session);
          await ensureProfile(data.session.user.id);
          router.replace("/home");
          return;
        }

        // Если такой email уже есть, не раскрываем это напрямую.
        // Пробуем войти с тем же email/password: если пароль верный — пускаем.
        const { data: loginData, error: loginErr } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (!loginErr && loginData?.session) {
          await syncServerSession(loginData.session);
          router.replace("/home");
          return;
        }

        if (signErr) {
          setError(
            "Не удалось создать аккаунт или войти с этими данными. Проверьте пароль или восстановите доступ."
          );
          return;
        }

        setSuccess(
          "Мы отправили письмо для подтверждения регистрации. Проверьте почту и перейдите по ссылке."
        );
      }
    } catch (err: any) {
      setError(mapAuthError(err));
      posthog.capture("auth_error", { mode, message: String(err?.message || "") });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Введите email");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess("Мы отправили письмо для восстановления пароля");
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <CardDescription className="mt-1 text-sm">
            {mode === "login"
              ? "Введи email и пароль, чтобы продолжить."
              : "Укажи email и пароль — мы создадим аккаунт."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <label className="space-y-2 block">
              <span className="text-sm">Email</span>
              {/* инпуты оставляем как есть */}
              <input
                className="input"
                type="email"
                placeholder="yourname@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm">Пароль</span>
              <div className="relative">
                {/* инпуты оставляем как есть */}
                <input
                  className="input pr-10"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-bg-fill-tertiary)]"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && (
              // оставляем вашу текущую разметку алерта
              <div className="alert alert-error" role="alert" aria-live="assertive">
                <span className="alert-icon" aria-hidden="true">
                  ⚠️
                </span>
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div
                className="rounded-2xl border border-[rgba(26,158,58,0.22)] bg-[rgba(197,237,208,0.55)] px-4 py-3 text-sm font-medium text-[rgb(26,158,58)]"
                role="status"
                aria-live="polite"
              >
                {success}
              </div>
            )}

            {/* кнопка оставлена как есть */}
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading
                ? "Подождите…"
                : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
            </button>

            {mode === "login" && (
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="underline text-[var(--text-secondary)]"
                >
                  Забыли пароль?
                </button>
              </div>
            )}
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <div className="text-sm text-center text-[var(--text-secondary)]">
            {mode === "login" ? (
              <>
                Нет аккаунта?{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setMode("signup");
                    router.replace("/login?mode=signup");
                  }}
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setMode("login");
                    router.replace("/login?mode=login");
                  }}
                >
                  Войти
                </button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}