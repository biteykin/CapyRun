// components/goals/GoalsList.client.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  Gauge,
  Plus,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from "lucide-react";

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

type GoalTargetProfile = {
  gender?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
};

type GoalTarget = {
  primary?: string;
  secondary?: string;
  race_name?: string;
  target_time_s?: number;
  profile?: GoalTargetProfile;
};

type GoalsListProps = {
  goals: GoalRow[];
  /** Нажатие на "Добавить цель" — страница сама решает, как открыть онбординг */
  onAddGoal?: () => void;
};

const TYPE_META: Record<
  string,
  { emoji: string; label: string; description: string }
> = {
  "10k": {
    emoji: "💨",
    label: "Забег 10 км",
    description: "Тренировки под десятку — скорость и устойчивость.",
  },
  HM: {
    emoji: "🏁",
    label: "Полумарафон",
    description: "Подготовка к 21.1 км с контролем нагрузки.",
  },
  M: {
    emoji: "🧱",
    label: "Марафон",
    description: "Долгосрочная цель, требующая системности.",
  },
  trail: {
    emoji: "⛰️",
    label: "Трейл",
    description: "Набор высоты, техника и терпение.",
  },
  ride: {
    emoji: "🚴‍♂️",
    label: "Вело",
    description: "Сила ног и выносливость для велосипеда.",
  },
  swim: {
    emoji: "🏊‍♂️",
    label: "Плавание",
    description: "Техника, дыхание, работа на воде.",
  },
  strength: {
    emoji: "🏋️‍♂️",
    label: "Силовая подготовка",
    description: "Мышцы, стабильность, защита от травм.",
  },
  weight: {
    emoji: "⚖️",
    label: "Снижение веса",
    description: "Комфортное снижение веса и улучшение самочувствия.",
  },
  vo2max: {
    emoji: "🫁",
    label: "VO₂max / выносливость",
    description: "Работа на повышение аэробной мощности.",
  },
  custom: {
    emoji: "🎯",
    label: "Индивидуальная цель",
    description: "Пользовательская формулировка, завязанная под тебя.",
  },
};

function formatDateRange(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  };
  return `${f.toLocaleDateString("ru-RU", opts)} — ${t.toLocaleDateString(
    "ru-RU",
    opts
  )}`;
}

