// components/ui/card.stories.tsx
"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};
export default meta;

type Story = StoryObj<typeof Card>;

/** Базовая карточка с заголовком, описанием и контентом */
export const Basic: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Карточка</CardTitle>
        <CardDescription>Пример базового использования</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Карточка — универсальный контейнер для отображения информации,
          действий и описаний.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Действие</Button>
      </CardFooter>
    </Card>
  ),
};

/** Карточка с кнопкой действий в шапке */
export const WithAction: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
        <CardDescription>Общая информация</CardDescription>
        <CardAction>
          <Button size="sm" variant="secondary">
            Изменить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Имя</dt>
            <dd>Иван Петров</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Email</dt>
            <dd>ivan@example.com</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Button variant="primary" size="sm">
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  ),
};

/** Карточка с несколькими секциями */
export const MultipleSections: Story = {
  render: () => (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Активность</CardTitle>
          <CardDescription>Статистика тренировок</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">42</p>
          <p className="text-sm text-muted-foreground">Тренировок за месяц</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пульс</CardTitle>
          <CardDescription>Средний за неделю</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">132 bpm</p>
          <p className="text-sm text-muted-foreground">Зона 2</p>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Темная карточка для теста контраста */
export const DarkBackground: Story = {
  render: () => (
    <div className="bg-[#0E0E0E] p-6">
      <Card className="max-w-sm border border-border-light bg-[#141414] text-white">
        <CardHeader>
          <CardTitle>Dark Card</CardTitle>
          <CardDescription>Для тёмных секций интерфейса</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-300">
            Подходит для тёмных панелей и аналитических экранов.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" size="sm">
            Подробнее
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};