// frontend/components/coach/CoachHome.client.tsx
"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  HeartPulse,
  Minus,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CoachHomeState = {
  readiness_score?: number | null;
  trend?: "up" | "down" | "flat" | string | null;
  risk_level?: "low" | "medium" | "high" | string | null;
  signals?: any;
  computed_from?: any;
};

type CoachHomeSnapshot = {
  id?: string | null;
  status?: string | null;
  as_of?: string | null;
  reason?: string | null;
};

export type CoachHomeProps = {
  state?: CoachHomeState | null;
  snapshot?: CoachHomeSnapshot | null;
  // если захочешь потом добавить series — просто прокинем сюда
  onRecomputeClick?: (() => void) | null;
};

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function fmtDateTimeRu(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtKm(v?: number | string | null) {
  const n = typeof v === "string" ? Number(v) : (v ?? null);
  if (!Number.isFinite(Number(n))) return "—";
  return `${(Number(n)).toFixed(2)} км`;
}

function fmtNum(v?: number | string | null, digits = 2) {
  const n = typeof v === "string" ? Number(v) : (v ?? null);
  if (!Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(digits);
}

function TrendIcon({ trend }: { trend?: string | null }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-rose-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function RiskBadge({ risk }: { risk?: string | null }) {
  if (risk === "high") {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="h-3.5 w-3.5" />
        high
      </Badge>
    );
  }
  if (risk === "medium") {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        medium
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ShieldCheck className="h-3.5 w-3.5" />
      low
    </Badge>
  );
}

function readinessText(score: number, trend?: string | null, risk?: string | null) {
  if (risk === "high") return "Есть признаки перегруза — лучше восстановиться.";
  if (trend === "up") return "Форма растёт — можно аккуратно усиливаться.";
  if (trend === "flat") return "Состояние стабильное.";
  if (trend === "down") return "Похоже, накопилась усталость — проверь сон/восстановление.";
  if (score >= 80) return "Отличное состояние — можно делать ключевую работу.";
  if (score >= 60) return "Нормальное состояние — держим план.";
  return "Низкая готовность — лучше мягко.";
}

function ReadinessBar({ value }: { value: number }) {
  const pct = Math.round(clamp01(value / 100) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>100</span>
      </div>
      <div className="h-2 w-full rounded bg-muted">
        <div
          className="h-2 rounded bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniBars({ ratio }: { ratio: number }) {
  // Серый = ожидание (1.0). Цветной = факт.
  const baseH = 60;
  const factH = Math.round(baseH * clamp01(ratio)); // до 60%
  const over = ratio > 1 ? Math.min(40, Math.round((ratio - 1) * 60)) : 0; // до +40%
  const factTotal = Math.min(100, factH + over);

  return (
    <div className="flex items-end gap-2 h-10">
      <div className="w-3 rounded bg-muted" style={{ height: `${baseH}%` }} />
      <div className="w-3 rounded bg-primary" style={{ height: `${factTotal}%` }} />
    </div>
  );
}

export default function CoachHome({ state, snapshot, onRecomputeClick }: CoachHomeProps) {
  const score = Number(state?.readiness_score ?? 0) || 0;
  const trend = (state?.trend ?? "flat") as string;
  const risk = (state?.risk_level ?? "low") as string;

  const computed = state?.computed_from ?? {};
  const windows = Array.isArray(computed?.windows_days) ? computed.windows_days : [];
  const lastWorkoutAt = computed?.last_workout_at ?? null;
  const w7 = computed?.workouts_count_7d ?? null;
  const w28 = computed?.workouts_count_28d ?? null;

  const volume = state?.signals?.volume ?? {};
  const km7 = volume?.km7 ?? null;
  const expected7 = volume?.expected7 ?? null;
  const ratio = Number(volume?.ratio ?? 0) || 0;
  const volumeTrend = volume?.trend ?? "flat";

  const load = state?.signals?.load ?? {};
  const load7 = load?.load7 ?? null;
  const load28 = load?.load28 ?? null;

  return (
    <div className="space-y-4">
      {/* HERO */}
      <Card className="border-muted/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Готовность сегодня
              </CardTitle>

              <div className="flex items-center gap-2">
                <div className="text-2xl font-extrabold tabular-nums">
                  {Math.round(score)}
                  <span className="text-muted-foreground font-semibold">/100</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <TrendIcon trend={trend} />
                    {trend ?? "—"}
                  </Badge>
                  <RiskBadge risk={risk} />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onRecomputeClick?.()}
              disabled={!onRecomputeClick}
              title={
                onRecomputeClick
                  ? "Пересчитать состояние"
                  : "Подключим позже: ручной пересчёт через API"
              }
            >
              Пересчитать
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <ReadinessBar value={score} />
          <p className="text-sm text-muted-foreground">
            {readinessText(score, trend, risk)}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="rounded-lg border border-muted/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-4 w-4" />
                Последняя тренировка
              </div>
              <div className="mt-1 font-semibold">{fmtDateTimeRu(lastWorkoutAt)}</div>
            </div>

            <div className="rounded-lg border border-muted/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HeartPulse className="h-4 w-4" />
                Окна
              </div>
              <div className="mt-1 font-semibold">
                7д: {w7 ?? "—"} • 28д: {w28 ?? "—"}
              </div>
              {windows?.length ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  windows: {windows.join(", ")}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-muted/60 p-3">
              <div className="text-xs text-muted-foreground">Snapshot</div>
              <div className="mt-1 font-semibold">
                {snapshot?.id ? snapshot.id.slice(0, 8) : "—"}{" "}
                <span className="text-muted-foreground font-normal">•</span>{" "}
                {snapshot?.status ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fmtDateTimeRu(snapshot?.as_of ?? null)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SIGNALS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volume */}
        <Card className="border-muted/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Объём (run)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm">
                  <span className="text-muted-foreground">7д:</span>{" "}
                  <span className="font-semibold">{fmtKm(km7)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">ожид.:</span>{" "}
                  <span className="font-semibold">{fmtKm(expected7)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">ratio:</span>{" "}
                  <span className="font-semibold tabular-nums">{fmtNum(ratio, 3)}</span>{" "}
                  <Badge variant="secondary" className="ml-2">
                    {volumeTrend ?? "—"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MiniBars ratio={ratio || 0} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Серый столбик — ожидаемый объём, цветной — фактический за 7 дней.
            </p>
          </CardContent>
        </Card>

        {/* Load */}
        <Card className="border-muted/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Нагрузка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm">
                  <span className="text-muted-foreground">load7:</span>{" "}
                  <span className="font-semibold tabular-nums">{load7 ?? "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">load28:</span>{" "}
                  <span className="font-semibold tabular-nums">{load28 ?? "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">readiness:</span>{" "}
                  <span className="font-semibold tabular-nums">{Math.round(score)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Пока просто визуальный индикатор по readiness */}
                <MiniBars ratio={score / 65} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Пока нагрузка = 0, потому что мы ещё не считаем TRIMP/зоны. Добавим позже.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}