function formatDateShort(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysLeft(dateTo?: string | null): number | null {
  if (!dateTo) return null;
  const end = new Date(dateTo);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function daysLeftLabel(dateTo?: string | null): string {
  const diffDays = daysLeft(dateTo);
  if (diffDays == null) return "Без даты";
  if (diffDays < 0) return "Срок прошёл";
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "1 день";
  if (diffDays >= 2 && diffDays <= 4) return `${diffDays} дня`;
  return `${diffDays} дней`;
}

function formatSport(value?: string | null): string {
  const map: Record<string, string> = {
    run: "Бег",
    ride: "Вело",
    swim: "Плавание",
    walk: "Ходьба",
    hike: "Хайк",
    row: "Гребля",
    strength: "Силовая",
    yoga: "Йога",
    aerobics: "Аэробика",
    crossfit: "Кроссфит",
    pilates: "Пилатес",
    other: "Другая",
  };
  if (!value) return "—";
  return map[value] ?? value;
}

function getGoalPriorityScore(goal: GoalRow): number {
  const statusBoost =
    goal.status === "active" ? 1000 :
    goal.status === "draft" ? 200 :
    goal.status === "paused" ? 100 :
    0;

  const dateBoost = goal.date_to ? -new Date(goal.date_to).getTime() / 1e11 : 0;
  const raceBoost = ["10k", "HM", "M", "trail"].includes(goal.type) ? 100 : 0;

  return statusBoost + raceBoost + dateBoost;
}

function formatTargetTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function getGoalSummary(goal: GoalRow): string {
  const t = goal.target_json ?? {};
  const days = daysLeft(goal.date_to);

  if (t?.race_name) {
    const targetTime =
      typeof t.target_time_s === "number" && t.target_time_s > 0
        ? formatTargetTime(t.target_time_s)
        : null;
    return targetTime
      ? `${t.race_name} · цель ${targetTime}`
      : String(t.race_name);
  }

  if (days !== null && days <= 7) {
    return "Финальный этап подготовки. Снижаем нагрузку и готовимся к цели.";
  }

  if (days !== null && days <= 30) {
    return "Ключевой период подготовки. Важно держать стабильность.";
  }

  if (typeof t?.primary === "string" && t.primary.trim()) {
    return t.primary.trim();
  }

  if (typeof t?.secondary === "string" && t.secondary.trim()) {
    return t.secondary.trim();
  }

  if (typeof goal.notes === "string" && goal.notes.trim()) {
    return goal.notes.trim();
  }

  return TYPE_META[goal.type]?.description ?? "Цель помогает держать фокус в тренировках";
}

function getGoalProgress(goal: GoalRow): { pct: number | null; label: string | null } {
  const p = goal.progress_cache ?? {};
  const candidates = [p.completion_pct, p.progress_pct, p.progress];
  const raw = candidates.find((v) => typeof v === "number" && Number.isFinite(v));
  const pct =
    typeof raw === "number" ? Math.max(0, Math.min(100, Math.round(raw))) : null;

  if (pct != null) return { pct, label: `${pct}% выполнено` };

  // fallback: считаем прогресс по времени
  if (goal.date_from && goal.date_to) {
    const start = new Date(goal.date_from).getTime();
    const end = new Date(goal.date_to).getTime();
    const now = Date.now();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const timePct = ((now - start) / (end - start)) * 100;
      const clamped = Math.max(0, Math.min(100, timePct));
      return {
        pct: Math.round(clamped),
        label: "Прогресс по плану",
      };
    }
  }

  if (typeof p.fitness_score === "number" && Number.isFinite(p.fitness_score)) {
    return {
      pct: Math.max(0, Math.min(100, Math.round(p.fitness_score))),
      label: `Форма ${Math.round(p.fitness_score)}/100`,
    };
  }

  return { pct: null, label: null };
}

function getGoalHealthTone(goal: GoalRow): { label: string; className: string } {
  const d = daysLeft(goal.date_to);
  if (goal.status !== "active") {
    return {
      label: "Не активна",
      className: "border-border bg-muted/30 text-muted-foreground",
    };
  }
  if (d == null) {
    return {
      label: "В работе",
      className: "border-[rgba(27,46,201,0.18)] bg-[rgba(197,206,250,0.35)] text-[rgb(27,46,201)]",
    };
  }
  if (d <= 7) {
    return {
      label: "Скоро цель",
      className: "border-[rgba(230,0,18,0.18)] bg-[rgba(255,204,204,0.55)] text-[rgb(230,0,18)]",
    };
  }
  if (d <= 30) {
    return {
      label: "Фокус месяца",
      className: "border-[rgba(255,214,0,0.25)] bg-[rgba(255,245,176,0.75)] text-[rgb(201,168,0)]",
    };
  }
  return {
    label: "Идём по плану",
    className: "border-[rgba(26,158,58,0.18)] bg-[rgba(197,237,208,0.65)] text-[rgb(26,158,58)]",
  };
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/70 bg-emerald-500/5 text-emerald-700"
        >
          Активна
        </Badge>
      );
    case "draft":
      return <Badge variant="secondary">Черновик</Badge>;
    case "paused":
      return <Badge variant="secondary">Пауза</Badge>;
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-[color:var(--btn-primary-main,#E58B21)] bg-[color:var(--btn-primary-bg,#FFF6E8)] text-[color:var(--btn-primary-main,#E58B21)]"
        >
          Завершена
        </Badge>
      );
    case "canceled":
      return <Badge variant="outline">Отменена</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function GoalsList({ goals, onAddGoal }: GoalsListProps) {
  const [items, setItems] = React.useState<GoalRow[]>(goals ?? []);
  const [editMode, setEditMode] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDeleteGoal, setPendingDeleteGoal] = React.useState<GoalRow | null>(null);

  // синхронизация при обновлении пропсов
  React.useEffect(() => {
    setItems(goals ?? []);
  }, [goals]);

  if (!items || items.length === 0) return null;
  const sorted = React.useMemo(() => {
    return [...items].sort((a, b) => {
      // 1. primary first
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;

      // 2. active next
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;

      return new Date(a.date_to).getTime() - new Date(b.date_to).getTime();
    });
  }, [items]);
  const activeGoals = sorted.filter((g) => g.status === "active");
  const primaryGoal = activeGoals[0] ?? sorted[0] ?? null;
  const otherGoals = sorted.filter((g) => g.id !== primaryGoal?.id);
  const nearestGoal =
    [...activeGoals]
      .filter((g) => g.date_to)
      .sort((a, b) => new Date(a.date_to).getTime() - new Date(b.date_to).getTime())[0] ?? null;

  async function handleDelete(goalId?: string) {
    if (!goalId) return;

    if (deletingId) return;

    setDeletingId(goalId);
    setError(null);

    try {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;

      // локально убираем цель из списка
      setItems((prev) => prev.filter((g) => g.id !== goalId));
      setPendingDeleteGoal(null);
    } catch (e: unknown) {
      console.error("goal delete error", e);
      setError("Не удалось удалить цель. Попробуй ещё раз.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMakePrimary(goal: GoalRow) {
    if (goal.is_primary) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("no user");

      await supabase
        .from("goals")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("is_primary", true);

      const { error } = await supabase
        .from("goals")
        .update({ is_primary: true })
        .eq("id", goal.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((g) => ({
          ...g,
          is_primary: g.id === goal.id,
        }))
      );
    } catch (e) {
      console.error("make primary failed", e);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border bg-gradient-to-br from-[rgba(255,214,0,0.10)] via-background to-[rgba(27,46,201,0.05)]">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                Сезон и фокус
              </div>
              <div className="text-2xl font-extrabold leading-tight">
                {activeGoals.length > 0
                  ? `${activeGoals.length} активн${activeGoals.length === 1 ? "ая цель" : activeGoals.length < 5 ? "ые цели" : "ых целей"}`
                  : "Поставьте первую цель"}
              </div>
              <div className="text-sm text-muted-foreground">
                {nearestGoal
                  ? `Ближайшая цель — ${nearestGoal.title || TYPE_META[nearestGoal.type]?.label || "цель"} · ${daysLeftLabel(nearestGoal.date_to)}`
                  : "Цели помогают связать план, календарь и реальные тренировки в один сезон"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                variant="secondary"
                size="sm"
                onClick={() => onAddGoal?.()}
              >
                <Plus className="mr-2 size-4" />
                Добавить цель
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {primaryGoal && (
        <Card className="overflow-hidden border bg-card/95 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-semibold">
                    <Trophy className="size-3.5" />
                    Главный фокус
                  </span>
                  {statusBadge(primaryGoal.status)}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                      getGoalHealthTone(primaryGoal).className
                    )}
                  >
                    {getGoalHealthTone(primaryGoal).label}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-3xl">
                    {(TYPE_META[primaryGoal.type] ?? TYPE_META.custom).emoji}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xl font-bold leading-tight">
                      {primaryGoal.title || (TYPE_META[primaryGoal.type] ?? TYPE_META.custom).label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getGoalSummary(primaryGoal)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <MetaPill icon={<CalendarDays className="size-3.5" />}>
                    {formatDateRange(primaryGoal.date_from, primaryGoal.date_to)}
                  </MetaPill>
                  <MetaPill icon={<Timer className="size-3.5" />}>
                    {daysLeftLabel(primaryGoal.date_to)}
                  </MetaPill>
                  <MetaPill icon={<Target className="size-3.5" />}>
                    {(TYPE_META[primaryGoal.type] ?? TYPE_META.custom).label}
                  </MetaPill>
                  {primaryGoal.sport ? (
                    <MetaPill icon={<Flag className="size-3.5" />}>
                      {formatSport(primaryGoal.sport)}
                    </MetaPill>
                  ) : null}
                </div>

                {getGoalProgress(primaryGoal).pct != null ? (
                  <div className="max-w-xl space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {getGoalProgress(primaryGoal).label}
                      </span>
                      <span className="text-muted-foreground">
                        {getGoalProgress(primaryGoal).pct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[rgb(27,46,201)] transition-all"
                        style={{ width: `${getGoalProgress(primaryGoal).pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {editMode ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="border-destructive/70 text-destructive hover:bg-destructive/10"
                    disabled={deletingId === primaryGoal.id || !!pendingDeleteGoal}
                    onClick={() => setPendingDeleteGoal(primaryGoal)}
                  >
                    {deletingId === primaryGoal.id ? "Удаляем…" : "Удалить"}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {otherGoals.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Остальные цели</div>
          <div
            className="grid w-full gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            {otherGoals.map((g) => {
          const meta = TYPE_META[g.type] ?? TYPE_META["custom"];
          const target = (g.target_json ?? {}) as GoalTarget;
          const primary: string | null =
            target.primary && typeof target.primary === "string"
              ? target.primary
              : null;
          const secondary: string | null =
            target.secondary && typeof target.secondary === "string"
              ? target.secondary
              : null;

          const profile = target.profile ?? {};
          const profileLineParts: string[] = [];
          if (profile.gender === "male") profileLineParts.push("мужчина");
          if (profile.gender === "female") profileLineParts.push("женщина");
          if (profile.age) profileLineParts.push(`${profile.age} лет`);
          if (profile.height_cm)
            profileLineParts.push(`${profile.height_cm} см`);
          if (profile.weight_kg)
            profileLineParts.push(`${profile.weight_kg} кг`);

          const profileLine =
            profileLineParts.length > 0
              ? profileLineParts.join(", ")
              : null;

          return (
            <Card
              key={g.id}
              className={cn(
                "flex h-full flex-col border bg-card/95 text-card-foreground shadow-sm transition-all",
                "hover:-translate-y-0.5",
                g.is_primary && "ring-2 ring-primary/30",
                g.status === "active" && "shadow-[0_0_0_1px_rgba(27,46,201,0.15)]",
                daysLeft(g.date_to) !== null &&
                  daysLeft(g.date_to)! <= 7 &&
                  "animate-pulse"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-2xl">{meta.emoji}</div>
                    <div>
                      <CardTitle className="text-sm">
                        {g.title || meta.label}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        {getGoalSummary(g)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(g.status)}
                    {g.is_primary ? (
                      <Badge className="bg-primary text-primary-foreground">
                        Главная
                      </Badge>
                    ) : null}
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {daysLeftLabel(g.date_to)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pb-4 text-xs">
                <div className="flex flex-wrap gap-2">
                  <MetaPill icon={<CalendarDays className="size-3.5" />}>
                    {formatDateShort(g.date_from)} — {formatDateShort(g.date_to)}
                  </MetaPill>
                  <MetaPill icon={<Gauge className="size-3.5" />}>
                    {getGoalHealthTone(g).label}
                  </MetaPill>
                </div>

                {getGoalProgress(g).pct != null ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {getGoalProgress(g).label}
                      </span>
                      <span className="font-medium">{getGoalProgress(g).pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[rgb(27,46,201)] transition-all"
                        style={{ width: `${getGoalProgress(g).pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {primary && (
                  <p className="text-foreground">
                    <span className="font-medium">Формулировка:</span>{" "}
                    {primary}
                  </p>
                )}
                {secondary && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-xs">
                      Доп. цели:&nbsp;
                    </span>
                    <span className="text-[11px]">{secondary}</span>
                  </p>
                )}
                {profileLine && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium">Профиль:</span>{" "}
                    {profileLine}
                  </p>
                )}
                {!primary && !secondary && !profileLine && (
                  <p className="text-[11px] text-muted-foreground">
                    Детали цели можно будет уточнить позже.
                  </p>
                )}
              </CardContent>

              {!editMode ? (
                <CardFooter className="mt-auto border-t bg-muted/10 px-4 py-3">
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    Смотреть подробнее
                    <ChevronRight className="size-3.5" />
                  </div>
                </CardFooter>
              ) : null}

              {editMode && (
                <CardFooter className="mt-auto flex justify-between gap-2 border-t bg-muted/20 px-4 py-2">
                  {g.status === "active" && !g.is_primary ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleMakePrimary(g)}
                    >
                      Сделать главной
                    </Button>
                  ) : <div />}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      "border-destructive/70 text-destructive hover:bg-destructive/10"
                    )}
                    disabled={deletingId === g.id || !!pendingDeleteGoal}
                    onClick={() => setPendingDeleteGoal(g)}
                  >
                    {deletingId === g.id ? "Удаляем…" : "Удалить"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
            })}
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

function MetaPill(props: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}