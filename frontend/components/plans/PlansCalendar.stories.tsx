import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import PlansCalendar, { PlansCalendarProps } from "./PlansCalendar.client";

const meta: Meta<typeof PlansCalendar> = {
  title: "Plans/PlansCalendar",
  component: PlansCalendar,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof PlansCalendar>;

const demoEvents: NonNullable<PlansCalendarProps["events"]> = [
  { id: "e1", date: "2025-11-03", title: "Лёгкий бег 6км", colorHex: "#4E8E27" },
  { id: "e2", date: "2025-11-03", title: "Заминка 10 мин", colorHex: "#C4C6C0" },
  { id: "e3", date: "2025-11-05", title: "Силовая (ноги)", colorHex: "#934FFF" },
  { id: "e4", date: "2025-11-08", title: "Интервалы 8×400м", colorHex: "#F3950A" },
  { id: "e5", date: "2025-11-12", title: "Зона 2 — 45 мин", colorHex: "#2D7601" },
  { id: "e6", date: "2025-11-18", title: "Темповый 5км", colorHex: "#EB3646" },
  { id: "e7", date: "2025-11-21", title: "Велотренажёр 30 мин", colorHex: "#1519FE" },
];

export const Basic: Story = {
  render: () => (
    <div style={{ maxWidth: 980 }}>
      <PlansCalendar
        initialMonth={new Date("2025-11-01")}
        events={demoEvents}
        onDayClick={(d) => console.log("day:", d)}
        onEventClick={(e) => console.log("event:", e)}
      />
    </div>
  ),
};

export const EmptyMonth: Story = {
  render: () => (
    <div style={{ maxWidth: 980 }}>
      <PlansCalendar initialMonth={new Date("2025-12-01")} events={[]} />
    </div>
  ),
};