"use client";

import * as React from "react";
import PlansCalendar, { type PlanEvent } from "./PlansCalendar.client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type PlansCalendarHostProps = {
  events: PlanEvent[];
  initialMonthISO: string;
};

type ExtendedEvent = PlanEvent & {
  kind?: "planned" | "workout";
  isCompleted?: boolean;
};

// Цвета из Colors (Storybook):
// bg-success, bg-yellow, data-color-11
const COLOR_COMPLETED = "#2D7601"; // выполнена
const COLOR_MISSED = "#F6B021";    // пропущена
const COLOR_PLANNED = "#0C5BF9";   // запланирована (data-color-11)

function formatDateRu(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatDistance(m?: number | null) {
  if (!m || m <= 0) return "—";
  const km = m / 1000;
  return `${km.toFixed(1)} км`;
}

function statusLabel(evt: ExtendedEvent | null): string {
  if (!evt) return "—";

  // Фактическая тренировка
  if (evt.kind === "workout") {
    return "Выполнена";
  }

  const s = (evt.status || "").toString();

  switch (s) {
    case "planned":
      return "Запланирована";
    case "moved":
      return "Перенесена";
    case "completed":
      return "Выполнена";
    case "missed":
      return "Пропущена";
    case "canceled":
      return "Отменена";
    default:
      return s || "—";
  }
}

function kindLabel(evt: ExtendedEvent | null): string {
  if (!evt) return "—";
  if (evt.kind === "workout") return "Фактическая тренировка";
  if (evt.kind === "planned") return "Плановая тренировка";
  return "Тренировка";
}

export default function PlansCalendarHost({
  events,
  initialMonthISO,
}: PlansCalendarHostProps) {
  const initialMonth = React.useMemo(
    () => new Date(initialMonthISO),
    [initialMonthISO]
  );

  const [selected, setSelected] = React.useState<ExtendedEvent | null>(null);

  // Маппим статусы в цвета и флаг isCompleted
  const calendarEvents = React.useMemo<PlanEvent[]>(() => {
    return events.map((e) => {
      const kind = e.kind ?? undefined;
      const status = e.status ?? undefined;

      const isCompleted =
        kind === "workout" || status === "completed";

      const isMissed = status === "missed";

      let colorHex: string | undefined = COLOR_PLANNED;

      if (isCompleted) {
        colorHex = COLOR_COMPLETED;
      } else if (isMissed) {
        colorHex = COLOR_MISSED;
      }

      return {
        ...e,
        kind,
        status,
        colorHex,
        isCompleted,
      };
    });
  }, [events]);

  const handleEventClick = (evt: PlanEvent) => {
    setSelected(evt as ExtendedEvent);
  };

  const dateStr = selected ? formatDateRu(selected.date) : "—";
  const statusStr = statusLabel(selected);
  const kindStr = kindLabel(selected);
  const description =
    (selected?.description as string | null | undefined) ?? null;
  const sport = selected?.sport ?? null;
  const distanceStr = formatDistance(selected?.distance_m);
  const durationStr = formatDuration(selected?.duration_sec);

  return (
    <>
      <PlansCalendar
        events={calendarEvents}
        initialMonth={initialMonth}
        onEventClick={handleEventClick}
      />

      <AlertDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selected?.title || "Тренировка"}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {/* 3. Тело модалки (без AlertDialogDescription, чтобы не было <p><div></div></p>) */}
          <div className="space-y-4 text-sm">
            {/* Дата */}
            <div>
              <div className="text-xs text-muted-foreground">Дата</div>
              <div>{dateStr}</div>
            </div>

            {/* Описание */}
            <div>
              <div className="text-xs text-muted-foreground">
                Описание тренировки
              </div>
              <div>{description || "—"}</div>
            </div>

            {/* Статус */}
            <div>
              <div className="text-xs text-muted-foreground">
                Статус тренировки
              </div>
              <div>{statusStr}</div>
            </div>

            {/* Дополнительно важная информация */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Тип</div>
                <div>{kindStr}</div>
              </div>

              {sport && (
                <div>
                  <div className="text-xs text-muted-foreground">
                    Вид спорта
                  </div>
                  <div>{sport}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground">Дистанция</div>
                <div>{distanceStr}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Время</div>
                <div>{durationStr}</div>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                // TODO: реальное удаление позже
                setSelected(null);
              }}
            >
              Удалить
            </Button>

            <AlertDialogCancel>Отмена</AlertDialogCancel>

            <Button
              type="button"
              variant="primary"
              onClick={() => {
                // TODO: сохранение изменений позже
                setSelected(null);
              }}
            >
              Сохранить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}