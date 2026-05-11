// frontend/components/goals/GoalsList.client.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import GoalsEmptyState from "@/components/goals/GoalsEmptyState";
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";

type GoalTarget = {
  primary?: string;
  secondary?: string;
  race_name?: string;
  target_time_s?: number;
};

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  status: string;
  date_from: string;
  date_to: string;
  target_json: GoalTarget | null;
  progress_cache?: {
    completion_pct?: number;
    progress_pct?: number;
    progress?: number;
    fitness_score?: number;
  } | null;
  notes?: string | null;
  is_primary?: boolean | null;
};

type GoalsListProps = {
  goals: GoalRow[];
  created?: boolean;
  updated?: boolean;
  goalCompleted?: boolean;
  onAddGoal?: () => void;
  onEditGoals?: () => void;
};

const TYPE_META: Record<string, { emoji: string; label: string; description: string }> = {
  "10k":    { emoji: "💨",  label: "Забег 10 км",         description: "Скорость и устойчивость на десятке." },
  HM:       { emoji: "🏁",  label: "Полумарафон",         description: "21,1 км с контролем нагрузки." },
  M:        { emoji: "🧱",  label: "Марафон",             description: "Большая цель сезона." },
  trail:    { emoji: "⛰️",  label: "Трейл",               description: "Набор высоты, техника и терпение." },
  ride:     { emoji: "🚴‍♂️", label: "Вело",                description: "Выносливость и сила ног." },
  swim:     { emoji: "🏊‍♂️", label: "Плавание",            description: "Техника, дыхание и работа на воде." },
  strength: { emoji: "🏋️‍♂️", label: "Силовая",             description: "Мышцы, стабильность и профилактика травм." },
  weight:   { emoji: "⚖️",  label: "Снижение веса",       description: "Комфортное снижение веса." },
  vo2max:   { emoji: "🫁",  label: "Выносливость",        description: "Повышение аэробной мощности." },
  custom:   { emoji: "🎯",  label: "Индивидуальная цель", description: "Цель своими словами." },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(dateTo?: string | null) {
  if (!dateTo) return null;
  const end = new Date(dateTo);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

function daysLeftLabel(dateTo?: string | null) {
  const d = daysLeft(dateTo);
  if (d == null) return "Без даты";
  if (d < 0) return "Срок прошёл";
  if (d === 0) return "Сегодня";
  if (d === 1) return "1 день";
  if (d >= 2 && d <= 4) return `${d} дня`;
  return `${d} дней`;
}

function isDeadlineSoon(dateTo?: string | null) {
  const d = daysLeft(dateTo);
  return d != null && d >= 0 && d <= 7;
}

function formatSport(value?: string | null) {
  const map: Record<string, string> = {
    run: "Бег",
    ride: "Вело",
    swim: "Плавание",
    walk: "Ходьба",
    hike: "Хайк",
    strength: "Силовая",
    other: "Другое",
  };
  return value ? map[value] ?? value : "—";
}

function formatTargetTime(totalSec?: number | null) {
  if (!totalSec || totalSec <= 0) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function getGoalSummary(goal: GoalRow) {
  const target = goal.target_json ?? {};
  const time = formatTargetTime(target.target_time_s);
  if (target.race_name && time) return `${target.race_name} · цель ${time}`;
  if (target.race_name) return target.race_name;
  if (target.secondary?.trim()) return target.secondary.trim();
  if (goal.notes?.trim()) return goal.notes.trim();
  return TYPE_META[goal.type]?.description ?? "Цель помогает держать фокус.";
}

function getGoalProgress(goal: GoalRow) {
  const p = goal.progress_cache ?? {};
  const raw = [p.completion_pct, p.progress_pct, p.progress].find(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (typeof raw === "number") {
    const pct = Math.max(0, Math.min(100, Math.round(raw)));
    return { pct, label: "Выполнено" };
  }
  if (goal.date_from && goal.date_to) {
    const start = new Date(goal.date_from).getTime();
    const end = new Date(goal.date_to).getTime();
    const now = Date.now();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
      return { pct, label: "По сроку" };
    }
  }
  return { pct: null as number | null, label: null as string | null };
}

function pluralizeActive(n: number) {
  if (n === 1) return "активная цель";
  if (n >= 2 && n <= 4) return "активные цели";
  return "активных целей";
}

/** Бейдж статуса — фирменные rgba, у «Активна» лёгкая пульсирующая точка. */
function StatusPill({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(26,158,58,0.35)] bg-[rgba(197,237,208,0.55)] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(26,158,58)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgb(26,158,58)] opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(26,158,58)]" />
        </span>
        Активна
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(26,158,58,0.35)] bg-[rgba(197,237,208,0.55)] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(26,158,58)]">
        <CheckCircle2 className="size-3" />
        Завершена
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        Пауза
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        Черновик
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {status}
    </span>
  );
}

function PrimaryPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.45)] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(27,46,201)]">
      <Trophy className="size-3" />
      Главная
    </span>
  );
}

function PrimaryEyebrow() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.45)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[rgb(27,46,201)]">
      <Trophy className="size-3" />
      Главная цель
    </span>
  );
}

function ProgressBar({
  value,
  thick = false,
  completed = false,
}: {
  value: number;
  thick?: boolean;
  completed?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const isDone = completed || pct >= 100;
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        thick ? "h-2.5" : "h-2"
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          isDone ? "bg-[rgb(26,158,58)]" : "bg-[rgb(27,46,201)]"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getPriorityScore(goal: GoalRow) {
  const primary = goal.is_primary ? 10_000 : 0;
  const active = goal.status === "active" ? 1_000 : 0;
  const race = ["10k", "HM", "M", "trail"].includes(goal.type) ? 100 : 0;
  const date = goal.date_to ? -new Date(goal.date_to).getTime() / 1e11 : 0;
  return primary + active + race + date;
}

export default function GoalsList({
  goals,
  created = false,
  updated = false,
  goalCompleted = false,
  onAddGoal,
}: GoalsListProps) {
  const router = useRouter();

  const [items, setItems] = React.useState<GoalRow[]>(goals ?? []);
  const [editMode, setEditMode] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [pendingDeleteGoal, setPendingDeleteGoal] = React.useState<GoalRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!goalCompleted) return;
    import("canvas-confetti")
      .then((confetti) => {
        confetti.default({ particleCount: 140, spread: 85, origin: { y: 0.6 } });
      })
      .catch(() => {});
  }, [goalCompleted]);

  React.useEffect(() => {
    const justCompleted = items.some(
      (g) =>
        g.status === "completed" &&
        g.progress_cache?.completion_pct === 100 &&
        !localStorage.getItem(`goal_confetti_${g.id}`)
    );
    if (!justCompleted) return;
    import("canvas-confetti").then((confetti) => {
      confetti.default({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    });
    items.forEach((g) => {
      if (g.status === "completed") {
        localStorage.setItem(`goal_confetti_${g.id}`, "1");
      }
    });
  }, [items]);

  React.useEffect(() => {
    setItems(goals ?? []);
  }, [goals]);

  const sorted = React.useMemo(
    () => [...items].sort((a, b) => getPriorityScore(b) - getPriorityScore(a)),
    [items]
  );

  const activeGoals = sorted.filter((g) => g.status === "active");
  const completedGoals = sorted.filter((g) => g.status === "completed");
  const primaryGoal =
    activeGoals.find((g) => g.is_primary) ?? activeGoals[0] ?? null;
  const otherGoals = activeGoals.filter((g) => g.id !== primaryGoal?.id);
  const nearestGoal =
    [...activeGoals].sort(
      (a, b) => new Date(a.date_to).getTime() - new Date(b.date_to).getTime()
    )[0] ?? null;

  async function handleDelete(goalId?: string) {
    if (!goalId || deletingId) return;
    setDeletingId(goalId);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setItems((prev) => prev.filter((g) => g.id !== goalId));
      setPendingDeleteGoal(null);
    } catch (e) {
      console.error("goal delete error", e);
      setError("Не удалось удалить цель. Попробуй ещё раз.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMakePrimary(goal: GoalRow) {
    if (goal.is_primary) return;
    try {
      const res = await fetch(`/api/goals/${goal.id}/set-primary`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setItems((prev) => prev.map((g) => ({ ...g, is_primary: g.id === goal.id })));
    } catch (e) {
      console.error("make primary failed", e);
      setError("Не удалось сделать цель главной.");
    }
  }

  return (
    <section className="space-y-4">
      {created ? (
        <div className="rounded-2xl border border-[rgba(26,158,58,0.22)] bg-[rgba(197,237,208,0.55)] px-4 py-3 text-sm font-medium text-[rgb(26,158,58)]">
          Цель создана — теперь она будет учитываться в плане и календаре
        </div>
      ) : null}

      {updated ? (
        <div className="rounded-2xl border border-[rgba(27,46,201,0.22)] bg-[rgba(197,206,250,0.45)] px-4 py-3 text-sm font-medium text-[rgb(27,46,201)]">
          Цель обновлена — изменения уже учитываются в плане и календаре
        </div>
      ) : null}

      {items.length === 0 ? <GoalsEmptyState /> : null}

      {items.length > 0 ? (
        <Card className="overflow-hidden border bg-gradient-to-br from-[rgba(212,219,253,0.55)] via-card to-[rgba(209,193,228,0.28)] shadow-sm">
          <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular-nums">
                  {activeGoals.length}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {pluralizeActive(activeGoals.length)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {nearestGoal
                  ? `Ближайшая — ${
                      nearestGoal.title ||
                      TYPE_META[nearestGoal.type]?.label ||
                      "цель"
                    } · ${daysLeftLabel(nearestGoal.date_to)}`
                  : "Цели помогают связать план, календарь и тренировки"}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? "Готово" : "Редактировать"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onAddGoal?.()}
              >
                <Plus className="mr-1.5 size-4" />
                Добавить цель
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {primaryGoal ? (
        <GoalCard
          goal={primaryGoal}
          primary
          editMode={editMode}
          deleting={deletingId === primaryGoal.id}
          onDelete={() => setPendingDeleteGoal(primaryGoal)}
          onEdit={() => router.push(`/goals/onboarding?id=${primaryGoal.id}`)}
          onMakePrimary={() => handleMakePrimary(primaryGoal)}
        />
      ) : null}

      {otherGoals.length > 0 ? (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Остальные цели
            </h2>
            <span className="text-xs text-muted-foreground">
              · {otherGoals.length}
            </span>
          </div>
          <div
            className={cn(
              "grid gap-3",
              otherGoals.length === 1
                ? "grid-cols-1"
                : "md:grid-cols-2 xl:grid-cols-3"
            )}
          >
            {otherGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                editMode={editMode}
                deleting={deletingId === goal.id}
                onDelete={() => setPendingDeleteGoal(goal)}
                onEdit={() => router.push(`/goals/onboarding?id=${goal.id}`)}
                onMakePrimary={() => handleMakePrimary(goal)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {completedGoals.length > 0 ? (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[rgb(26,158,58)]" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              Выполненные цели
            </h2>
            <span className="text-xs text-muted-foreground">
              · {completedGoals.length}
            </span>
          </div>
          <div
            className={cn(
              "grid gap-3",
              completedGoals.length === 1
                ? "grid-cols-1"
                : "md:grid-cols-2 xl:grid-cols-3"
            )}
          >
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                editMode={editMode}
                deleting={deletingId === goal.id}
                onDelete={() => setPendingDeleteGoal(goal)}
                onEdit={() => router.push(`/goals/onboarding?id=${goal.id}`)}
                onMakePrimary={() => handleMakePrimary(goal)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmActionDialog
        open={!!pendingDeleteGoal}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDeleteGoal(null);
        }}
        title="Удалить цель?"
        description={`Это действие необратимо.${
          pendingDeleteGoal?.title
            ? ` Цель «${pendingDeleteGoal.title}» будет удалена.`
            : ""
        }`}
        confirmLabel={deletingId ? "Удаляем…" : "Удалить"}
        cancelLabel="Отмена"
        confirmVariant="danger"
        isLoading={!!deletingId}
        onConfirm={() => handleDelete(pendingDeleteGoal?.id)}
      />
    </section>
  );
}

function GoalCard({
  goal,
  primary = false,
  editMode,
  deleting,
  onDelete,
  onEdit,
  onMakePrimary,
}: {
  goal: GoalRow;
  primary?: boolean;
  editMode: boolean;
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMakePrimary: () => void;
}) {
  const meta = TYPE_META[goal.type] ?? TYPE_META.custom;
  const progress = getGoalProgress(goal);
  const summary = getGoalSummary(goal);
  const isCompleted = goal.status === "completed";
  const deadlineSoon = !isCompleted && isDeadlineSoon(goal.date_to);
  const showsPrimaryPill = !primary && goal.is_primary && !isCompleted;

  // HERO
  if (primary) {
    return (
      <Card className="overflow-hidden border bg-gradient-to-br from-[rgba(212,219,253,0.45)] via-card to-[rgba(255,246,232,0.35)] shadow-sm">
        <CardContent className="space-y-5 p-6">
          {/* Шапка: «значок» эмодзи слева + контент, статус справа */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[rgba(27,46,201,0.18)] bg-[rgba(197,206,250,0.55)] text-3xl shadow-sm">
                {meta.emoji}
              </div>
              <div className="min-w-0 space-y-2">
                <PrimaryEyebrow />
                <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                  {goal.title || meta.label}
                </h2>
                <p className="text-sm font-medium text-muted-foreground">
                  {meta.label}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <StatusPill status={goal.status} />
            </div>
          </div>

          {summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          ) : null}

          {/* Прогресс — крупная цифра справа, бар внизу */}
          {progress.pct != null ? (
            <div className="space-y-2 border-t border-border/70 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {progress.label}
                </span>
                <div className="flex items-baseline gap-0.5 tabular-nums">
                  <span className="text-3xl font-extrabold leading-none">
                    {progress.pct}
                  </span>
                  <span className="text-base font-semibold text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <ProgressBar value={progress.pct} thick completed={isCompleted} />
            </div>
          ) : null}

          {/* Мета — инлайн, без коробок и пилюль */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 shrink-0 opacity-70" />
              <span className="font-semibold text-foreground">
                {formatDate(goal.date_to)}
              </span>
            </span>

            <span aria-hidden className="opacity-40">·</span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                deadlineSoon && "text-[rgb(229,139,33)]"
              )}
            >
              <Timer className="size-4 shrink-0 opacity-70" />
              <span
                className={cn(
                  "font-semibold",
                  !deadlineSoon && "text-foreground"
                )}
              >
                {daysLeftLabel(goal.date_to)}
              </span>
            </span>

            {goal.sport ? (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Flag className="size-4 shrink-0 opacity-70" />
                  <span className="font-semibold text-foreground">
                    {formatSport(goal.sport)}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        </CardContent>

        {editMode ? (
          <EditFooter
            goal={goal}
            primary
            deleting={deleting}
            onDelete={onDelete}
            onEdit={onEdit}
            onMakePrimary={onMakePrimary}
          />
        ) : null}
      </Card>
    );
  }

  // КОМПАКТНАЯ
  return (
    <Card
      className={cn(
        "group flex h-full flex-col border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[rgba(27,46,201,0.22)]",
        isCompleted &&
          "border-[rgba(26,158,58,0.25)] bg-gradient-to-br from-[rgba(197,237,208,0.4)] via-card to-[rgba(255,246,232,0.3)] hover:border-[rgba(26,158,58,0.35)]"
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm transition-colors",
              isCompleted
                ? "border border-[rgba(26,158,58,0.22)] bg-[rgba(197,237,208,0.6)]"
                : "border border-[rgba(27,46,201,0.18)] bg-[rgba(197,206,250,0.45)] group-hover:bg-[rgba(212,219,253,0.7)]"
            )}
          >
            {meta.emoji}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {showsPrimaryPill ? <PrimaryPill /> : null}
            <StatusPill status={goal.status} />
          </div>
        </div>

        <div className="min-w-0 space-y-0.5">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug">
            {goal.title || meta.label}
          </h3>
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {meta.label}
          </p>
        </div>

        {summary ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {summary}
          </p>
        ) : null}

        <div className="flex-1" />

        {progress.pct != null ? (
          <div className="space-y-1.5 border-t border-border/70 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {progress.label}
              </span>
              <div className="flex items-baseline gap-0.5 tabular-nums">
                <span className="text-lg font-extrabold leading-none">
                  {progress.pct}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <ProgressBar value={progress.pct} completed={isCompleted} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 shrink-0 opacity-70" />
            <span className="font-medium text-foreground">
              {formatDate(goal.date_to)}
            </span>
          </span>
          {goal.date_to ? (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  deadlineSoon && "font-semibold text-[rgb(229,139,33)]"
                )}
              >
                <Timer className="size-3 shrink-0 opacity-70" />
                {daysLeftLabel(goal.date_to)}
              </span>
            </>
          ) : null}
          {goal.sport ? (
            <>
              <span aria-hidden className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <Flag className="size-3 shrink-0 opacity-70" />
                <span className="font-medium text-foreground">
                  {formatSport(goal.sport)}
                </span>
              </span>
            </>
          ) : null}
        </div>
      </CardContent>

      {editMode ? (
        <EditFooter
          goal={goal}
          deleting={deleting}
          onDelete={onDelete}
          onEdit={onEdit}
          onMakePrimary={onMakePrimary}
        />
      ) : null}
    </Card>
  );
}

function EditFooter({
  goal,
  primary = false,
  deleting,
  onDelete,
  onEdit,
  onMakePrimary,
}: {
  goal: GoalRow;
  primary?: boolean;
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMakePrimary: () => void;
}) {
  return (
    <CardFooter className="mt-auto flex flex-wrap justify-between gap-2 border-t bg-muted/10 px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {goal.status !== "completed" && !goal.is_primary && !primary ? (
          <Button type="button" variant="secondary" size="sm" onClick={onMakePrimary}>
            <Trophy className="mr-1.5 size-4" />
            Сделать главной
          </Button>
        ) : null}

        {goal.status !== "completed" ? (
          <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 size-4" />
            Редактировать
          </Button>
        ) : null}
      </div>

      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={deleting}
        onClick={onDelete}
      >
        {deleting ? "Удаляем…" : "Удалить"}
      </Button>
    </CardFooter>
  );
}