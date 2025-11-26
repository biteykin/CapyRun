// components/ui/avatar.stories.tsx
"use client";
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Размер аватара (визуально, управляется через Tailwind классы)",
    },
  },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

/** Базовый пример — аватар с изображением */
export const Default: Story = {
  render: () => (
    <Avatar className="size-16">
      <AvatarImage src="https://i.pravatar.cc/100?img=13" alt="@user" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

/** Если изображение не загрузилось — показываем fallback */
export const WithFallback: Story = {
  render: () => (
    <Avatar className="size-16">
      <AvatarImage src="/broken-image.jpg" alt="@broken" />
      <AvatarFallback className="bg-gray-200 text-gray-700 font-semibold">
        AB
      </AvatarFallback>
    </Avatar>
  ),
};

/** Несколько аватаров разных размеров */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="size-8">
        <AvatarImage src="https://i.pravatar.cc/100?img=4" alt="@small" />
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarImage src="https://i.pravatar.cc/100?img=15" alt="@medium" />
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar className="size-16">
        <AvatarImage src="https://i.pravatar.cc/100?img=7" alt="@large" />
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

/** С кастомным цветом фона и инициалами */
export const CustomColor: Story = {
  render: () => (
    <Avatar className="size-14">
      <AvatarFallback className="bg-[#F9BD2B] text-black font-semibold">
        IR
      </AvatarFallback>
    </Avatar>
  ),
};