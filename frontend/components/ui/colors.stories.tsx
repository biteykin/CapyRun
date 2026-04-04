import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS_NAMED, rgbString } from "./colors";

const meta: Meta = {
  title: "UI/Colors",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

function getTextColor(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "#0E0E0E";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0E0E0E" : "#FFFFFF";
}

function stripedBackground(lightHex: string, darkHex: string) {
  return `repeating-linear-gradient(
    -45deg,
    ${lightHex} 0px,
    ${lightHex} 8px,
    ${darkHex} 8px,
    ${darkHex} 16px
  )`;
}

function SwatchCard(props: {
  hex: string;
  label: string;
  striped?: boolean;
  stripeHex?: string;
}) {
  const { hex, label, striped = false, stripeHex } = props;
  const rgb = rgbString(hex);
  const textColor = getTextColor(hex);

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div
        className="flex h-14 items-end justify-between px-2.5 py-2"
        style={{
          background: striped && stripeHex ? stripedBackground(hex, stripeHex) : hex,
          color: striped && stripeHex ? getTextColor(stripeHex) : textColor,
        }}
      >
        <div className="truncate text-[11px] font-semibold leading-tight">{label}</div>
        {striped ? (
          <div className="ml-2 shrink-0 rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[9px] font-medium text-black">
            striped
          </div>
        ) : null}
      </div>
      <div className="space-y-0.5 px-2.5 py-2 text-[11px] leading-tight">
        <div className="font-medium">{hex}</div>
        <div className="text-muted-foreground">rgb({rgb})</div>
      </div>
    </div>
  );
}

function PaletteSection(props: { title: string; items: { hex: string; name: string }[] }) {
  const { title, items } = props;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="text-xs text-muted-foreground">{items.length} цветов</div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => (
          <SwatchCard key={`${title}-${item.name}`} hex={item.hex} label={item.name} />
        ))}
      </div>
    </section>
  );
}

function AnalyticsStripedSection() {
  const analytics = COLORS_NAMED.analytics ?? [];

  const pairs = [
    { solid: analytics.find((x) => x.name === "analytics-blue-light"), stripe: analytics.find((x) => x.name === "analytics-blue") },
    { solid: analytics.find((x) => x.name === "analytics-purple-light"), stripe: analytics.find((x) => x.name === "analytics-purple") },
    { solid: analytics.find((x) => x.name === "analytics-green-light"), stripe: analytics.find((x) => x.name === "analytics-green") },
    { solid: analytics.find((x) => x.name === "analytics-red-light"), stripe: analytics.find((x) => x.name === "analytics-red") },
    { solid: analytics.find((x) => x.name === "analytics-yellow-light"), stripe: analytics.find((x) => x.name === "analytics-yellow") },
    { solid: analytics.find((x) => x.name === "analytics-teal-light"), stripe: analytics.find((x) => x.name === "analytics-teal") },
  ].filter((x) => x.solid && x.stripe) as Array<{
    solid: { hex: string; name: string };
    stripe: { hex: string; name: string };
  }>;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">analytics striped</h3>
        <div className="text-xs text-muted-foreground">
          светлая база + тёмная диагональная полоска
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {pairs.map((pair) => (
          <SwatchCard
            key={`${pair.solid.name}-${pair.stripe.name}`}
            hex={pair.solid.hex}
            label={`${pair.solid.name} + ${pair.stripe.name}`}
            striped
            stripeHex={pair.stripe.hex}
          />
        ))}
      </div>
    </section>
  );
}

function AnalyticsChartPreview() {
  const analytics = COLORS_NAMED.analytics ?? [];
  const lookup = Object.fromEntries(analytics.map((x) => [x.name, x.hex]));

  const data = [
    { name: "Пн", value: 42, fill: lookup["analytics-blue"] ?? "#2949F6" },
    { name: "Вт", value: 28, fill: lookup["analytics-purple"] ?? "#59229F" },
    { name: "Ср", value: 36, fill: lookup["analytics-green"] ?? "#4E8424" },
    { name: "Чт", value: 18, fill: lookup["analytics-red"] ?? "#CA4623" },
    { name: "Пт", value: 31, fill: lookup["analytics-yellow"] ?? "#F09137" },
    { name: "Сб", value: 26, fill: lookup["analytics-teal"] ?? "#2CB7B0" },
    { name: "Вс", value: 22, fill: lookup["analytics-navy"] ?? "#283158" },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">analytics chart preview</h3>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 text-xs text-muted-foreground">
          Пример столбчатой диаграммы на новых цветах
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#D8DAD5" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

export const Overview: Story = {
  render: () => (
    <div className="space-y-6">
      {Object.entries(COLORS_NAMED).map(([group, shades]) => (
        <PaletteSection key={group} title={group} items={shades} />
      ))}
      <AnalyticsStripedSection />
      <AnalyticsChartPreview />
    </div>
  ),
};
