"use client";

import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import CoachChat from "./CoachChat.client";

const meta: Meta<typeof CoachChat> = {
  title: "Coach/CoachChat",
  component: CoachChat,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof CoachChat>;

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_THREAD_ID = "22222222-2222-2222-2222-222222222222";

export const Default: Story = {
  render: () => (
    <div className="h-[600px] max-w-3xl mx-auto">
      <CoachChat
        threadId={DEMO_THREAD_ID}
        currentUserId={DEMO_USER_ID}
        initialMessages={[
          {
            id: "m1",
            thread_id: DEMO_THREAD_ID,
            author_id: DEMO_USER_ID,
            type: "system",
            body: "Это демо-диалог с тренером. Здесь будет история общения.",
            meta: null,
            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          },
          {
            id: "m2",
            thread_id: DEMO_THREAD_ID,
            author_id: DEMO_USER_ID,
            type: "user",
            body: "Привет! Я хочу готовиться к полумарафону за 2 часа. Сейчас бегаю 10 км за 1:05. С чего начать?",
            meta: null,
            created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          },
          {
            id: "m3",
            thread_id: DEMO_THREAD_ID,
            author_id: DEMO_USER_ID,
            type: "coach",
            body:
              "Отличная цель! Я бы предложил начать с 3–4 пробежек в неделю: 1 лёгкая, 1 интервальная, 1 длительная и по возможности 1 укрепляющая ОФП. " +
              "Сейчас важно аккуратно нарастить объём и не гнаться за скоростью.",
            meta: { demo: true },
            created_at: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
          },
        ]}
      />
    </div>
  ),
};

export const EmptyThread: Story = {
  render: () => (
    <div className="h-[600px] max-w-3xl mx-auto">
      <CoachChat
        threadId={DEMO_THREAD_ID}
        currentUserId={DEMO_USER_ID}
        initialMessages={[]}
      />
    </div>
  ),
};