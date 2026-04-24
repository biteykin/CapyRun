"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Dumbbell,
  Flag,
  Gauge,
  Route,
  Sparkles,
  Timer,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  kind?: "planned" | "workout" | "goal";
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

type PlannedHrZoneChip = {
  value?: string;
  label?: string;
  range?: string | null;
  color?: string | null;
};

// Цвета из Colors (Storybook):
// bg-success, bg-yellow, data-color-11
const COLOR_COMPLETED = "#2D7601"; // выполнена
const COLOR_MISSED = "#F6B021";    // пропущена
const COLOR_PLANNED = "#0C5BF9";   // запланирована (data-color-11)

const HR_ZONE_OPTIONS = [
  { value: "Z1", label: "Z1 · восстановление" },
  { value: "Z2", label: "Z2 · лёгкая аэробная" },
  { value: "Z3", label: "Z3 · умеренная" },
  { value: "Z4", label: "Z4 · пороговая" },
  { value: "Z5", label: "Z5 · максимальная" },
];

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
  const router = useRouter();

  const initialMonth = React.useMemo(
    () => new Date(initialMonthISO),
    [initialMonthISO]
  );

  const [selected, setSelected] = React.useState<ExtendedEvent | null>(null);
  const [calendarEventsState, setCalendarEventsState] = React.useState<PlanEvent[]>(events);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDate, setCreateDate] = React.useState<string>("");
  const [createTitle, setCreateTitle] = React.useState("");
  const [createSport, setCreateSport] = React.useState("run");
  const [createDurationMin, setCreateDurationMin] = React.useState("");
  const [createDistanceKm, setCreateDistanceKm] = React.useState("");
  const [createEffort, setCreateEffort] = React.useState("");
  const [createHrZones, setCreateHrZones] = React.useState<string[]>([]);
  const [hrZonesOpen, setHrZonesOpen] = React.useState(false);
  const [createNotes, setCreateNotes] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

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
      if (createOpen) return;

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
  }, [selected, prevEvent, nextEvent, confirmDeleteOpen, createOpen]);

  React.useEffect(() => {
    setCalendarEventsState(events);
  }, [events]);

  const handleEventClick = (evt: PlanEvent) => {
    setSelected(evt as ExtendedEvent);
  };

  const handleDayClick = (isoDate: string) => {
    setCreateDate(isoDate);
    setCreateTitle("");
    setCreateSport("run");
    setCreateDurationMin("");
    setCreateDistanceKm("");
    setCreateEffort("");
    setCreateHrZones([]);
    setCreateNotes("");
    setCreateError(null);
    setCreateOpen(true);
  };

  // 👉 теперь кликаем по ЛЮБОЙ части дня (даже если есть карточки)
  // это важно: прокидываем хендлер вниз и используем stopPropagation в карточках

  const handleCreatePlannedWorkout = React.useCallback(async () => {
    if (isCreating) return;

    const title = createTitle.trim();
    const durationMin = createDurationMin.trim() ? Number(createDurationMin) : null;
    const distanceVisible = createSport !== "strength" && createSport !== "other";
    const distanceKm =
      distanceVisible && createDistanceKm.trim() ? Number(createDistanceKm) : null;

    if (!createDate) {
      setCreateError("Не выбрана дата.");
      return;
    }

    if (!title) {
      setCreateError("Укажите название тренировки.");
      return;
    }

    if (!createSport) {
      setCreateError("Выберите тип тренировки.");
      return;
    }

    if (
      durationMin != null &&
      (!Number.isFinite(durationMin) || durationMin <= 0)
    ) {
      setCreateError("Длительность должна быть больше 0.");
      return;
    }

    if (distanceKm != null && (!Number.isFinite(distanceKm) || distanceKm <= 0)) {
      setCreateError("Некорректная дистанция.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("Пользователь не авторизован.");

      const structure = {
        source: "manual",
        goal: title,
        main: createNotes.trim() || null,
        notes: createNotes.trim() || null,
        effort: createEffort.trim() || null,
        hr_target: createHrZones.length ? createHrZones.join(", ") : null,
        hr_zones: createHrZones,
        duration_min: durationMin,
        distance_km: distanceKm,
      };

      const { data, error } = await supabase
        .from("user_plan_sessions")
        .insert({
          user_id: user.id,
          user_plan_id: null, // 👈 FIX: убираем NOT NULL проблему
          planned_date: createDate,
          sport: createSport as any,
          status: "planned",
          title,
          notes: createNotes.trim() || null,
          structure,
          updated_at: new Date().toISOString(),
        } as any)
        .select("id, user_plan_id, planned_date, sport, status, title, notes, structure, link_workout_id")
        .single();

      if (error) {
        console.error(
          "create planned workout failed",
          JSON.stringify(error, null, 2)
        );
        if (error.message?.includes("user_plan_id")) {
          throw new Error("Не удалось создать тренировку. План ещё не инициализирован.");
        }
        throw new Error("Ошибка сохранения тренировки. Попробуйте ещё раз.");
      }

      const createdEvent: PlanEvent = {
        id: data.id,
        date: data.planned_date,
        title: data.title || title,
        kind: "planned",
        status: data.status,
        sport: createSport,
        description: data.structure?.notes ?? data.notes ?? data.structure?.main ?? null,
        user_plan_id: data.user_plan_id,
        link_workout_id: data.link_workout_id,
        structure: data.structure ?? null,
        notes: data.notes ?? data.structure?.notes ?? null,
        goal: data.structure?.goal ?? null,
        main: data.structure?.main ?? null,
        effort: data.structure?.effort ?? null,
        hr_target: createHrZones.length ? createHrZones.join(", ") : null,
        planned_distance_km: data.structure?.distance_km ?? null,
        planned_duration_min: data.structure?.duration_min ?? null,
        planned_date: data.planned_date,
        source: "manual",
      };

      setCalendarEventsState((prev) => [...prev, createdEvent]);
      setCreateOpen(false);
    } catch (e: any) {
      console.error("create planned workout failed", e);
      setCreateError(e?.message ?? "Не удалось создать плановую тренировку.");
    } finally {
      setIsCreating(false);
    }
  }, [
    createDate,
    createDistanceKm,
    createDurationMin,
    createEffort,
    createHrZones,
    createNotes,
    createSport,
    createTitle,
    isCreating,
  ]);

  const isDistanceVisible =
    createSport !== "strength" && createSport !== "other";

  const isCreateValid =
    !!createDate &&
    !!createSport &&
    createTitle.trim().length > 0 &&
    (createDurationMin === "" || Number(createDurationMin) > 0);

  function toggleHrZone(zone: string) {
    setCreateHrZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  }

  const dateStr = selected ? formatDateRu(selected.date) : "—";
  const description = (selected?.description as string | null | undefined) ?? null;
  const sport = selected?.sport ?? null;
  const distanceStr = formatDistance(selected?.distance_m);
  const durationStr = formatDuration(selected?.duration_sec);
  const structure = selected?.structure ?? null;
  const plannedMain = structure?.main ?? (selected as any)?.main ?? null;
  const plannedEffort = structure?.effort ?? (selected as any)?.effort ?? null;
  const plannedHrTarget = structure?.hr_target ?? (selected as any)?.hr_target ?? null;
  const plannedHrZones: PlannedHrZoneChip[] = (() => {
    const raw = (structure as any)?.hr_zones;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((z: unknown, i: number) => {
      if (typeof z === "string") {
        return { value: z, label: z };
      }
      if (z && typeof z === "object") {
        const o = z as PlannedHrZoneChip;
        return {
          value: o.value,
          label: o.label,
          range: o.range,
          color: o.color,
        };
      }
      return { value: String(z ?? i) };
    });
  })();
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
  const isGoal = selected?.kind === "goal";
  const isWorkout = selected?.kind === "workout";

  const purposeLabel = getTrainingPurposeLabel(selected);
  const executionTips = getExecutionTips(selected);

  const doDelete = React.useCallback(async () => {
    if (!selected || !isPlanned || isDeleting) return;

    try {
      setIsDeleting(true);

      const isManualPlannedWorkout =
        selected.source === "manual" ||
        selected.structure?.source === "manual" ||
        !selected.user_plan_id;

      const result = isManualPlannedWorkout
        ? await supabase.from("user_plan_sessions").delete().eq("id", selected.id)
        : await supabase
            .from("user_plan_sessions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", selected.id);

      const { error } = result;

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
        onDayClick={handleDayClick}
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
                {!isGoal ? (
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
                ) : null}
              </div>

              {isGoal ? (
                <Card className="gap-4 bg-[rgba(255,214,0,0.12)] py-5">
                  <CardContent className="space-y-4 px-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-3xl">
                        {(selected as any)?.goal_icon ?? "🎯"}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Цель в календаре
                        </div>
                        <div className="text-xl font-bold leading-tight">
                          {selected?.title || "Цель"}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background/65 p-4 text-sm text-muted-foreground">
                      {selected?.description || "Дата завершения цели."}
                    </div>

                    {/* CTA */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelected(null);
                          router.push("/goals");
                        }}
                      >
                        Перейти к целям
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : isPlanned ? (
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
                        {plannedHrZones.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {plannedHrZones.map((zone, idx) => (
                              <span
                                key={zone.value ?? zone.label ?? String(idx)}
                                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/20 px-2.5 py-1 text-xs font-medium"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: zone.color ?? "#1B2EC9" }}
                                />
                                <span>{zone.value ?? zone.label}</span>
                                {zone.range ? (
                                  <span className="text-muted-foreground">{zone.range}</span>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm font-medium">
                            {plannedHrTarget || "без ориентира по пульсу"}
                          </div>
                        )}
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Route className="h-4 w-4" />
                          Дистанция
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{distanceStr}</div>
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          Время
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">{durationStr}</div>
                      </CardContent>
                    </Card>

                    <Card className="gap-4 py-4">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Activity className="h-4 w-4" />
                          Тип
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <div className="text-sm font-medium">
                          <SportBadge sport={sport} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-sm font-semibold">Описание тренировки</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <div className="text-sm text-muted-foreground">{description || "—"}</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-row justify-end gap-2 border-t px-6 py-4">
            {isWorkout && selected?.link_workout_id ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const workoutId = selected.link_workout_id;
                  setSelected(null);
                  setConfirmDeleteOpen(false);
                  window.location.href = `/workouts/${workoutId}`;
                }}
              >
                Перейти
              </Button>
            ) : null}

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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <RD.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
              "rounded-[var(--radius-lg,var(--radius))] border border-border bg-background p-0 text-foreground shadow-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="border-b px-6 py-5">
              <DialogTitle>Создать плановую тренировку</DialogTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                Добавьте тренировку в план на {formatDateRu(createDate)}.
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="planned-title">Название</Label>
                  <Input
                    id="planned-title"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Например: Лёгкий бег 40 минут"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Вид тренировки</Label>
                  <Select value={createSport} onValueChange={setCreateSport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите спорт" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="run">Бег</SelectItem>
                      <SelectItem value="ride">Вело</SelectItem>
                      <SelectItem value="swim">Плавание</SelectItem>
                      <SelectItem value="strength">ОФП / силовая</SelectItem>
                      <SelectItem value="walk">Ходьба</SelectItem>
                      <SelectItem value="other">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planned-effort">Интенсивность</Label>
                  <Input
                    id="planned-effort"
                    value={createEffort}
                    onChange={(e) => setCreateEffort(e.target.value)}
                    placeholder="Легко / умеренно / тяжело"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planned-duration">Длительность, мин</Label>
                  <Input
                    id="planned-duration"
                    type="number"
                    inputMode="numeric"
                    value={createDurationMin}
                    onChange={(e) => setCreateDurationMin(e.target.value)}
                    placeholder="40"
                  />
                </div>

                {isDistanceVisible ? (
                  <div className="space-y-2">
                    <Label htmlFor="planned-distance">Дистанция, км</Label>
                    <Input
                      id="planned-distance"
                      type="number"
                      inputMode="decimal"
                      value={createDistanceKm}
                      onChange={(e) => setCreateDistanceKm(e.target.value)}
                      placeholder="6.0"
                    />
                  </div>
                ) : null}

                <div className="space-y-2 sm:col-span-2">
                  <Label>Пульсовые зоны</Label>
                  <Popover open={hrZonesOpen} onOpenChange={setHrZonesOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {createHrZones.length
                            ? createHrZones.join(", ")
                            : "Выберите одну или несколько зон"}
                        </span>
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandList>
                          <CommandEmpty>Зоны не найдены</CommandEmpty>
                          <CommandGroup>
                            {HR_ZONE_OPTIONS.map((zone) => {
                              const zoneSelected = createHrZones.includes(zone.value);
                              return (
                                <CommandItem
                                  key={zone.value}
                                  value={zone.label}
                                  onSelect={() => toggleHrZone(zone.value)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 size-4",
                                      zoneSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {zone.label}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="text-xs text-muted-foreground">
                    Можно выбрать несколько зон, например Z2 и Z3
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="planned-notes">План и заметки</Label>
                  <Textarea
                    id="planned-notes"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    rows={4}
                    placeholder="Например: 10 минут разминки, затем ровный лёгкий бег. После — заминка и растяжка."
                  />
                </div>
              </div>

              {createError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {createError}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isCreating}
                onClick={() => setCreateOpen(false)}
              >
                Отменить
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isCreating || !isCreateValid}
                onClick={() => void handleCreatePlannedWorkout()}
              >
                {isCreating ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </RD.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}