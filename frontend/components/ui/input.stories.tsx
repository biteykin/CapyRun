import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  args: { placeholder: "Введите текст…" },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <Input size={ "sm" as any } placeholder="Small" />
      <Input size={ "md" as any } placeholder="Medium" />
      <Input size={ "lg" as any } placeholder="Large" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <Input placeholder="Default" />
      <Input aria-invalid placeholder="Invalid (aria-invalid)" />
      <Input disabled placeholder="Disabled" />
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          {/* любая ваша иконка */}
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M10 18a8 8 0 1 1 5.293-2.707l4.207 4.207-1.414 1.414-4.207-4.207A7.963 7.963 0 0 1 10 18Z" fill="currentColor"/></svg>
        </span>
        <Input placeholder="Поиск…" className="pl-9" />
      </div>
      <div className="relative">
        <Input placeholder="С иконкой справа" className="pr-9" />
        <span className="absolute inset-y-0 right-0 flex items-center pr-3">
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
        </span>
      </div>
    </div>
  ),
};

export const GhostInToolbar: Story = {
  render: () => (
    <div className="p-3 rounded-[var(--radius)] bg-[hsl(var(--muted))] max-w-md">
      <Input placeholder="Фильтр…" />
    </div>
  ),
};