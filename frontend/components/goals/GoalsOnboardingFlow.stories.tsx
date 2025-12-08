import type { Meta, StoryObj } from "@storybook/react";
import GoalsOnboardingFlow from "./GoalsOnboardingFlow.client";

const meta: Meta<typeof GoalsOnboardingFlow> = {
  title: "Goals/GoalsOnboardingFlow",
  component: GoalsOnboardingFlow,
  args: {
    mode: "initial",
    onFinished: () => {
      // В сторибуке просто лог
      console.log("[Storybook] Goals onboarding finished");
    },
  },
};

export default meta;

type Story = StoryObj<typeof GoalsOnboardingFlow>;

export const Initial: Story = {
  name: "Онбординг (первый заход)",
};

export const AddMore: Story = {
  name: "Добавить ещё цели",
  args: {
    mode: "add-more",
  },
};