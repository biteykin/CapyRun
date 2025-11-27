"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";

type PlanEvent = {
  id: string | number;
  /** ISO дата YYYY-MM-DD */
  date: string;
  title: string;
  colorHex?: string; // опционально подсветка события
  status?: string;   // новый необязательный статус (добавили для стилей)
};

export type PlansCalendarProps = {
  /** Если передаём events — используется только они и к базе не идём */
  events?: PlanEvent[];
  initialMonth?: Date;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (evt: PlanEvent) => void;
  className?: string;
};

const RU = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
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
  const last = endOfMonth(viewDate);
  // JS: 0-вс, 1-пн … 6-сб. Нам нужен понедельник=1 как старт.
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
  events: eventsProp,
  initialMonth,
  onDayClick,
  onEventClick,
  className,
}: PlansCalendarProps) {
  const [month, setMonth] = React.useState<Date>(() => {
    const now = new Date();
    return initialMonth ?? new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [events, setEvents] = React.useState<PlanEvent[]>(eventsProp ?? []);
  const [loading, setLoading] = React.useState<boolean>(!eventsProp);
  const [error, setError] = React.useState<string | null>(null);

  // если проп events изменился (например, в сторис) — синхронизируем состояние
  React.useEffect(() => {
    if (eventsProp) {
      setEvents(eventsProp);
      setLoading(false);
      setError(null);
    }
  }, [eventsProp]);

  // Если events НЕ переданы, грузим реальные данные из Supabase
  React.useEffect(() => {
    if (eventsProp) return; // используем только внешние events, к БД не лезем

    let cancelled = false;

    async function loadFromSupabase() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) {
            setEvents([]);
            setLoading(false);
          }
          return;
        }

        // берём диапазон +-90 дней вокруг сегодня, чтобы не тащить всё подряд
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 90);
        const to = new Date(today);
        to.setDate(to.getDate() + 120);

        const fromStr = iso(from);
        const toStr = iso(to);

        const { data, error } = await supabase
          .from("user_plan_sessions")
          .select("id, planned_date, title, color_hex")
          .eq("user_id", user.id)
          .gte("planned_date", fromStr)
          .lte("planned_date", toStr)
          .order("planned_date", { ascending: true });

        if (error) throw error;

        const mapped: PlanEvent[] =
          (data ?? []).map((row: any) => ({
            id: row.id,
            date: row.planned_date, // уже YYYY-MM-DD
            title: row.title ?? "Тренировка",
            colorHex: row.color_hex ?? undefined,
          })) ?? [];

        if (!cancelled) {
          setEvents(mapped);
        }
      } catch (e: any) {
        console.error("Failed to load plan sessions", e);
        if (!cancelled) {
          setError(e?.message ?? "Не удалось загрузить план тренировок");
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [eventsProp]);

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
    <div className={cn("w-full rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-base font-semibold capitalize">{monthLabel}</div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, -1))}>
            ← Пред
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(new Date())}>
            Сегодня
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
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

      {/* Опционально можно показать статус загрузки/ошибки над сеткой */}
      {loading && !eventsProp && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Загружаем план тренировок…
        </div>
      )}
      {error && !eventsProp && (
        <div className="px-4 py-2 text-xs text-red-600">
          Ошибка: {error}
        </div>
      )}

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
                {/* можно вывести суммарный счётчик/иконку и т.д. */}
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  // Выполненные: зелёные (COLOR_DONE из /plan/page.tsx = "#2D7601")
                  const isDone = e.colorHex === "#2D7601";

                  const style: React.CSSProperties | undefined = e.colorHex
                    ? isDone
                      ? { backgroundColor: e.colorHex, borderColor: e.colorHex }
                      : { borderColor: e.colorHex }
                    : undefined;

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEventClick?.(e)}
                      className={cn(
                        "block w-full truncate rounded-md border px-2 py-1 text-left text-xs",
                        isDone && "text-white",
                        "hover:bg-muted"
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