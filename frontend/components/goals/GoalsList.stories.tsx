import type { Meta, StoryObj } from "@storybook/react";
import GoalsList from "./GoalsList.client";

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  status: string;
  date_from: string;
  date_to: string;
  target_json: any;
};

const demoGoals: GoalRow[] = [
  {
    id: "g1",
    title: "Регулярные тренировки 3–4 раза в неделю",
    type: "custom",
    sport: null,
    status: "active",
    date_from: "2025-01-01",
    date_to: "2025-03-31",
    target_json: {
      primary: "Хочу без напряга войти в режим и не пропускать тренировки",
      secondary: "Фокус на привычке, а не на результате",
      presets: ["regular", "start"],
      profile: {
        gender: "male",
        age: 35,
        height_cm: 180,
        weight_kg: 82,
      },
    },
  },
  {
    id: "g2",
    title: "Подготовка к полумарафону весной",
    type: "HM",
    sport: "run",
    status: "active",
    date_from: "2025-02-01",
    date_to: "2025-05-15",
    target_json: {
      primary: "Пробежать полумарафон за 2:00–2:10 без выноса мозга",
      secondary: "Улучшить общую выносливость и самочувствие",
      presets: ["race-hm"],
      profile: {
        gender: "male",
        age: 35,
        height_cm: 180,
        weight_kg: 82,
      },
    },
  },
  {
    id: "g3",
    title: "Снижение веса −5 кг",
    type: "weight",
    sport: null,
    status: "paused",
    date_from: "2025-01-15",
    date_to: "2025-04-30",
    target_json: {
      primary: "Сбросить около 5 кг без жестких диет",
      secondary: "Нормализовать сон и снизить стресс",
      presets: ["weight"],
      profile: {
        gender: "female",
        age: 32,
        height_cm: 168,
        weight_kg: 74,
      },
    },
  },
];

const meta = {
  title: "Goals/GoalsList",
  component: GoalsList,
  parameters: {
    layout: "padded",
  },
  args: {
    goals: demoGoals,
  },
} satisfies Meta<typeof GoalsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Список целей",
};

export const SingleGoal: Story = {
  name: "Одна цель",
  args: {
    goals: [demoGoals[0]],
  },
};