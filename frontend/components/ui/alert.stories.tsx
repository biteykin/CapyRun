// components/ui/alert.stories.tsx
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertTitle, AlertDescription } from "./alert";
import { InfoCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["default", "destructive"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

/** Базовое уведомление */
export const Default: Story = {
  args: { variant: "default" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Информация</AlertTitle>
      <AlertDescription>
        Это стандартное уведомление. Используется для вывода нейтральных сообщений пользователю.
      </AlertDescription>
    </Alert>
  ),
};

/** Вариант с ошибкой / предупреждением */
export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Ошибка при сохранении</AlertTitle>
      <AlertDescription>
        Не удалось сохранить тренировку. Проверьте соединение с интернетом и попробуйте снова.
      </AlertDescription>
    </Alert>
  ),
};

/** С иконкой */
export const WithIcon: Story = {
  render: () => (
    <div className="space-y-4">
      <Alert>
        <InfoCircledIcon />
        <div>
          <AlertTitle>Совет</AlertTitle>
          <AlertDescription>
            Для точного расчёта пульсовых зон рекомендуется указать ЧСС покоя и максимум.
          </AlertDescription>
        </div>
      </Alert>

      <Alert variant="destructive">
        <ExclamationTriangleIcon />
        <div>
          <AlertTitle>Ошибка авторизации</AlertTitle>
          <AlertDescription>
            Ваша сессия устарела. Войдите заново, чтобы продолжить работу.
          </AlertDescription>
        </div>
      </Alert>
    </div>
  ),
};