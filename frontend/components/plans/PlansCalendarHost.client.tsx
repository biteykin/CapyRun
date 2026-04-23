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
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import PlansCalendar, { type PlanEvent } from "./PlansCalendar.client";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import * as RD from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";

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
    hydration?: string | null;
    fueling?: string | null;
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
    timelineStyle?: React.CSSProperties;
    pillStyle?: React.CSSProperties;
  }
> = {
  warmup: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(41,73,246)] bg-[rgb(212,219,253,0.35)]",
    timelineStyle: {
      backgroundColor: "#D4DBFD",
      color: "#0E0E0E",
      borderColor: "rgba(41,73,246,0.2)",
    },
    pillStyle: {
      backgroundColor: "#D4DBFD",
      color: "#2949F6",
      borderColor: "rgba(41,73,246,0.25)",
    },
  },

  interval: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(89,34,159)] bg-[rgba(209,193,228,0.6)]",
    timelineStyle: {
      backgroundColor: "#D1C1E4",
      color: "#0E0E0E",
      borderColor: "rgba(89,34,159,0.2)",
    },
    pillStyle: {
      backgroundColor: "#D1C1E4",
      color: "#59229F",
      borderColor: "rgba(89,34,159,0.25)",
    },
  },

  recovery: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(78,132,36)] bg-[rgb(217,238,218,0.5)]",
    timelineStyle: {
      backgroundColor: "#D9EEDA",
      color: "#0E0E0E",
      borderColor: "rgba(78,132,36,0.2)",
    },
    pillStyle: {
      backgroundColor: "#D9EEDA",
      color: "#4E8424",
      borderColor: "rgba(78,132,36,0.25)",
    },
  },

  cooldown: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(170,172,168)] bg-[rgb(240,241,236,0.7)]",
    timelineStyle: {
      backgroundColor: "#F0F1EC",
      color: "#595958",
      borderColor: "rgba(170,172,168,0.25)",
    },
    pillStyle: {
      backgroundColor: "#F0F1EC",
      color: "#595958",
      borderColor: "rgba(170,172,168,0.25)",
    },
  },

  exercise: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(89,34,159)] bg-[rgb(209,193,228,0.4)]",
    timelineStyle: {
      backgroundColor: "#D1C1E4",
      color: "#0E0E0E",
      borderColor: "rgba(89,34,159,0.2)",
    },
    pillStyle: {
      backgroundColor: "#D1C1E4",
      color: "#59229F",
      borderColor: "rgba(89,34,159,0.25)",
    },
  },

  default: {
    timeline: "",
    pill: "",
    tone: "border-l-[rgb(240,145,55)] bg-[rgba(240,145,55,0.12)]",
    timelineStyle: {
      backgroundColor: "#F0E7D4",
      color: "#0E0E0E",
      borderColor: "rgba(240,145,55,0.2)",
    },
    pillStyle: {
      backgroundColor: "#F0E7D4",
      color: "#F09137",
      borderColor: "rgba(240,145,55,0.25)",
    },
  },
};

function getStepTheme(type?: string | null) {
  return STEP_THEME_BY_TYPE[type ?? ""] ?? STEP_THEME_BY_TYPE.default;
}

function getTrainingBenefit(evt: ExtendedEvent | null, activeGoal?: ActiveGoal) {
  if (!evt) return "Эта тренировка поддерживает общий прогресс и помогает двигаться к цели без перегруза.";

  const title = String(evt.title ?? "").toLowerCase();
  const sport = String(evt.sport ?? "").toLowerCase();
  const structure = evt.structure ?? null;
  const goal = String(structure?.goal ?? "").toLowerCase();

  const text = `${title} ${goal} ${sport}`;
  const activeGoalTitle = activeGoal?.title?.trim() || null;
  const goalSuffix = activeGoalTitle
    ? ` Это также помогает в достижении цели «${activeGoalTitle}».`
    : "";

  if (text.includes("длинн")) {
    return (
      "Развивает выносливость, помогает спокойнее держать нагрузку на длительной работе и укрепляет базу под более длинные дистанции." +
      goalSuffix
    );
  }

  if (text.includes("темпов")) {
    return (
      "Учит держать устойчиво высокий, но контролируемый темп. Помогает повышать пороговую выносливость и напрямую влияет на способность бежать быстрее на целевой дистанции." +
      goalSuffix
    );
  }

  if (text.includes("интерв")) {
    return (
      "Развивает скорость, экономичность и переносимость интенсивной нагрузки. Помогает улучшать форму и поднимать потолок текущих возможностей." +
      goalSuffix
    );
  }

  if (text.includes("легк")) {
    return (
      "Даёт аэробную базу, помогает восстанавливаться и поддерживать объём без лишнего стресса. Это фундамент, на котором держится весь план." +
      goalSuffix
    );
  }

  if (text.includes("офп") || text.includes("сил") || sport === "strength") {
    return (
      "Укрепляет мышцы и связки, улучшает стабильность и снижает риск травм. Такая работа помогает увереннее переносить беговой объём и держать технику." +
      goalSuffix
    );
  }

  return `Поддерживает прогресс по плану, помогает развивать нужные качества и постепенно приближает к текущей спортивной цели.${goalSuffix}`;
}

