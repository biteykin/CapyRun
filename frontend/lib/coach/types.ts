import { z } from "zod";

export type WorkoutFact = {
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
          "nth_workout",
        ])
        .optional(),
      window_days: z.number().int().min(1).max(365).optional(),
      // nth_workout: 1 = last, 2 = previous, 3 = third from end...
      nth: z.number().int().min(1).max(50).optional(),
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
    })
    .optional(),

  debug: z
    .object({
      rationale_short: z.string().max(600).optional(),
    })
    .optional(),
});

export type PlannerOut = z.infer<typeof PlannerSchema>;