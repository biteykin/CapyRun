import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import UnreadCountBadge from "@/components/ui/unread-count-badge";

const meta: Meta<typeof UnreadCountBadge> = {
  title: "UI/UnreadCountBadge",
  component: UnreadCountBadge,
  args: {
    count: 3,
  },
};

export default meta;

type Story = StoryObj<typeof UnreadCountBadge>;

export const Default: Story = {};

export const Examples: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <UnreadCountBadge count={1} />
      <UnreadCountBadge count={5} />
      <UnreadCountBadge count={12} />
      <UnreadCountBadge count={99} />
      <UnreadCountBadge count={120} />
      <UnreadCountBadge count={0} />
    </div>
  ),
};