function getChecklistItems(evt: ExtendedEvent | null): string[] {
  if (!evt) return [];

  const sport = String(evt.sport ?? "").toLowerCase();
  const structure = evt.structure ?? null;
  const steps = Array.isArray(structure?.steps) ? structure.steps : [];
  const hasWarmup = steps.some((s) => s?.type === "warmup") || !!structure?.warmup;
  const hasCooldown = steps.some((s) => s?.type === "cooldown") || !!structure?.cooldown;

  const items: string[] = [];

  if (hasWarmup) items.push("Сделать короткую разминку перед стартом");
  if (sport === "run") items.push("Подготовить часы, форму и кроссовки заранее");
  if (sport === "strength") items.push("Проверить технику и не работать через боль");
  if (structure?.hydration) items.push(`По воде: ${structure.hydration}`);
  else items.push("Заранее подумать о воде, если тренировка затянется");
  if (structure?.fueling) items.push(`По питанию: ${structure.fueling}`);
  if (hasCooldown) items.push("Оставить 5–10 минут на заминку после тренировки");

  return items.slice(0, 5);
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

  const orderedEvents = React.useMemo<ExtendedEvent[]>(() => {
    return [...calendarEvents]
      .sort((a, b) => {
        const byDate = String(a.date).localeCompare(String(b.date));
        if (byDate !== 0) return byDate;
        return String(a.title ?? "").localeCompare(String(b.title ?? ""));
      })
      .map((e) => e as ExtendedEvent);
  }, [calendarEvents]);

  const selectedIndex = React.useMemo(() => {
    if (!selected) return -1;
    return orderedEvents.findIndex((evt) => String(evt.id) === String(selected.id));
  }, [orderedEvents, selected]);

  const prevEvent = selectedIndex > 0 ? orderedEvents[selectedIndex - 1] : null;
  const nextEvent =
    selectedIndex >= 0 && selectedIndex < orderedEvents.length - 1
      ? orderedEvents[selectedIndex + 1]
      : null;

  React.useEffect(() => {
    if (!selected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // не мешаем подтверждению удаления
      if (confirmDeleteOpen) return;

      if (e.key === "ArrowLeft" && prevEvent) {
        e.preventDefault();
        setSelected(prevEvent);
      }

      if (e.key === "ArrowRight" && nextEvent) {
        e.preventDefault();
        setSelected(nextEvent);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, prevEvent, nextEvent, confirmDeleteOpen]);

  React.useEffect(() => {
    setCalendarEventsState(events);
  }, [events]);

  const handleEventClick = (evt: PlanEvent) => {
    setSelected(evt as ExtendedEvent);
  };

  const dateStr = selected ? formatDateRu(selected.date) : "—";
  const description = (selected?.description as string | null | undefined) ?? null;
  const sport = selected?.sport ?? null;
  const distanceStr = formatDistance(selected?.distance_m);
  const durationStr = formatDuration(selected?.duration_sec);
  const structure = selected?.structure ?? null;
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
  const trainingBenefit = getTrainingBenefit(selected, activeGoal);
  const checklistItems = getChecklistItems(selected);
  const plannedDurationStr = formatMinutes(
    (selected as any)?.planned_duration_min ?? structure?.duration_min ?? null
  );
  const isPlanned = selected?.kind === "planned";

  const purposeLabel = getTrainingPurposeLabel(selected);
  const executionTips = getExecutionTips(selected);

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

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelected(null);
              setConfirmDeleteOpen(false);
            }}
          />
          <RD.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex h-[min(85vh,900px)] w-[min(960px,calc(100vw-2rem))] max-w-[960px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden " +
                "rounded-[var(--radius-lg,var(--radius))] border border-border bg-background p-0 text-foreground shadow-strong " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onPointerDownOutside={() => {
              setSelected(null);
              setConfirmDeleteOpen(false);
            }}
          >
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <DialogTitle>
                {selected?.title || "Тренировка"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!prevEvent}
                  onClick={() => {
                    if (prevEvent) {
                      setSelected(prevEvent);
                      setConfirmDeleteOpen(false);
                    }
                  }}
                >
                  ← Предыдущая
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!nextEvent}
                  onClick={() => {
                    if (nextEvent) {
                      setSelected(nextEvent);
                      setConfirmDeleteOpen(false);
                    }
                  }}
                >
                  Следующая →
                </Button>
              </div>
            </div>
          </div>

          {/* Тело модалки со скроллом */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="gap-4 bg-muted/20 py-4 sm:col-span-2">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 px-4">
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
                  </CardContent>
                </Card>
              </div>

              {isPlanned ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          Целевой пульс
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">
                          {plannedHrTarget || "без ориентира по пульсу"}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          Длительность
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{plannedDurationStr}</div>
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          Интенсивность
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{plannedEffort ?? "—"}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Flag className="h-4 w-4" />
                        Что даст эта тренировка
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <div className="text-sm text-muted-foreground">
                        {trainingBenefit}
                      </div>
                    </CardContent>
                  </Card>

                  {plannedSteps.length > 0 ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">План тренировки</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 px-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          Визуализация тренировки
                        </div>
                        <div className="flex overflow-hidden rounded-lg border bg-muted/20">
                          {plannedSteps.map((step, idx) => {
                            const raw =
                              Number(step?.duration_min ?? 0) > 0
                                ? Number(step.duration_min)
                                : Number(step?.distance_km ?? 1);
                            const repeats =
                              Number(step?.repeats ?? 0) > 0 ? Number(step.repeats) : 1;
                            const weighted = raw * repeats;
                            const flexGrow = Math.max(1, weighted);
                            const theme = getStepTheme(step?.type);

                            return (
                              <div
                                key={`${selected?.id}-viz-${idx}`}
                                className={`min-w-[56px] border-r px-2 py-3 text-center text-[10px] font-semibold last:border-r-0 ${theme.timeline}`}
                                style={{
                                  flex: `${flexGrow} 1 0%`,
                                  ...theme.timelineStyle,
                                }}
                                title={formatStep(step)}
                              >
                                <div className="truncate">
                                  {step?.label ?? `Шаг ${idx + 1}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                      <CardContent className="space-y-3 px-4">
                        {plannedSteps.map((step, idx) => {
                          const stepTheme = getStepTheme(step?.type);
                          return (
                          <div
                            key={`${selected?.id}-step-${idx}`}
                            className={`rounded-lg border-l-4 px-4 py-3 ${stepTheme.tone}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {step?.label ?? `Шаг ${idx + 1}`}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {formatStep(step)}
                                </div>
                                {step?.notes ? (
                                  <div className="mt-1 text-sm text-muted-foreground">
                                    {String(step.notes)}
                                  </div>
                                ) : null}
                              </div>
                              <div
                                className={`rounded-full border border-solid px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${stepTheme.pill}`}
                                style={stepTheme.pillStyle}
                              >
                                {step?.type ?? "step"}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </CardContent>

                      {plannedNotes ? (
                        <CardContent className="border-t px-4 pt-4">
                          <div className="mb-2 text-sm font-semibold">Примечания</div>
                          <div className="text-sm text-muted-foreground">
                            {plannedNotes}
                          </div>
                        </CardContent>
                      ) : null}
                    </Card>
                  ) : (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">План тренировки</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm text-muted-foreground">
                          Структура тренировки пока не заполнена
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Flag className="h-4 w-4" />
                        Как выполнять
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <ul className="space-y-2">
                        {executionTips.map((tip, idx) => (
                          <li
                            key={`${selected?.id}-tip-${idx}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-black" />
                            <span className="text-muted-foreground">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {plannedStrengthBlock ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                          <Dumbbell className="h-4 w-4" />
                          Силовой блок
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm text-muted-foreground">{plannedStrengthBlock}</div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {checklistItems.length > 0 ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">Чеклист перед тренировкой</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4">
                        {checklistItems.map((item, idx) => (
                          <div
                            key={`${selected?.id}-check-${idx}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(45,118,1)]" />
                            <span className="text-muted-foreground">{item}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailRow label="Дистанция" value={distanceStr} />
                    <DetailRow label="Время" value={durationStr} />
                  </div>

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-sm font-semibold">Описание тренировки</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <div className="text-sm text-muted-foreground">{description || "—"}</div>
                    </CardContent>
                  </Card>

                  {checklistItems.length > 0 ? (
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-semibold">Чеклист перед тренировкой</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4">
                        {checklistItems.map((item, idx) => (
                          <div
                            key={`${selected?.id}-check-${idx}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(45,118,1)]" />
                            <span className="text-muted-foreground">{item}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-row justify-end gap-2 border-t px-6 py-4">
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

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelected(null);
                setConfirmDeleteOpen(false);
              }}
            >
              Закрыть
            </Button>
          </div>
          </RD.Content>
        </DialogPortal>
      </Dialog>

      <ConfirmActionDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Удалить тренировку?"
        description="Это действие необратимо."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={doDelete}
        contentClassName="max-w-md"
      />
    </>
  );
}