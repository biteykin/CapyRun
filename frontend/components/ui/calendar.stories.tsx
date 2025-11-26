// components/ui/calendar.stories.tsx
"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Calendar } from "./calendar";

const meta: Meta<typeof Calendar> = {
  title: "UI/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    buttonVariant: {
      control: { type: "select" },
      options: ["primary", "secondary", "ghost", "warning", "success", "lemon", "light", "dropdown"],
      description: "Вариант кнопок навигации (влево/вправо)",
    },
    showOutsideDays: { control: "boolean" },
    captionLayout: {
      control: { type: "select" },
      options: ["label", "dropdown", "buttons"],
    },
    numberOfMonths: { control: { type: "number", min: 1, max: 3, step: 1 } },
  },
  args: {
    buttonVariant: "secondary",
    showOutsideDays: true,
    captionLayout: "label",
    numberOfMonths: 1,
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

/** Один месяц, одиночный выбор даты */
export const Basic: Story = {
  render: (args) => {
    const [selected, setSelected] = React.useState<Date | undefined>(new Date());
    return (
      <div className="max-w-[320px]">
        <Calendar
          {...args}
          mode="single"
          selected={selected}
          onSelect={setSelected}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Выбрано: {selected ? selected.toLocaleDateString() : "—"}
        </p>
      </div>
    );
  },
};

/** Диапазон дат с подсветкой «середины» диапазона */
export const Range: Story = {
  args: { numberOfMonths: 2 },
  render: (args) => {
    const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({});
    return (
      <div className="max-w-[660px]">
        <Calendar
          {...args}
          mode="range"
          selected={range}
          onSelect={(value) => setRange((value as any) ?? {})}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          От: {range.from ? range.from.toLocaleDateString() : "—"}{" "}
          · До: {range.to ? range.to.toLocaleDateString() : "—"}
        </p>
      </div>
    );
  },
};

/** Без дней соседних месяцев (outside days) */
export const NoOutsideDays: Story = {
  args: { showOutsideDays: false },
  render: (args) => {
    const [selected, setSelected] = React.useState<Date | undefined>();
    return (
      <div className="max-w-[320px]">
        <Calendar
          {...args}
          mode="single"
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    );
  },
};

/** Навигационные кнопки в стиле primary/ghost и т.п. */
export const WithButtonVariants: Story = {
  args: { buttonVariant: "primary", numberOfMonths: 2 },
  render: (args) => {
    const [selected, setSelected] = React.useState<Date | undefined>();
    return (
      <div className="max-w-[660px]">
        <Calendar
          {...args}
          mode="single"
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    );
  },
};