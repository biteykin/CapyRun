// components/coach/CoachTypingIndicator.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CoachTypingIndicator from "./CoachTypingIndicator";

const meta: Meta<typeof CoachTypingIndicator> = {
  title: "Coach/CoachTypingIndicator",
  component: CoachTypingIndicator,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof CoachTypingIndicator>;

export const Default: Story = {
  render: (args) => (
    <div className="max-w-3xl rounded-xl border bg-background p-4">
      <div className="rounded-md border bg-muted/10 p-3">
        <CoachTypingIndicator {...args} />
      </div>
    </div>
  ),
  args: {},
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="max-w-3xl rounded-xl border bg-background p-4">
      <div className="rounded-md border bg-muted/10 p-3">
        <CoachTypingIndicator {...args} />
      </div>
    </div>
  ),
  args: {
    label: "печатает ответ…",
  },
};

export const WithoutLabel: Story = {
  render: (args) => (
    <div className="max-w-3xl rounded-xl border bg-background p-4">
      <div className="rounded-md border bg-muted/10 p-3">
        <CoachTypingIndicator {...args} />
      </div>
    </div>
  ),
  args: {
    label: "",
  },
};