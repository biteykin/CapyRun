import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import CoachMessageBubble from "./CoachMessageBubble";
import CoachPlanActions from "./CoachPlanActions";

const meta: Meta<typeof CoachPlanActions> = {
  title: "Coach/CoachPlanActions",
  component: CoachPlanActions,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof CoachPlanActions>;

function DemoWrap(props: React.ComponentProps<typeof CoachPlanActions>) {
  return (
    <div className="max-w-3xl rounded-xl border bg-background p-4">
      <div className="rounded-md border bg-muted/10 p-3">
        <CoachMessageBubble
          role="coach"
          body={
            <>
              <div className="font-medium">План на неделю готов ✅</div>
              <div className="mt-1">
                Я собрал план на ближайшие 7 дней. Если всё ок — добавим его в календарь.
              </div>
              <CoachPlanActions {...props} />
            </>
          }
          createdAt={new Date().toISOString()}
          hydrated
        />
      </div>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <DemoWrap {...args} />,
  args: {},
};

export const Loading: Story = {
  render: (args) => <DemoWrap {...args} />,
  args: {
    isLoading: true,
  },
};

export const Disabled: Story = {
  render: (args) => <DemoWrap {...args} />,
  args: {
    disabled: true,
  },
};

export const CustomLabels: Story = {
  render: (args) => <DemoWrap {...args} />,
  args: {
    confirmLabel: "Сохранить план",
    cancelLabel: "Не добавлять",
  },
};