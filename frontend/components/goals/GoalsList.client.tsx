// frontend/components/goals/GoalsList.client.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import {
  CalendarDays,
  Flag,
  Pencil,
  Plus,
  Target,
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
};

const TYPE_META: Record<string, { emoji: string; label: string; description: string }> = {
  "10k": { emoji: "💨", label: "Забег 10 км", description: "Скорость и устойчивость на десятке." },
  HM: { emoji: "🏁", label: "Полумарафон", description: "21,1 км с контролем нагрузки." },
  M: { emoji: "🧱", label: "Марафон", description: "Большая цель сезона." },
  trail: { emoji: "⛰️", label: "Трейл", description: "Набор высоты, техника и терпение." },
  ride: { emoji: "🚴‍♂️", label: "Вело", description: "Выносливость и сила ног." },
  swim: { emoji: "🏊‍♂️", label: "Плавание", description: "Техника, дыхание и работа на воде." },
  strength: { emoji: "🏋️‍♂️", label: "Силовая", description: "Мышцы, стабильность и профилактика травм." },
  weight: { emoji: "⚖️", label: "Снижение веса", description: "Комфортное снижение веса." },
  vo2max: { emoji: "🫁", label: "Выносливость", description: "Повышение аэробной мощности." },
  custom: { emoji: "🎯", label: "Индивидуальная цель", description: "Цель своими словами." },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function deadlineLabel(dateTo?: string | null) {
  const d = daysLeft(dateTo);
  if (d == null) return "Без даты";
  if (d < 0) return "Завершена";
  if (d === 0) return "Сегодня";
  if (d <= 7) return "Финиш близко";
  if (d <= 30) return "Фокус месяца";
  return "В работе";
}

function deadlineBadgeClass(dateTo?: string | null) {
  const d = daysLeft(dateTo);
  if (d == null) return "border-border bg-muted/30 text-muted-foreground";
  if (d < 0) return "border-border bg-muted/30 text-muted-foreground";
  if (d <= 7) {
    return "border-[rgba(41,73,246,0.22)] bg-[rgba(212,219,253,0.72)] text-[rgb(41,73,246)]";
  }
  if (d <= 30) {
    return "border-[rgba(229,139,33,0.25)] bg-[rgba(255,246,232,0.85)] text-[rgb(229,139,33)]";
  }
  return "border-[rgba(27,46,201,0.20)] bg-[rgba(197,206,250,0.45)] text-[rgb(27,46,201)]";
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
    return { pct, label: `${pct}% выполнено` };
  }

  if (goal.date_from && goal.date_to) {
    const start = new Date(goal.date_from).getTime();
    const end = new Date(goal.date_to).getTime();
    const now = Date.now();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
      return { pct, label: "Прогресс по сроку" };
    }
  }

  return { pct: null, label: null };
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" className="border-[rgba(26,158,58,0.35)] bg-[rgba(197,237,208,0.55)] text-[rgb(26,158,58)]">
          Активна
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="border-[rgba(26,158,58,0.35)] bg-[rgba(197,237,208,0.55)] text-[rgb(26,158,58)]">
          Завершена
        </Badge>
      );
    case "paused":
      return <Badge variant="secondary">Пауза</Badge>;
    case "draft":
      return <Badge variant="secondary">Черновик</Badge>;
    case "canceled":
      return <Badge variant="outline">Отменена</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-[rgb(26,158,58)]" : "bg-[rgb(27,46,201)]"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MetaPill({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
      {icon}
      <span>{children}</span>
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
        confetti.default({
          particleCount: 140,
          spread: 85,
          origin: { y: 0.6 },
        });
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
      confetti.default({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
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
  const primaryGoal = sorted.find((g) => g.is_primary) ?? activeGoals[0] ?? sorted[0] ?? null;
  const otherGoals = activeGoals.filter((g) => g.id !== primaryGoal?.id);
  const nearestGoal =
    [...activeGoals].sort((a, b) => new Date(a.date_to).getTime() - new Date(b.date_to).getTime())[0] ?? null;

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

      {items.length > 0 ? (
        <Card className="overflow-hidden border bg-gradient-to-br from-[rgba(212,219,253,0.55)] via-card to-[rgba(209,193,228,0.28)] shadow-sm">
          <CardContent className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {activeGoals.length} активн{activeGoals.length === 1 ? "ая цель" : activeGoals.length < 5 ? "ые цели" : "ых целей"}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {nearestGoal
                  ? `Ближайшая — ${nearestGoal.title || TYPE_META[nearestGoal.type]?.label || "цель"} · ${daysLeftLabel(nearestGoal.date_to)}`
                  : "Цели помогают связать план, календарь и тренировки"}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode((v) => !v)}>
                {editMode ? "Готово" : "Редактировать"}
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => onAddGoal?.()}>
                <Plus className="mr-1.5 size-4" />
                Добавить цель
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <Card className="overflow-hidden border border-dashed bg-card/95">
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(197,237,208,0.65)] text-2xl">
              🎯
            </div>
            <div className="text-xl font-extrabold">Создайте первую цель</div>
            <div className="mt-2 max-w-md text-sm text-muted-foreground">
              Выберите спортивный фокус: просто начать, улучшить выносливость, подготовиться к забегу или описать свою цель.
            </div>
            <Button type="button" variant="primary" className="mt-5" onClick={() => onAddGoal?.()}>
              <Plus className="mr-2 size-4" />
              Создать цель
            </Button>
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
        <div className="space-y-2">
          <div className="text-sm font-semibold">Остальные цели</div>
          <div
            className={cn(
              "grid gap-3",
              otherGoals.length === 1 ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3"
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
        <div className="space-y-2 pt-4">
          <div className="text-sm font-semibold text-muted-foreground">
            Выполненные цели
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        description={`Это действие необратимо.${pendingDeleteGoal?.title ? ` Цель «${pendingDeleteGoal.title}» будет удалена.` : ""}`}
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

  return (
    <Card
      className={cn(
        "flex h-full flex-col border bg-card text-card-foreground shadow-sm transition-all",
        goal.status === "completed" &&
          "bg-gradient-to-br from-[rgba(197,237,208,0.6)] via-white to-[rgba(255,246,232,0.6)] border-[rgba(26,158,58,0.35)]",
        !primary && "hover:-translate-y-0.5 hover:shadow-md",
        primary && "overflow-hidden"
      )}
    >
      <CardContent className={cn("flex-1 space-y-3", primary ? "p-4" : "px-4 py-3.5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl bg-muted/30",
                primary ? "size-12 text-2xl" : "size-9 text-lg"
              )}
            >
              {meta.emoji}
            </div>

            <div className="min-w-0">
              <div className={cn("truncate font-semibold leading-tight", primary ? "text-lg" : "text-sm")}>
                {goal.title || meta.label}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta.label}</div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {primary || goal.is_primary ? (
              <Badge variant="outline" className="border-[rgba(27,46,201,0.25)] bg-[rgba(197,206,250,0.45)] text-[rgb(27,46,201)]">
                Главная
              </Badge>
            ) : null}
            {statusBadge(goal.status)}
          </div>
        </div>

        {primary ? (
          <div className="line-clamp-2 text-sm text-muted-foreground">{summary}</div>
        ) : summary ? (
          <div className="line-clamp-2 text-[11px] text-muted-foreground">{summary}</div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <MetaPill icon={<CalendarDays className="size-3.5" />}>
            {formatDate(goal.date_from)} — {formatDate(goal.date_to)}
          </MetaPill>
          <MetaPill icon={<Timer className="size-3.5" />}>{daysLeftLabel(goal.date_to)}</MetaPill>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              deadlineBadgeClass(goal.date_to)
            )}
          >
            <Target className="size-3.5" />
            <span>{deadlineLabel(goal.date_to)}</span>
          </div>
          {goal.sport ? <MetaPill icon={<Flag className="size-3.5" />}>{formatSport(goal.sport)}</MetaPill> : null}
        </div>

        {progress.pct != null ? (
          <div className={cn("space-y-1.5", primary && "max-w-none")}>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{progress.label ?? "Прогресс"}</span>
              <span>{progress.pct}%</span>
            </div>
            <ProgressBar value={progress.pct} />
          </div>
        ) : null}
      </CardContent>

      {editMode ? (
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

          <Button type="button" variant="danger" size="sm" disabled={deleting} onClick={onDelete}>
            {deleting ? "Удаляем…" : "Удалить"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}