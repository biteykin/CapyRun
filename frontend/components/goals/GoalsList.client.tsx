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

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  status: string;
  date_from: string;
  date_to: string;
  target_json: any;
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
    } catch (e: any) {
      console.error("goal delete error", e);
      setError("Не удалось удалить цель. Попробуй ещё раз.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-3">
      {/* Заголовок, описание и кнопки */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">Мои цели</h2>
          <p className="text-xs text-muted-foreground">
            Можно иметь несколько целей одновременно — долгосрочные и локальные.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              // просто включаем / выключаем локальный режим редактирования
              setEditMode((v) => !v);
            }}
          >
            {editMode ? "Готово" : "Редактировать"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onAddGoal?.()}
          >
            Добавить цель
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Адаптивная сетка карточек на всю ширину */}
      <div
        className="grid w-full gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {items.map((g) => {
          const meta = TYPE_META[g.type] ?? TYPE_META["custom"];
          const target = g.target_json ?? {};
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
              className="flex h-full flex-col border bg-card/95 text-card-foreground shadow-sm"
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
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(g.status)}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateRange(g.date_from, g.date_to)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 pb-4 text-xs">
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

              {editMode && (
                <CardFooter className="mt-auto flex justify-end border-t bg-muted/20 px-4 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
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