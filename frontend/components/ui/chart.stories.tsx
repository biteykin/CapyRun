// components/ui/chart.stories.tsx
"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "./chart";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const meta: Meta<typeof ChartContainer> = {
  title: "UI/Chart",
  component: ChartContainer,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {},
};
export default meta;

type Story = StoryObj<typeof ChartContainer>;

// Примерные данные (время, темп и пульс)
const data = [
  { t: "00:00", pace: 5.2, hr: 110 },
  { t: "05:00", pace: 5.0, hr: 122 },
  { t: "10:00", pace: 4.8, hr: 131 },
  { t: "15:00", pace: 4.7, hr: 136 },
  { t: "20:00", pace: 4.9, hr: 138 },
  { t: "25:00", pace: 5.1, hr: 140 },
  { t: "30:00", pace: 5.0, hr: 139 },
];

// Конфиг подписей и цветов серий (используются CSS-переменные темы)
const config = {
  pace: {
    label: "Темп (мин/км)",
    color: "var(--chart-1)",
  },
  hr: {
    label: "Пульс (bpm)",
    color: "var(--chart-2)",
  },
} as const;

/** Площадной график с тултипом и легендой */
export const AreaPaceHr: Story = {
  render: () => (
    <ChartContainer className="max-w-3xl" config={config}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="pace"
          fill="var(--color-pace, var(--chart-1))"
          stroke="var(--color-pace, var(--chart-1))"
          name="pace"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="hr"
          fill="var(--color-hr, var(--chart-2))"
          stroke="var(--color-hr, var(--chart-2))"
          name="hr"
        />
      </AreaChart>
    </ChartContainer>
  ),
};

/** Линейный график (те же данные), чтобы показать совместимость */
export const LinePaceHr: Story = {
  render: () => (
    <ChartContainer className="max-w-3xl" config={config}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="pace"
          stroke="var(--color-pace, var(--chart-1))"
          dot={false}
          name="pace"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="hr"
          stroke="var(--color-hr, var(--chart-2))"
          dot={false}
          name="hr"
        />
      </LineChart>
    </ChartContainer>
  ),
};