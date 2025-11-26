// components/ui/alert-dialog.stories.tsx
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./alert-dialog";
import { Button } from "./button";

const meta: Meta<typeof AlertDialog> = {
  title: "UI/AlertDialog",
  component: AlertDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof AlertDialog>;

/**
 * Базовый пример: подтверждение удаления элемента.
 * (Показывает заголовок, описание, и две кнопки.)
 */
export const Basic: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="primary">Удалить элемент</Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие необратимо. Тренировка будет удалена навсегда из вашего профиля.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/**
 * Пример с кастомными размерами и дополнительным текстом.
 */
export const LongText: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary">Показать длинный текст</Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Внимание: обновление профиля</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Вы собираетесь внести изменения в профиль, включая данные тренировок и планов.
            </p>
            <p>
              Убедитесь, что введённые значения корректны. После сохранения старые данные будут заменены.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction>Продолжить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/**
 * Показывает, как можно вызывать диалог из любого JSX (через `asChild`).
 */
export const CustomTrigger: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div
          className="cursor-pointer select-none rounded-md border border-dashed border-gray-400 p-4 text-center text-sm text-gray-500 hover:bg-gray-50"
        >
          Нажмите сюда, чтобы открыть диалог
        </div>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Пример с произвольным триггером</AlertDialogTitle>
          <AlertDialogDescription>
            Клик по любому элементу, обёрнутому в <code>asChild</code>, откроет окно.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Закрыть</AlertDialogCancel>
          <AlertDialogAction>Ок</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};