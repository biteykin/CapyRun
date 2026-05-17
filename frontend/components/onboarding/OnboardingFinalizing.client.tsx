// frontend/components/onboarding/OnboardingFinalizing.client.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@/app/icon-512.png";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = {
  id: string;
  label: string;
  durationMs: number;
};

const STAGES: Stage[] = [
  { id: "profile", label: "Анализируем твой профиль", durationMs: 3500 },
  { id: "zones", label: "Подбираем пульсовые зоны", durationMs: 3500 },
  { id: "plan", label: "Готовим первый план тренировок", durationMs: 3500 },
  { id: "calendar", label: "Настраиваем календарь", durationMs: 3500 },
  { id: "coach", label: "Капи готовится тебя встретить", durationMs: 3500 },
];

const TOTAL_MS = STAGES.reduce((s, st) => s + st.durationMs, 0);
const REDIRECT_TARGET = "/home";
const TAIL_BUFFER_MS = 500;

export default function OnboardingFinalizingClient() {
  const router = useRouter();
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  // Префетчим /coach сразу, чтобы переход после анимации был мгновенный
  useEffect(() => {
    router.prefetch(REDIRECT_TARGET);
  }, [router]);

  // Прогрев coach-треда в фоне (опционально — если у тебя есть такой эндпоинт)
  useEffect(() => {
    fetch("/api/coach/bootstrap", {
      method: "GET",
      credentials: "include",
    }).catch(() => {
      // тихо игнорируем — это просто прогрев
    });
  }, []);

  // Стадии + прогресс-бар
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    STAGES.forEach((stage, idx) => {
      elapsed += stage.durationMs;
      const at = elapsed;
      timers.push(
        setTimeout(() => {
          setCompletedIds((prev) => {
            const next = new Set(prev);
            next.add(stage.id);
            return next;
          });
          if (idx < STAGES.length - 1) {
            setCurrentStageIdx(idx + 1);
          }
        }, at)
      );
    });

    const startedAt = Date.now();
    const progressInterval = setInterval(() => {
      const e = Date.now() - startedAt;
      setProgress(Math.min(100, (e / TOTAL_MS) * 100));
    }, 60);

    const redirectTimer = setTimeout(() => {
      router.replace(REDIRECT_TARGET);
    }, TOTAL_MS + TAIL_BUFFER_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(progressInterval);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-indigo-50 via-white to-amber-50 px-6 py-12">
      <div className="w-full max-w-md">
        {/* Капи — квадрат с glow и hover-анимацией, как в GoalsEmptyState */}
        <div className="mb-8 flex justify-center">
          <div className="group relative">
            <div
              className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-gradient-to-br from-yellow-200 to-orange-300 opacity-60 blur-2xl animate-pulse"
              aria-hidden="true"
            />
            <div className="rounded-[28px] bg-background p-2 shadow-xl transition-transform duration-300 group-hover:scale-105">
              <Image
                src={logo}
                alt="Капи"
                width={112}
                height={112}
                priority
                className="-rotate-3 rounded-[22px] transition-transform duration-300 group-hover:rotate-0"
              />
            </div>
          </div>
        </div>

        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Капи готовит твой кабинет
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Это займёт меньше минуты
          </p>
        </div>

        {/* Список стадий */}
        <div
          className="rounded-2xl border border-black/5 bg-white/80 backdrop-blur shadow-sm p-5 space-y-3"
          role="status"
          aria-live="polite"
        >
          {STAGES.map((stage, idx) => {
            const done = completedIds.has(stage.id);
            const active = idx === currentStageIdx && !done;
            const pending = idx > currentStageIdx;
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500",
                  pending && "opacity-40",
                  (active || done) && "opacity-100"
                )}
              >
                <div
                  className={cn(
                    "flex-none h-7 w-7 rounded-full flex items-center justify-center transition-all",
                    done && "bg-emerald-100 text-emerald-700",
                    active && "bg-amber-100 text-amber-700",
                    pending && "bg-slate-100 text-slate-400"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    done && "text-slate-700",
                    active && "text-slate-900",
                    pending && "text-slate-500"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Прогресс-бар */}
        <div className="mt-6 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Не закрывай страницу
        </p>
      </div>
    </div>
  );
}
