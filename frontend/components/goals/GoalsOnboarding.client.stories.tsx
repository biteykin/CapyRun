import type { Meta, StoryObj } from "@storybook/react";
import GoalsOnboarding from "./GoalsOnboarding.client";

const meta: Meta<typeof GoalsOnboarding> = {
  title: "Goals/GoalsOnboarding",
  component: GoalsOnboarding,
  parameters: {
    layout: "padded",
  },
};
export default meta;

type Story = StoryObj<typeof GoalsOnboarding>;

export const Default: Story = {
  args: {
    onCreated: () => {
      // В Storybook просто логируем, чтобы не пытаться реально рефрешить страницу
      console.log("Goals created (storybook)");
    },
  },
};