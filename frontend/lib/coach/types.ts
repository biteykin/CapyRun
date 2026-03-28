import { z } from "zod";

export type WorkoutFact = {
  // NOTE: workouts are expected to be sorted by start_time desc in context
  id: string;
  sport: string | null;
  start_time: string | null;
  distance_m: number | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

export const PlannerSchema = z.object({
  intent: z.enum([
    "simple_fact",
    "plan",
    "forecast",
    "analysis",
    "injury",
    "nutrition",
    "strength",
    "other_sport",
    "account_app",
    "unknown",
  ]),

  response_mode: z.enum(["answer", "clarify"]).default("answer"),
  clarify_question: z.string().nullable().optional(),

  needs: z.object({
    workouts_window_days: z.number().int().min(0).max(365).default(14),
    workouts_limit: z.number().int().min(1).max(100).default(30),
    include_coach_home: z.boolean().default(false),
    include_thread_memory: z.boolean().default(true),
    include_geo: z.boolean().default(false),
    include_calendar: z.boolean().default(false),
  }),

  fast_path: z
    .object({
      enabled: z.boolean().default(false),
      kind: z
        .enum([
          "count_workouts",
          "list_workouts",
          "last_workout",
          "longest_workout",
          "sum_distance_run",
          "range_workout_stats",
          "nth_workout",
        ])
        .optional(),
      window_days: z.number().int().min(1).max(365).optional(),
      // nth_workout: 1 = last, 2 = previous, 3 = third from end...
      nth: z.number().int().min(1).max(50).optional(),
      // calendar range filtering (inclusive)
      from_iso: z.string().optional(),
      to_iso: z.string().optional(),
    })
    .optional(),

  memory_patch: z
    .object({
      goal: z.string().max(300).optional(),
      constraints: z.string().max(300).optional(),
      injury: z.string().max(300).optional(),
      preferred_days_per_week: z.number().int().min(0).max(14).optional(),
      preferred_session_minutes: z.number().int().min(5).max(240).optional(),
      sports_focus: z.array(z.string().max(40)).max(10).optional(),
      weekly_schedule: z
        .object({
          run_days: z.array(z.string().max(16)).max(7).optional(),
          ofp_days: z.array(z.string().max(16)).max(7).optional(),
        })
        .optional(),
    })
    .optional(),

  debug: z
    .object({
      rationale_short: z.string().max(600).optional(),
    })
    .optional(),
});

export type PlannerOut = z.infer<typeof PlannerSchema>;

/**
 * Structured plan contract for ticket #8:
 * responder may return both human-readable text and machine-readable plan JSON.
 * This JSON is stored in coach_messages.meta and later can be confirmed by the user
 * and written into user_plans / user_plan_sessions.
 */

export const StructuredPlanStepSchema = z
  .object({
    type: z.string().max(40).optional(),
    label: z.string().max(200),
    duration_min: z.number().int().min(0).max(600).nullable().optional(),
    distance_km: z.number().min(0).max(200).nullable().optional(),
    repeats: z.number().int().min(1).max(100).nullable().optional(),
    target: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

export type StructuredPlanStep = z.infer<typeof StructuredPlanStepSchema>;

export const StructuredPlanSessionSchema = z
  .object({
    day_index: z.number().int().min(0).max(120).nullable().optional(),
    date: z.string().max(32).nullable().optional(),
    weekday: z.string().max(32).nullable().optional(),

    title: z.string().max(200),
    sport: z.string().max(32).default("run"),
    session_type: z.string().max(40).nullable().optional(),
    status: z.enum(["planned", "draft"]).default("planned"),

    goal: z.string().max(500).nullable().optional(),
    duration_min: z.number().int().min(0).max(600).nullable().optional(),
    distance_km: z.number().min(0).max(200).nullable().optional(),
    effort: z.string().max(64).nullable().optional(),
    hr_target: z.string().max(128).nullable().optional(),

    warmup: z.string().max(1000).nullable().optional(),
    main: z.string().max(4000).nullable().optional(),
    cooldown: z.string().max(1000).nullable().optional(),

    steps: z.array(StructuredPlanStepSchema).max(100).default([]),

    strength_block: z.string().max(4000).nullable().optional(),
    fueling: z.string().max(2000).nullable().optional(),
    hydration: z.string().max(2000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),

    structure: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export type StructuredPlanSession = z.infer<typeof StructuredPlanSessionSchema>;

export const StructuredPlanSchema = z
  .object({
    version: z.literal(1).default(1),
    kind: z.enum(["draft_training_plan"]).default("draft_training_plan"),

    horizon_days: z.number().int().min(1).max(120),
    starts_on: z.string().max(32).nullable().optional(),
    ends_on: z.string().max(32).nullable().optional(),

    goal_id: z.string().uuid().nullable().optional(),
    goal_title: z.string().max(300).nullable().optional(),
    goal_date: z.string().max(32).nullable().optional(),

    source_message: z.string().max(4000).nullable().optional(),
    summary: z.string().max(4000).nullable().optional(),
    rationale: z.string().max(4000).nullable().optional(),

    overwrite_existing_on_confirm: z.boolean().default(true),
    overwrite_range: z
      .object({
        from: z.string().max(32),
        to: z.string().max(32),
      })
      .nullable()
      .optional(),

    sessions: z.array(StructuredPlanSessionSchema).min(1).max(120),

    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export type StructuredPlan = z.infer<typeof StructuredPlanSchema>;

export const ResponderResultSchema = z
  .object({
    text: z.string(),
    structured_plan: StructuredPlanSchema.nullable().optional(),
  })
  .strict();

export type ResponderResult = z.infer<typeof ResponderResultSchema>;