// frontend/components/onboarding/StravaConnectCard.tsx
"use client";

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function StravaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

const FEATURES = [
  "Авто-синхронизация после каждой тренировки",
  "История за всё время на Strava",
  "GPS-треки, пульс и темп",
  "Капи разбирает каждую тренировку",
];

export function StravaConnectCard({
  isConnected,
  isLoading,
  onConnect,
}: {
  isConnected: boolean;
  isLoading?: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-[#FC5200] via-[#FC6B26] to-[#FF8A3C] p-6 text-white shadow-lg shadow-orange-900/10">
      {/* декоративные орбы */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-amber-300/25 blur-3xl" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/95 shadow-md ring-1 ring-white/40">
          <StravaIcon className="h-7 w-7 text-[#FC5200]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold leading-tight">Strava</h3>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold backdrop-blur">
                <Check className="h-3 w-3" strokeWidth={3} />
                Подключено
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
                Рекомендуем
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/90">
            Подключи Strava — и все твои тренировки попадут в Капи автоматически. Ничего вручную заводить не придётся.
          </p>
        </div>
      </div>

      {/* фичи */}
      <ul className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-white/95">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={3} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="relative mt-5">
        {isConnected ? (
          <Button
            type="button"
            disabled
            className="w-full bg-white/95 font-semibold text-[#FC5200] hover:bg-white"
          >
            <Check className="mr-2 h-4 w-4" strokeWidth={3} />
            Уже подключено
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onConnect}
            disabled={isLoading}
            className="w-full bg-white font-semibold text-[#FC5200] shadow-md transition hover:bg-white/95"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Открываем Strava…
              </>
            ) : (
              <>
                Подключить Strava
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
