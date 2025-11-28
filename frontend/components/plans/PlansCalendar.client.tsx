"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlanEvent = {
  id: string | number;
  /** ISO дата YYYY-MM-DD */
  date: string;
  title: string;
  colorHex?: string;      // цвет рамки / заливки
  description?: string | null;
  kind?: "planned" | "workout";
  status?: string | null;
  sport?: string | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  isCompleted?: boolean;  // Флаг, который выставляем в Host
  [key: string]: any;
};

export type PlansCalendarProps = {
  events?: PlanEvent[];
  initialMonth?: Date;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (evt: PlanEvent) => void;
  className?: string;
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
  // сетка 6x7 начиная с понедельника
  const first = startOfMonth(viewDate);
  const weekday = (first.getDay() + 6) % 7; // 0..6, где 0=Пн
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - weekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function PlansCalendar({
  events = [],
  initialMonth,
  onDayClick,
  onEventClick,
  className,
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
  const monthLabel = RU.format(month);

  return (
    <div
      className={cn(
        "w-full rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-base font-semibold capitalize">{monthLabel}</div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            ← Пред
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(new Date())}
          >
            Сегодня
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            След →
          </Button>
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-px border-b bg-border/50 px-2 py-1 text-center text-xs font-medium text-muted-foreground">
        {RU_SHORT_WEEK.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Grid 6x7 */}
      <div className="grid grid-cols-7 gap-px bg-border/50 p-px">
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const k = iso(d);
          const dayEvents = eventsByDate.get(k) || [];
          const isToday = iso(d) === iso(new Date());

          return (
            <div
              key={k}
              className={cn(
                "min-h-28 bg-background p-2",
                !inMonth && "bg-muted/40 text-muted-foreground"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onDayClick?.(k)}
                  className={cn(
                    "h-6 w-6 rounded-md text-xs font-medium leading-6 transition-colors",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  aria-label={k}
                  title={k}
                >
                  {d.getDate()}
                </button>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const style: React.CSSProperties = {};

                  if (e.isCompleted && e.colorHex) {
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
                      onClick={() => onEventClick?.(e)}
                      className={cn(
                        "block w-full truncate rounded-md border px-2 py-1 text-left text-xs",
                        !e.isCompleted && "hover:bg-muted"
                      )}
                      style={style}
                      title={e.title}
                    >
                      {e.title}
                    </button>
                  );
                })}

                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
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