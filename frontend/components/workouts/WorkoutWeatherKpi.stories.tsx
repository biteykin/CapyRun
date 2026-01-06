import type { Meta, StoryObj } from "@storybook/react";
import WorkoutWeatherKpi from "./WorkoutWeatherKpi";

type Weather = {
  temp_c?: number;
  feelslike_c?: number;
  wind_kph?: number;
  gust_kph?: number;
  humidity?: number;
  pressure_hpa?: number;
  conditions?: string;
  wind_degree?: number;
  precip_mm?: number;
  cloud?: number;
  uv?: number;
  [k: string]: unknown;
};

const meta: Meta<typeof WorkoutWeatherKpi> = {
  title: "Workouts/WorkoutWeatherKpi",
  component: WorkoutWeatherKpi,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[340px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: { control: "radio", options: ["default", "compact"] },
    course_deg: { control: { type: "number", min: 0, max: 360, step: 5 } },
    wind_from_deg: { control: { type: "number", min: 0, max: 360, step: 5 } },
    weather: { control: "object" },
  },
};

export default meta;
type Story = StoryObj<typeof WorkoutWeatherKpi>;

const base = (w: Weather) => ({ weather: w });

export const SunnyFeelsLike: Story = {
  name: "Sunny + feels like",
  args: {
    ...base({
      temp_c: 22,
      feelslike_c: 25,
      wind_kph: 7,
      humidity: 45,
      pressure_hpa: 1016,
      conditions: "Sunny",
      uv: 6,
      cloud: 10,
    }),
  },
};

export const RainWithPrecip: Story = {
  name: "Rain + precip",
  args: {
    ...base({
      temp_c: 9,
      feelslike_c: 6,
      wind_kph: 18,
      gust_kph: 28,
      humidity: 92,
      pressure_hpa: 1003,
      conditions: "Light rain",
      precip_mm: 2.4,
      cloud: 90,
    }),
  },
};

export const CompactMode: Story = {
  name: "Compact",
  args: {
    variant: "compact",
    ...base({
      temp_c: 16,
      wind_kph: 10,
      humidity: 62,
      pressure_hpa: 1012,
      conditions: "Partly cloudy",
    }),
  },
};

export const Headwind: Story = {
  name: "Headwind (course + wind degree)",
  args: {
    variant: "compact",
    course_deg: 90, // бег на восток
    ...base({
      temp_c: 10,
      wind_kph: 24,
      wind_degree: 90, // ветер "откуда" = с востока => встречный
      humidity: 70,
      conditions: "Windy",
    }),
  },
};

export const Tailwind: Story = {
  name: "Tailwind",
  args: {
    variant: "compact",
    course_deg: 90, // на восток
    ...base({
      temp_c: 10,
      wind_kph: 24,
      wind_degree: 270, // ветер с запада => попутный
      humidity: 70,
      conditions: "Windy",
    }),
  },
};

export const Crosswind: Story = {
  name: "Crosswind",
  args: {
    variant: "compact",
    course_deg: 0, // на север
    ...base({
      temp_c: 12,
      wind_kph: 20,
      wind_degree: 90, // с востока => боковой
      humidity: 65,
      conditions: "Windy",
    }),
  },
};