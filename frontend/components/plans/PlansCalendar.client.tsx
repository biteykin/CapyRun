"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  isCompleted?: boolean;  // Флаг, который выставляем в Host
  [key: string]: any;
};

export type PlansCalendarProps = {
  events?: PlanEvent[];
  initialMonth?: Date;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (evt: PlanEvent) => void;
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

export default function PlansCalendar({
  events = [],
  initialMonth,
  onDayClick,
  onEventClick,
  className,
  activeGoal = null,
}: PlansCalendarProps) {
  const [month, setMonth] = React.useState<Date>(() => {
    const now = new Date();
    return initialMonth ?? new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

          return (
            <div
              key={k}
              onClick={() => onDayClick?.(k)}
              className={cn(
                "min-h-[132px] p-2 transition-colors",
                onDayClick && "cursor-pointer",
                isGoalDay
                  ? "border border-yellow bg-yellow/20"
                  : "bg-background",
                "hover:bg-muted/10",
                !inMonth &&
                  (isGoalDay
                    ? "opacity-70"
                    : "bg-muted/40 text-muted-foreground"),
                isWeekend && inMonth && "bg-muted/[0.06]"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-semibold leading-none transition-colors",
                      isToday
                        ? "bg-primary text-primary-foreground shadow-sm"
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
                  const style: React.CSSProperties = {};

                  if (e.kind === "goal") {
                    style.backgroundColor = "rgba(255, 214, 0, 0.18)";
                    style.borderColor = "rgba(229, 139, 33, 0.45)";
                    style.color = "inherit";
                  } else if (e.isCompleted && e.colorHex) {
                    // Выполненная: заливка + белый текст
                    style.backgroundColor = e.colorHex;
                    style.borderColor = e.colorHex;
                    style.color = "#FFFFFF";
                  } else if (e.colorHex) {
                    // Остальные: цвет рамки
                    style.borderColor = e.colorHex;
                  }

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick?.(e);
                      }}
                      className={cn(
                        "block w-full rounded-lg border px-2.5 py-2 text-left text-xs shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors",
                        !e.isCompleted && "hover:bg-muted/60",
                        !inMonth && "opacity-75"
                      )}
                      style={style}
                      title={e.title}
                    >
                      <div className="truncate font-medium leading-tight">
                        {e.kind === "goal" ? `${e.goal_icon ?? "🎯"} ${e.title}` : e.title}
                      </div>
                      {getEventMetaLine(e) ? (
                        <div
                          className={cn(
                            "mt-1 truncate text-[10px] opacity-80",
                            e.isCompleted ? "text-white/90" : "text-muted-foreground"
                          )}
                        >
                          {getEventMetaLine(e)}
                        </div>
                      ) : null}
                    </button>
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