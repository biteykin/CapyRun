"use client";

import * as React from "react";
import {
  Dumbbell,
  Flag,
  Gauge,
  CalendarDays,
  Route,
  Timer,
  Activity,
  Target,
  Sparkles,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import PlansCalendar, { type PlanEvent } from "./PlansCalendar.client";
import { supabase } from "@/lib/supabaseBrowser";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ActiveGoal = {
  id: string;
  title: string | null;
  type: string | null;
  sport: string | null;
  date_to: string | null;
} | null;

export type PlansCalendarHostProps = {
  events: PlanEvent[];
  initialMonthISO: string;
  activeGoal?: ActiveGoal;
};

type ExtendedEvent = PlanEvent & {
  kind?: "planned" | "workout";
  isCompleted?: boolean;
  structure?: {
    goal?: string | null;
    main?: string | null;
    notes?: string | null;
    steps?: any[] | null;
    effort?: string | null;
    warmup?: string | null;
    cooldown?: string | null;
    hr_target?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
    strength_block?: string | null;
  } | null;
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

function formatMinutes(min?: number | null) {
  if (!min || min <= 0) return "—";
  return `${Math.round(min)} мин`;
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

function formatPlannedDistance(km?: number | null) {
  if (!km || km <= 0) return "—";
  return `${Number(km).toFixed(1)} км`;
}

function formatStep(step: any): string {
  if (!step) return "—";

  const parts: string[] = [];
  if (step.label) parts.push(String(step.label));
  if (step.repeats) parts.push(`×${step.repeats}`);
  if (step.sets) parts.push(`${step.sets} подхода`);
  if (step.duration_min) parts.push(`${step.duration_min} мин`);
  if (step.distance_km) parts.push(`${Number(step.distance_km).toFixed(1)} км`);
  if (step.target) parts.push(String(step.target));

  return parts.join(" · ") || "—";
}

function DetailRow(props: { label: string; value?: React.ReactNode }) {
  const { label, value } = props;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

function SportBadge({ sport }: { sport?: string | null }) {
  const labelMap: Record<string, string> = {
    run: "Бег",
    ride: "Вело",
    swim: "Плавание",
    walk: "Ходьба",
    hike: "Хайк",
    strength: "ОФП",
  };

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
      {labelMap[sport ?? ""] ?? sport ?? "Тренировка"}
    </span>
  );
}

function MetaPill(props: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      {props.icon}
      <span>{props.children}</span>
    </div>
  );
}

const STEP_THEME_BY_TYPE: Record<
  string,
  {
    timeline: string;
    pill: string;
    tone: string;
  }
> = {
  warmup: {
    timeline: "bg-primary/15 border-primary/25",
    pill: "bg-primary/10 text-primary border-primary/20",
    tone: "border-l-primary bg-primary/5",
  },
  interval: {
    timeline: "bg-yellow/20 border-yellow/30",
    pill: "bg-yellow/15 text-foreground border-yellow/30",
    tone: "border-l-yellow bg-yellow/10",
  },
  recovery: {
    timeline: "bg-success/20 border-success/30",
    pill: "bg-success/15 text-foreground border-success/30",
    tone: "border-l-success bg-success/10",
  },
  cooldown: {
    timeline: "bg-muted border-border",
    pill: "bg-muted text-muted-foreground border-border",
    tone: "border-l-border bg-muted/40",
  },
  exercise: {
    timeline: "bg-[color:var(--data-color-11)]/20 border-[color:var(--data-color-11)]/30",
    pill: "bg-[color:var(--data-color-11)]/10 text-foreground border-[color:var(--data-color-11)]/30",
    tone: "border-l-[color:var(--data-color-11)] bg-[color:var(--data-color-11)]/5",
  },
  default: {
    timeline: "bg-muted/60 border-border",
    pill: "bg-muted text-muted-foreground border-border",
    tone: "border-l-primary bg-muted/20",
  },
};

function getStepTheme(type?: string | null) {
  return STEP_THEME_BY_TYPE[type ?? ""] ?? STEP_THEME_BY_TYPE.default;
}

function getTrainingBenefit(evt: ExtendedEvent | null) {
  const title = String(evt?.title ?? "").toLowerCase();
  const goal = String(evt?.goal ?? evt?.structure?.goal ?? "").toLowerCase();
  const sport = String(evt?.sport ?? "").toLowerCase();

  if (sport === "strength" || title.includes("офп") || goal.includes("офп")) {
    return "Укрепляет мышцы и устойчивость, помогает бегать стабильнее и снижать риск перегрузок.";
  }
  if (title.includes("темпов") || goal.includes("темпов")) {
    return "Развивает темповую выносливость и помогает дольше держать уверенный рабочий темп.";
  }
  if (title.includes("интервал") || goal.includes("интервал")) {
    return "Прокачивает скорость и работу на более высоком усилии без потери контроля.";
  }
  if (title.includes("длинн") || goal.includes("длинн")) {
    return "Укрепляет выносливость и уверенность на длинной дистанции.";
  }
  if (title.includes("легк") || goal.includes("легк")) {
    return "Поддерживает аэробную базу и помогает восстановиться без лишней нагрузки.";
  }
  return "Поддерживает форму и помогает двигаться к цели без хаотичных тренировок.";
}

function getTrainingPurposeLabel(evt: ExtendedEvent | null) {
  const title = String(evt?.title ?? "").toLowerCase();
  const goal = String(evt?.goal ?? evt?.structure?.goal ?? "").toLowerCase();
  const sport = String(evt?.sport ?? "").toLowerCase();

  if (sport === "strength" || title.includes("офп") || goal.includes("офп")) {
    return "Силовая устойчивость";
  }
  if (title.includes("темпов") || goal.includes("темпов")) {
    return "Развитие темповой выносливости";
  }
  if (title.includes("интервал") || goal.includes("интервал")) {
    return "Развитие скорости";
  }
  if (title.includes("длинн") || goal.includes("длинн")) {
    return "Развитие выносливости";
  }
  if (title.includes("легк") || goal.includes("легк")) {
    return "Аэробная база и восстановление";
  }
  return "Поддержка формы";
}

function getExecutionTips(evt: ExtendedEvent | null): string[] {
  const tips: string[] = [];
  const title = String(evt?.title ?? "").toLowerCase();
  const goal = String(evt?.goal ?? evt?.structure?.goal ?? "").toLowerCase();
  const effort = String(evt?.effort ?? evt?.structure?.effort ?? "").toLowerCase();
  const hrTarget = String(evt?.hr_target ?? evt?.structure?.hr_target ?? "");
  const sport = String(evt?.sport ?? "").toLowerCase();

  if (sport === "strength" || title.includes("офп") || goal.includes("офп")) {
    tips.push("Держи технику на первом месте и не работай через боль.");
    tips.push("Делай движения спокойно и контролируемо, без спешки.");
    tips.push("Между подходами восстанавливай дыхание, а не просто жди время.");
  } else if (title.includes("темпов") || goal.includes("темпов")) {
    tips.push("Начни спокойно и выходи в рабочий темп постепенно, без резкого ускорения.");
    tips.push("Темп должен быть уверенным, но контролируемым — без ощущения, что ты терпишь с первых минут.");
    tips.push("Держи технику ровной: расслабленные плечи, короткий контакт с землёй, стабильный ритм.");
  } else if (title.includes("интервал") || goal.includes("интервал")) {
    tips.push("Быстрые отрезки беги собрано, но не на максимум — важно сохранить качество всех повторов.");
    tips.push("На восстановлении реально сбавляй, чтобы следующая работа была качественной.");
    tips.push("Следи, чтобы темп не разваливался на последних интервалах.");
  } else if (title.includes("длинн") || goal.includes("длинн")) {
    tips.push("Первые минуты беги с запасом, не разгоняйся раньше времени.");
    tips.push("Главная цель — ровное устойчивое усилие, а не быстрый темп любой ценой.");
    tips.push("Следи за самочувствием и не бойся чуть замедлиться, если пульс уходит выше плана.");
  } else {
    tips.push("Держи усилие ровным и не ускоряйся без причины.");
    tips.push("Ориентируйся на контроль дыхания и ощущение устойчивого темпа.");
  }

  if (effort.includes("легк")) {
    tips.unshift("Беги в комфортном разговорном темпе — должно оставаться ощущение запаса.");
  } else if (effort.includes("умерен")) {
    tips.unshift("Работай на уверенном, но контролируемом усилии — без избыточного давления.");
  }

  if (hrTarget.trim()) {
    tips.push(`Следи за ориентиром по пульсу: ${hrTarget}.`);
  }

  return tips.slice(0, 4);
}

function getGoalLinkCopy(evt: ExtendedEvent | null, activeGoal?: ActiveGoal) {
  if (!activeGoal) return null;

  const goalTitle = activeGoal.title ?? "твоей цели";
  const goalType = String(activeGoal.type ?? "").toLowerCase();
  const title = String(evt?.title ?? "").toLowerCase();

  if (goalType.includes("hm") || goalTitle.toLowerCase().includes("полумара")) {
    if (title.includes("длинн")) {
      return `Эта тренировка напрямую работает на подготовку к цели «${goalTitle}»: она укрепляет выносливость и уверенность на дистанции.`;
    }
    if (title.includes("темпов")) {
      return `Эта тренировка помогает цели «${goalTitle}»: она повышает способность держать более высокий темп дольше.`;
    }
    if (title.includes("интервал")) {
      return `Эта тренировка поддерживает цель «${goalTitle}»: она развивает скорость и запас мощности.`;
    }
    if (title.includes("легк")) {
      return `Эта тренировка помогает цели «${goalTitle}» через поддержку аэробной базы и аккуратное восстановление.`;
    }
  }

  return `Эта тренировка поддерживает движение к цели «${goalTitle}» и помогает накапливать форму системно, а не хаотично.`;
}

function getPreWorkoutChecklist(evt: ExtendedEvent | null): string[] {
  const title = String(evt?.title ?? "").toLowerCase();
  const sport = String(evt?.sport ?? "").toLowerCase();
  const items = ["Проверь кроссовки и экипировку", "Убедись, что часы / трекер заряжены"];

  if (sport === "strength" || title.includes("офп")) {
    items.push("Подготовь место и инвентарь для упражнений");
    items.push("Сделай короткую суставную разминку перед началом");
    return items;
  }

  items.push("Возьми воду, если тренировка длинная или интенсивная");
  items.push("Проверь, что знаешь основной блок и ориентир по усилию");
  return items;
}

export default function PlansCalendarHost({
  events,
  initialMonthISO,
  activeGoal = null,
}: PlansCalendarHostProps) {
  const initialMonth = React.useMemo(
    () => new Date(initialMonthISO),
    [initialMonthISO]
  );

  const [selected, setSelected] = React.useState<ExtendedEvent | null>(null);
  const [calendarEventsState, setCalendarEventsState] = React.useState<PlanEvent[]>(events);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Маппим статусы в цвета и флаг isCompleted
  const calendarEvents = React.useMemo<PlanEvent[]>(() => {
    return calendarEventsState.map((e) => {
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
  }, [calendarEventsState]);

  React.useEffect(() => {
    setCalendarEventsState(events);
  }, [events]);

  const handleEventClick = (evt: PlanEvent) => {
    setSelected(evt as ExtendedEvent);
  };

  const dateStr = selected ? formatDateRu(selected.date) : "—";
  const statusStr = statusLabel(selected);
  const kindStr = kindLabel(selected);
  const description = (selected?.description as string | null | undefined) ?? null;
  const sport = selected?.sport ?? null;
  const distanceStr = formatDistance(selected?.distance_m);
  const durationStr = formatDuration(selected?.duration_sec);
  const structure = selected?.structure ?? null;
  const plannedGoal = structure?.goal ?? (selected as any)?.goal ?? null;
  const plannedMain = structure?.main ?? (selected as any)?.main ?? null;
  const plannedEffort = structure?.effort ?? (selected as any)?.effort ?? null;
  const plannedHrTarget = structure?.hr_target ?? (selected as any)?.hr_target ?? null;
  const plannedStrengthBlock =
    structure?.strength_block ?? (selected as any)?.strength_block ?? null;
  const plannedNotes = structure?.notes ?? (selected as any)?.notes ?? null;
  const plannedSteps = Array.isArray(structure?.steps) ? structure.steps : [];
  const plannedDistanceStr = formatPlannedDistance(
    (selected as any)?.planned_distance_km ?? structure?.distance_km ?? null
  );
  const plannedDurationStr = formatMinutes(
    (selected as any)?.planned_duration_min ?? structure?.duration_min ?? null
  );
  const isPlanned = selected?.kind === "planned";

  const purposeLabel = getTrainingPurposeLabel(selected);
  const executionTips = getExecutionTips(selected);
  const trainingBenefit = getTrainingBenefit(selected);
  const goalLinkCopy = getGoalLinkCopy(selected, activeGoal);
  const preWorkoutChecklist = getPreWorkoutChecklist(selected);

  const doDelete = React.useCallback(async () => {
    if (!selected || !isPlanned || isDeleting) return;

    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from("user_plan_sessions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      if (error) {
        console.error("plan_session_cancel_failed", error);
        return;
      }

      setCalendarEventsState((prev) => prev.filter((evt) => String(evt.id) !== String(selected.id)));
      setConfirmDeleteOpen(false);
      setSelected(null);
    } catch (e) {
      console.error("plan_session_cancel_failed", e);
    } finally {
      setIsDeleting(false);
    }
  }, [selected, isPlanned, isDeleting]);

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
          if (!open) {
            setSelected(null);
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <AlertDialogContent className="flex h-[min(85vh,900px)] w-[min(960px,calc(100vw-2rem))] max-w-[960px] flex-col overflow-hidden p-0">
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle className="px-6 pt-6">
              {selected?.title || "Тренировка"}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {/* Тело модалки со скроллом */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/20 p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {isPlanned ? "План" : "Выполнено"}
                        </span>
                        <SportBadge sport={sport} />
                        {isPlanned ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            {purposeLabel}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <div className="text-lg font-semibold leading-tight">
                          {selected?.title || "Тренировка"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isPlanned ? (
                        <>
                          {plannedDurationStr !== "—" ? (
                            <MetaPill icon={<Timer className="h-3.5 w-3.5" />}>
                              {plannedDurationStr}
                            </MetaPill>
                          ) : null}
                          {plannedDistanceStr !== "—" ? (
                            <MetaPill icon={<Route className="h-3.5 w-3.5" />}>
                              {plannedDistanceStr}
                            </MetaPill>
                          ) : null}
                          {plannedEffort ? (
                            <MetaPill icon={<Gauge className="h-3.5 w-3.5" />}>
                              {plannedEffort}
                            </MetaPill>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {durationStr !== "—" ? (
                            <MetaPill icon={<Timer className="h-3.5 w-3.5" />}>
                              {durationStr}
                            </MetaPill>
                          ) : null}
                          {distanceStr !== "—" ? (
                            <MetaPill icon={<Route className="h-3.5 w-3.5" />}>
                              {distanceStr}
                            </MetaPill>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="Статус" value={statusStr} />
                <DetailRow label="Тип" value={kindStr} />
                <DetailRow label="Вид спорта" value={sport ?? "—"} />
                {isPlanned ? (
                  <DetailRow label="Цель" value={plannedGoal ?? "—"} />
                ) : null}
              </div>

              {isPlanned ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Flag className="h-4 w-4" />
                        Цель
                      </div>
                      <div className="text-sm font-medium">{plannedGoal ?? "—"}</div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Timer className="h-4 w-4" />
                        Длительность
                      </div>
                      <div className="text-sm font-medium">{plannedDurationStr}</div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        Интенсивность
                      </div>
                      <div className="text-sm font-medium">{plannedEffort ?? "—"}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4" />
                      Что даст эта тренировка
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {trainingBenefit}
                    </div>
                  </div>

                  {goalLinkCopy ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                        <Target className="h-4 w-4" />
                        Связь с целью
                      </div>
                      <div className="text-sm text-foreground/90">
                        {goalLinkCopy}
                      </div>
                    </div>
                  ) : null}

                  {plannedSteps.length > 0 ? (
                    <div className="rounded-xl border p-4">
                      <div className="mb-3 text-sm font-semibold">План тренировки</div>
                      <div className="mb-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          Визуализация тренировки
                        </div>
                        <div className="flex overflow-hidden rounded-lg border bg-muted/20">
                          {plannedSteps.map((step, idx) => {
                            const raw =
                              Number(step?.duration_min ?? 0) > 0
                                ? Number(step.duration_min)
                                : Number(step?.distance_km ?? 1);
                            const flexGrow = Math.max(1, raw);
                            const theme = getStepTheme(step?.type);

                            return (
                              <div
                                key={`${selected?.id}-viz-${idx}`}
                                className={`min-w-[56px] border-r px-2 py-3 text-center text-[10px] font-semibold last:border-r-0 ${theme.timeline}`}
                                style={{ flex: `${flexGrow} 1 0%` }}
                                title={formatStep(step)}
                              >
                                <div className="truncate">{step?.label ?? `Шаг ${idx + 1}`}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {plannedSteps.map((step, idx) => (
                          <div
                            key={`${selected?.id}-step-${idx}`}
                            className={`rounded-lg border-l-4 px-4 py-3 ${getStepTheme(step?.type).tone}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {step?.label ?? `Шаг ${idx + 1}`}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formatStep(step)}
                                </div>
                                {step?.notes ? (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {String(step.notes)}
                                  </div>
                                ) : null}
                              </div>
                              <div
                                className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStepTheme(step?.type).pill}`}
                              >
                                {step?.type ?? "step"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Flag className="h-4 w-4" />
                      Как выполнять
                    </div>
                    <div className="space-y-2">
                      {executionTips.map((tip, idx) => (
                        <div
                          key={`${selected?.id}-tip-${idx}`}
                          className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                        >
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <ListChecks className="h-4 w-4" />
                      Чеклист перед тренировкой
                    </div>
                    <div className="space-y-2">
                      {preWorkoutChecklist.map((item, idx) => (
                        <div key={`${selected?.id}-check-${idx}`} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {plannedHrTarget ? (
                      <DetailRow label="Целевой пульс" value={plannedHrTarget} />
                    ) : null}
                    {plannedStrengthBlock ? (
                      <div className="rounded-xl border p-4 sm:col-span-2">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                          <Dumbbell className="h-4 w-4" />
                          Силовой блок
                        </div>
                        <div className="text-sm text-muted-foreground">{plannedStrengthBlock}</div>
                      </div>
                    ) : null}
                  </div>

                  {(plannedNotes || description || plannedMain) ? (
                    <div className="rounded-xl border p-4">
                      <div className="mb-2 text-sm font-semibold">Примечания</div>
                      <div className="text-sm text-muted-foreground">
                        {plannedNotes ?? description ?? plannedMain ?? "—"}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailRow label="Дистанция" value={distanceStr} />
                    <DetailRow label="Время" value={durationStr} />
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="mb-2 text-sm font-semibold">Описание тренировки</div>
                    <div className="text-sm text-muted-foreground">{description || "—"}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <AlertDialogFooter className="shrink-0 flex flex-row justify-end gap-2 border-t px-6 py-4">
            {isPlanned ? (
              <Button
                type="button"
                variant="danger"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Удалить
              </Button>
            ) : null}

            <AlertDialogCancel>Закрыть</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировку из плана?</AlertDialogTitle>
            <AlertDialogDescription>
              Тренировка будет удалена из календаря плана. Это действие можно будет
              восстановить только вручную, если добавить её заново.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
              onClick={doDelete}
            >
              {isDeleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}