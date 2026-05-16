// frontend/components/plans/PlansCalendar.client.tsx

"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  Bike,
  Check,
  Dumbbell,
  Footprints,
  GripVertical,
  Mountain,
  Trophy,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PlanEvent = {
  id: string | number;
  /** ISO дата YYYY-MM-DD */
  date: string;
  title: string;
  colorHex?: string;      // цвет рамки / заливки
  description?: string | null;
  kind?: "planned" | "workout" | "goal";
  status?: string | null;
  sport?: string | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  structure?: any;
  notes?: string | null;
  goal?: string | null;
  main?: string | null;
  warmup?: string | null;
  cooldown?: string | null;
  effort?: string | null;
  hr_target?: string | null;
  strength_block?: string | null;
  steps?: any[] | null;
  planned_duration_min?: number | null;
  planned_distance_km?: number | null;
  goal_icon?: string | null;
  isCompleted?: boolean;  // Флаг, который выставляем в Host
  [key: string]: any;
};

export type PlansCalendarProps = {
  events?: PlanEvent[];
  initialMonth?: Date;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (evt: PlanEvent) => void;
  onEventDrop?: (evt: PlanEvent, isoDate: string) => void;
  className?: string;
  activeGoal?: {
    date_to?: string | null;
    type?: string | null;
  } | null;
};

const RU = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});
const RU_SHORT_WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// YYYY-MM-DD
function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function getDaysGrid(viewDate: Date): Date[] {
  // сетка начиная с понедельника.
  // Не рисуем верхнюю/нижнюю неделю, если она полностью относится
  // к соседнему месяцу.
  const first = startOfMonth(viewDate);
  const weekday = (first.getDay() + 6) % 7; // 0..6, где 0=Пн
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - weekday);

  const last = endOfMonth(viewDate);
  const daysCount = weekday + last.getDate();
  const weeksCount = Math.ceil(daysCount / 7);
  const totalCells = weeksCount * 7;

  const days: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const month = viewDate.getMonth();
  const firstWeek = days.slice(0, 7);
  if (firstWeek.length === 7 && firstWeek.every((d) => d.getMonth() !== month)) {
    days.splice(0, 7);
  }

  const lastWeek = days.slice(-7);
  if (lastWeek.length === 7 && lastWeek.every((d) => d.getMonth() !== month)) {
    days.splice(-7, 7);
  }

  return days;
}

function getEventMetaLine(e: PlanEvent): string | null {
  if (e.kind === "goal") {
    return e.description ?? "Цель";
  }

  if (e.kind === "workout") {
    if (e.distance_m && e.distance_m > 0) return `${(e.distance_m / 1000).toFixed(1)} км`;
    if (e.duration_sec && e.duration_sec > 0) return `${Math.round(e.duration_sec / 60)} мин`;
    return e.sport ? String(e.sport) : null;
  }

  if (e.planned_distance_km && e.planned_distance_km > 0) {
    return `${Number(e.planned_distance_km).toFixed(1)} км`;
  }
  if (e.planned_duration_min && e.planned_duration_min > 0) {
    return `${Math.round(Number(e.planned_duration_min))} мин`;
  }
  if (e.sport === "strength" && e.strength_block) return "ОФП";
  return e.goal ?? e.sport ?? null;
}

function getEventTooltip(e: PlanEvent, canDrag: boolean): string {
  if (e.kind === "goal") {
    return `Цель: ${e.title}`;
  }

  if (e.kind === "planned" && e.status === "completed") {
    return "План выполнен";
  }

  if (e.kind === "planned" && e.status === "missed") {
    return "План пропущен";
  }

  if (e.kind === "planned") {
    return canDrag
      ? "Запланировано. Можно перетащить на другую дату"
      : "Запланированная тренировка";
  }

  if (e.kind === "workout" || e.isCompleted) {
    return "Выполненная тренировка";
  }

  return e.title;
}

