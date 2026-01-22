// frontend/components/coach/CoachHome.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import CoachHome from "./CoachHome.client";

const meta: Meta<typeof CoachHome> = {
  title: "Coach/CoachHome",
  component: CoachHome,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[900px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CoachHome>;

export const StableLowRisk: Story = {
  name: "Stable • Low risk",
  args: {
    state: {
      readiness_score: 65,
      trend: "flat",
      risk_level: "low",
      signals: {
        volume: {
          km7: 16.05,
          expected7: 16.01,
          ratio: 1.003,
          trend: "flat",
        },
        load: {
          load7: 0,
          load28: 0,
          readiness: 65,
        },
      },
      computed_from: {
        windows_days: [7, 28],
        last_workout_at: "2026-01-21T19:11:42+00:00",
        workouts_count_7d: 4,
        workouts_count_28d: 13,
      },
    },
    snapshot: {
      id: "4c56a03f-0c50-4315-ac0e-21a146cc28e5",
      status: "active",
      as_of: "2026-01-22T08:55:03.530762+00:00",
      reason: "queue:workout_changed",
    },
  },
};

export const ImprovingForm: Story = {
  name: "Improving • Trend up",
  args: {
    state: {
      readiness_score: 78,
      trend: "up",
      risk_level: "low",
      signals: {
        volume: {
          km7: 22.4,
          expected7: 18.0,
          ratio: 1.24,
          trend: "up",
        },
        load: {
          load7: 35,
          load28: 28,
          readiness: 78,
        },
      },
      computed_from: {
        windows_days: [7, 28],
        last_workout_at: "2026-01-22T07:30:00+00:00",
        workouts_count_7d: 6,
        workouts_count_28d: 16,
      },
    },
    snapshot: {
      id: "a18c9e01-0d7a-4a40-9c5c-4c1a21a7c9e2",
      status: "active",
      as_of: "2026-01-22T08:00:00+00:00",
      reason: "queue:auto",
    },
  },
};

export const FatigueWarning: Story = {
  name: "Fatigue • Medium risk",
  args: {
    state: {
      readiness_score: 48,
      trend: "down",
      risk_level: "medium",
      signals: {
        volume: {
          km7: 30.2,
          expected7: 18.5,
          ratio: 1.63,
          trend: "up",
        },
        load: {
          load7: 85,
          load28: 52,
          readiness: 48,
        },
      },
      computed_from: {
        windows_days: [7, 28],
        last_workout_at: "2026-01-21T21:10:00+00:00",
        workouts_count_7d: 7,
        workouts_count_28d: 19,
      },
    },
    snapshot: {
      id: "d72b94ff-9e59-4b71-9f62-82b0c3e1f44c",
      status: "active",
      as_of: "2026-01-22T09:10:00+00:00",
      reason: "queue:workout_changed",
    },
  },
};

export const HighRiskOverload: Story = {
  name: "Overload • High risk",
  args: {
    state: {
      readiness_score: 32,
      trend: "down",
      risk_level: "high",
      signals: {
        volume: {
          km7: 38.0,
          expected7: 20.0,
          ratio: 1.9,
          trend: "up",
        },
        load: {
          load7: 120,
          load28: 70,
          readiness: 32,
        },
      },
      computed_from: {
        windows_days: [7, 28],
        last_workout_at: "2026-01-22T06:45:00+00:00",
        workouts_count_7d: 8,
        workouts_count_28d: 22,
      },
    },
    snapshot: {
      id: "f03a1d20-4f8a-4b91-b6e1-9e4a2d0c91a3",
      status: "active",
      as_of: "2026-01-22T09:30:00+00:00",
      reason: "queue:overload_detected",
    },
  },
};

export const EmptyState: Story = {
  name: "Empty / No data",
  args: {
    state: {
      readiness_score: 0,
      trend: "flat",
      risk_level: "low",
      signals: {},
      computed_from: {},
    },
    snapshot: null,
  },
};