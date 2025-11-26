// components/ui/badge.stories.tsx
"use client";
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
      description: "Вариант бейджа",
    },
    children: {
      control: "text",
      description: "Текст внутри бейджа",
    },
  },
  args: {
    variant: "default",
    children: "Badge",
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

/** Базовый пример */
export const Basic: Story = {};

/** Все варианты бейджей рядом */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

/** Бейджи с кастомными примерами (например, статусами) */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Активен</Badge>
      <Badge variant="secondary">Черновик</Badge>
      <Badge variant="outline">Ожидание</Badge>
      <Badge variant="destructive">Удалён</Badge>
    </div>
  ),
};

/** Несколько бейджей в одной строке — типичный кейс для тегов */
export const Tags: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Run</Badge>
      <Badge variant="secondary">10 km</Badge>
      <Badge variant="outline">Zone 2</Badge>
      <Badge variant="destructive">Cancelled</Badge>
    </div>
  ),
};