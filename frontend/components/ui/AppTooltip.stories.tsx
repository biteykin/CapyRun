// components/ui/AppTooltip.stories.tsx
"use client";
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AppTooltip } from "./AppTooltip";
import { Button } from "./button";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { TooltipProvider } from "./tooltip";

const meta: Meta<typeof AppTooltip> = {
  title: "UI/AppTooltip",
  component: AppTooltip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => <TooltipProvider delayDuration={100}><Story /></TooltipProvider>,
  ],
  argTypes: {
    side: {
      control: "radio",
      options: ["top", "bottom", "left", "right"],
    },
    align: {
      control: "radio",
      options: ["start", "center", "end"],
    },
    disableOnTouch: {
      control: "boolean",
    },
  },
  args: {
    side: "top",
    align: "center",
    disableOnTouch: true,
    content: "Подсказка",
  },
};
export default meta;

type Story = StoryObj<typeof AppTooltip>;

/** Базовый пример: тултип над кнопкой */
export const Basic: Story = {
  render: (args) => (
    <AppTooltip {...args}>
      <Button variant="secondary">Наведи курсор</Button>
    </AppTooltip>
  ),
};

/** Тултип с иконкой */
export const WithIcon: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <AppTooltip {...args} content="Информация о тренировке">
        <InfoCircledIcon className="h-5 w-5 cursor-pointer text-gray-700 hover:text-black" />
      </AppTooltip>

      <span className="text-sm text-gray-600">
        Наведи на иконку, чтобы увидеть подсказку.
      </span>
    </div>
  ),
};

/** Размещения (все стороны) */
export const Placements: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 text-center">
      <AppTooltip content="Сверху" side="top">
        <Button>Top</Button>
      </AppTooltip>
      <AppTooltip content="Снизу" side="bottom">
        <Button>Bottom</Button>
      </AppTooltip>
      <AppTooltip content="Слева" side="left">
        <Button>Left</Button>
      </AppTooltip>
      <AppTooltip content="Справа" side="right">
        <Button>Right</Button>
      </AppTooltip>
    </div>
  ),
};

/** Тултип с кастомным контентом */
export const RichContent: Story = {
  render: () => (
    <AppTooltip
      side="right"
      align="start"
      content={
        <div className="space-y-1">
          <div className="font-medium">Рекомендация</div>
          <div className="text-xs text-muted-foreground">
            После пробежки в Z2 добавь растяжку и восстановление.
          </div>
        </div>
      }
    >
      <Button variant="primary">Совет дня</Button>
    </AppTooltip>
  ),
};