type EventVariant =
  | "goal"
  | "planned-completed"
  | "planned-missed"
  | "planned"
  | "workout"
  | "default";

function getEventVariant(e: PlanEvent): EventVariant {
  if (e.kind === "goal") return "goal";
  if (e.kind === "planned" && e.status === "completed") return "planned-completed";
  if (e.status === "missed") return "planned-missed";
  if (e.kind === "planned") return "planned";
  if (e.isCompleted) return "workout";
  return "default";
}

function getSportIcon(
  sport?: string | null,
): React.ComponentType<{ className?: string }> {
  switch (sport) {
    case "run":
    case "walk":
      return Footprints;
    case "ride":
      return Bike;
    case "swim":
      return Waves;
    case "hike":
      return Mountain;
    case "strength":
      return Dumbbell;
    default:
      return Activity;
  }
}

function getEventChips(e: PlanEvent): string[] {
  const chips: string[] = [];
  if (e.kind === "workout") {
    if (e.distance_m && e.distance_m > 0) {
      chips.push(`${(e.distance_m / 1000).toFixed(1)} км`);
    }
    if (e.duration_sec && e.duration_sec > 0) {
      chips.push(`${Math.round(e.duration_sec / 60)} мин`);
    }
  } else if (e.kind === "planned") {
    if (e.planned_distance_km && Number(e.planned_distance_km) > 0) {
      chips.push(`${Number(e.planned_distance_km).toFixed(1)} км`);
    }
    if (e.planned_duration_min && Number(e.planned_duration_min) > 0) {
      chips.push(`${Math.round(Number(e.planned_duration_min))} мин`);
    }
  }
  return chips;
}

type EventCardProps = {
  event: PlanEvent;
  draggable: boolean;
  isDragging: boolean;
  inMonth: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
};

