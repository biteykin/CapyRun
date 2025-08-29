"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Eye, EyeOff } from "lucide-react";
import posthog from "posthog-js";

console.log("SUPABASE ENV", {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  keyStartsWith: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0,3)
});

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

  // Уже залогинен? На /home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/home");
    });
  }, [router]);

  // синхронизируем локальное состояние с ?mode= в URL
  useEffect(() => {
    const m = (qs.get("mode") as Mode) || "login";
    setMode(m);
  }, [qs]);

  // 🔸 Трекинг просмотров страниц login/signup
  useEffect(() => {
    posthog.capture(mode === "signup" ? "signup_page_viewed" : "login_page_viewed");
  }, [mode]);

  const title = useMemo(
    () => (mode === "login" ? "Войти в CapyRun" : "Создать аккаунт"),
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        // 🔸 нажатие "Войти"
        posthog.capture("login_submitted", { email_domain: email.split("@")[1] || null });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        posthog.capture("login_succeeded");
      } else {
        // 🔸 нажатие "Зарегистрироваться"
        posthog.capture("signup_submitted", { email_domain: email.split("@")[1] || null });
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // если сессия не выдаётся сразу (email confirm включён) — всё равно считаем отправку формы
        posthog.capture("signup_succeeded");
      }
      router.replace("/home");
    } catch (err: any) {
      setError(err?.message ?? "Ошибка авторизации");
      posthog.capture("auth_error", { mode, message: String(err?.message || "") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4">
      <form onSubmit={onSubmit} className="card w-full">
        <div className="card-body space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {mode === "login"
                ? "Введи email и пароль, чтобы продолжить."
                : "Укажи email и пароль — мы создадим аккаунт."}
            </p>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm">Email</span>
            <input
              className="input"
              type="email"
              placeholder="yourname@email.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 block">
            <span className="text-sm">Пароль</span>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={()=>setShowPass((s)=>!s)}
                aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-bg-fill-tertiary)]"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error && (
            <div className="alert alert-error" role="alert" aria-live="assertive">
              <span className="alert-icon" aria-hidden="true">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Подождите…" : (mode === "login" ? "Войти" : "Зарегистрироваться")}
          </button>

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
        </div>
      </form>
    </div>
  );
}