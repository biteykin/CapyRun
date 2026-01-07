import type { Meta, StoryObj } from "@storybook/react";
import WorkoutAiInsight from "./WorkoutAiInsight";
import { http, HttpResponse, delay } from "msw";

const meta: Meta<typeof WorkoutAiInsight> = {
  title: "Workouts/WorkoutAiInsight",
  component: WorkoutAiInsight,
  args: {
    workoutId: "workout-123",
  },
  parameters: {
    msw: {
      handlers: [
        http.post("/api/ai/workout-insight", async () => {
          await delay(600);
          return HttpResponse.json({ ok: true });
        }),
      ],
    },
  },
};

export default meta;

type Story = StoryObj<typeof WorkoutAiInsight>;

export const Default: Story = {};

export const EmptyState: Story = {
  args: {
    workoutId: "no-insight",
  },
};

export const SupabaseError: Story = {
  args: {
    workoutId: "error",
  },
};

export const GeneratingError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/ai/workout-insight", async () => {
          await delay(300);
          return new HttpResponse("Mock 500 error", { status: 500 });
        }),
      ],
    },
  },
};