function EventCard({
  event,
  draggable,
  isDragging,
  inMonth,
  onClick,
  onDragStart,
  onDragEnd,
}: EventCardProps) {
  const variant = getEventVariant(event);
  const chips = getEventChips(event);
  const SportIcon = getSportIcon(event.sport);
  const tooltip = getEventTooltip(event, draggable);
  const metaText = getEventMetaLine(event);

  const variantClasses: Record<EventVariant, string> = {
    goal: "border-[rgba(229,139,33,0.45)] bg-[rgba(255,214,0,0.18)]",
    "planned-completed": "border-[rgba(27,46,201,0.55)]",
    "planned-missed": "border-[rgba(246,176,33,0.55)]",
    planned:
      "border-[rgba(12,91,249,0.22)] border-t-[3px] border-t-[rgb(12,91,249)] " +
      "bg-[rgba(12,91,249,0.06)] hover:bg-[rgba(12,91,249,0.10)] " +
      "dark:bg-[rgba(12,91,249,0.10)] dark:hover:bg-[rgba(12,91,249,0.16)]",
    workout: "border-transparent text-white",
    default: "",
  };

  const variantStyle: React.CSSProperties = {};
  if (variant === "planned-completed") {
    variantStyle.backgroundImage =
      "repeating-linear-gradient(135deg, rgba(27,46,201,0.22) 0, rgba(27,46,201,0.22) 6px, rgba(27,46,201,0.08) 6px, rgba(27,46,201,0.08) 12px)";
  } else if (variant === "planned-missed") {
    variantStyle.backgroundImage =
      "repeating-linear-gradient(135deg, rgba(246,176,33,0.22) 0, rgba(246,176,33,0.22) 6px, rgba(246,176,33,0.08) 6px, rgba(246,176,33,0.08) 12px)";
  } else if (variant === "workout" && event.colorHex) {
    variantStyle.backgroundColor = event.colorHex;
    variantStyle.borderColor = event.colorHex;
  } else if (variant === "default" && event.colorHex) {
    variantStyle.borderColor = event.colorHex;
  }

  const iconColor: Record<EventVariant, string> = {
    goal: "text-[rgb(180,120,20)]",
    "planned-completed": "text-[rgb(27,46,201)]",
    "planned-missed": "text-[rgb(180,120,20)]",
    planned: "text-[rgb(12,91,249)]",
    workout: "text-white/90",
    default: "text-muted-foreground",
  };

  const chipClasses: Record<EventVariant, string> = {
    goal: "bg-[rgba(229,139,33,0.18)] text-[rgb(140,90,15)]",
    "planned-completed": "bg-[rgba(27,46,201,0.18)] text-[rgb(27,46,201)]",
    "planned-missed": "bg-[rgba(246,176,33,0.22)] text-[rgb(140,90,15)]",
    planned: "bg-[rgba(12,91,249,0.12)] text-[rgb(12,91,249)]",
    workout: "bg-white/20 text-white",
    default: "bg-muted text-muted-foreground",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onClick}
          style={variantStyle}
          title={event.title}
          className={cn(
            "group relative block w-full overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs transition-all duration-150",
            "shadow-[0_1px_0_rgba(0,0,0,0.02)]",
            variantClasses[variant],
            variant !== "workout" && "hover:shadow-md",
            variant === "planned" && "hover:-translate-y-px",
            !inMonth && "opacity-75",
            draggable && "cursor-grab active:cursor-grabbing",
            isDragging && "opacity-50",
          )}
        >
          <div className="flex items-start gap-1.5">
            {variant !== "goal" ? (
              <SportIcon
                className={cn("mt-0.5 size-3.5 shrink-0", iconColor[variant])}
                aria-hidden
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {variant === "planned-completed" ? (
                  <Check className="size-3 shrink-0 text-[rgb(27,46,201)]" aria-hidden />
                ) : null}
                {variant === "planned-missed" ? (
                  <AlertCircle className="size-3 shrink-0 text-[rgb(180,120,20)]" aria-hidden />
                ) : null}
                <div className="truncate text-[12px] font-semibold leading-tight">
                  {variant === "goal"
                    ? `${event.goal_icon ?? "🎯"} ${event.title}`
                    : event.title}
                </div>
              </div>

              {chips.length > 0 && (variant === "planned" || variant === "workout") ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-semibold leading-[1.5]",
                        chipClasses[variant],
                      )}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : metaText ? (
                <div
                  className={cn(
                    "mt-0.5 truncate text-[10px] opacity-85",
                    variant === "workout"
                      ? "text-white"
                      : variant === "planned-completed" || variant === "planned-missed"
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {metaText}
                </div>
              ) : null}
            </div>

            {draggable ? (
              <GripVertical
                className="mt-0.5 size-3 shrink-0 text-[rgb(12,91,249)]/50 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            ) : null}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default function PlansCalendar({
  events = [],
  initialMonth,
  onDayClick,
  onEventClick,
  onEventDrop,
  className,
  activeGoal = null,
}: PlansCalendarProps) {
  const todayIso = React.useMemo(() => iso(new Date()), []);
  const [draggingEventId, setDraggingEventId] = React.useState<string | null>(null);
  const isDraggingPlannedWorkout = draggingEventId !== null;

  const [month, setMonth] = React.useState<Date>(() => {
    const now = new Date();
    return initialMonth ?? new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const canDragEvent = React.useCallback(
    (e: PlanEvent) => {
      return (
        e.kind === "planned" &&
        e.status !== "completed" &&
        e.status !== "missed" &&
        String(e.date) >= todayIso
      );
    },
    [todayIso]
  );

  // события по дате
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, PlanEvent[]>();
    for (const e of events) {
      const key = e.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const days = React.useMemo(() => getDaysGrid(month), [month]);
  let monthLabel = RU.format(month);
  // убираем "г." в конце (например "апрель 2026 г." → "апрель 2026")
  monthLabel = monthLabel.replace(/\s?г\.?$/, "");

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-muted/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-lg font-semibold capitalize leading-none">{monthLabel}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(addMonths(month, -1))}
            className="rounded-xl"
          >
            ← Пред
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(new Date())}
            className="rounded-xl"
          >
            Сегодня
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(addMonths(month, 1))}
            className="rounded-xl"
          >
            След →
          </Button>
        </div>
      </div>

      {/* legend removed */}

      {/* Week header */}
      <div className="grid grid-cols-7 gap-px border-b bg-muted/20 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {RU_SHORT_WEEK.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Grid 6x7 */}
      <div className="grid grid-cols-7 gap-px bg-border/40 p-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const k = iso(d);
          const dayEvents = eventsByDate.get(k) || [];
          const isToday = iso(d) === iso(new Date());
          const isGoalDay =
            activeGoal?.date_to &&
            activeGoal.date_to === k;

          const isRaceGoal =
            isGoalDay &&
            (activeGoal?.type === "race" || activeGoal?.type === "event");
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const canDropHere = k >= todayIso;

          return (
            <div
              key={k}
              onClick={() => {
                if (k < todayIso) return;
                onDayClick?.(k);
              }}
              onDragOver={(ev) => {
                if (!canDropHere || !onEventDrop) return;

                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
              }}
              onDrop={(ev) => {
                if (!canDropHere || !onEventDrop) return;

                ev.preventDefault();
                ev.stopPropagation();

                const raw = ev.dataTransfer.getData("application/json");
                if (!raw) return;

                try {
                  const dropped = JSON.parse(raw) as PlanEvent;
                  if (!canDragEvent(dropped)) return;
                  if (String(dropped.date) === k) return;

                  onEventDrop(dropped, k);
                } catch {
                  // ignore malformed drag payload
                } finally {
                  setDraggingEventId(null);
                }
              }}
              className={cn(
                "min-h-[132px] p-2 transition-colors",
                onDayClick && k >= todayIso && "cursor-pointer",
                isGoalDay
                  ? "border border-yellow bg-yellow/20"
                  : "bg-background",
                "hover:bg-muted/10",
                !inMonth &&
                  (isGoalDay
                    ? "opacity-70"
                    : "bg-muted/40 text-muted-foreground"),
                isWeekend && inMonth && "bg-muted/[0.06]",
                isToday &&
                  "bg-[color:var(--btn-primary-bg,#FFF6E8)] ring-1 ring-inset ring-[color:var(--btn-primary-main,#E58B21)]",
                isDraggingPlannedWorkout &&
                  canDropHere &&
                  "ring-2 ring-inset ring-[color:var(--btn-primary-main,#E58B21)]",
                isDraggingPlannedWorkout && !canDropHere && "opacity-60"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium leading-6 transition-colors",
                      isToday
                        ? "bg-[color:var(--btn-primary-bg,#FFF6E8)] text-[color:var(--btn-primary-main,#E58B21)] border border-[color:var(--btn-primary-main,#E58B21)]"
                        : inMonth
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    aria-label={k}
                    title={k}
                  >
                    {d.getDate()}
                  </span>
                  {isRaceGoal ? (
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  ) : null}
                </div>
                {dayEvents.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const draggable = canDragEvent(e);

                  return (
                    <EventCard
                      key={e.id}
                      event={e}
                      draggable={draggable}
                      isDragging={draggingEventId === String(e.id)}
                      inMonth={inMonth}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick?.(e);
                      }}
                      onDragStart={(ev) => {
                        if (!draggable) {
                          ev.preventDefault();
                          return;
                        }
                        ev.stopPropagation();
                        setDraggingEventId(String(e.id));
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData(
                          "application/json",
                          JSON.stringify(e)
                        );
                      }}
                      onDragEnd={() => setDraggingEventId(null)}
                    />
                  );
                })}

                {dayEvents.length > 3 && (
                  <div className="pl-1 text-[10px] font-medium text-muted-foreground">
                    + ещё {dayEvents.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}