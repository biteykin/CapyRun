import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "padded" },
  // чтобы у всех историй в Canvas был понятный фон/контраст
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Select>;

/** Удобный шаблон со стейтами (Select — контролируемый/неконтролируемый) */
function SelectDemo({
  items,
  placeholder = "Выберите…",
  defaultValue,
}: {
  items: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = React.useState<string | undefined>(defaultValue);
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="demo-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Опции</SelectLabel>
          {items.map((it) => (
            <SelectItem key={it.value} value={it.value} disabled={it.disabled}>
              {it.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export const Basic: Story = {
  render: () => (
    <SelectDemo
      items={[
        { value: "run", label: "Бег" },
        { value: "ride", label: "Вело" },
        { value: "swim", label: "Плавание" },
      ]}
      placeholder="Спорт"
    />
  ),
};

export const WithGroupsAndSeparator: Story = {
  render: () => (
    <Select>
      <SelectTrigger aria-label="select-grouped">
        <SelectValue placeholder="Категория" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Кардио</SelectLabel>
          <SelectItem value="run">Бег</SelectItem>
          <SelectItem value="ride">Вело</SelectItem>
          <SelectItem value="swim">Плавание</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Силовые</SelectLabel>
          <SelectItem value="strength">Силовая</SelectItem>
          <SelectItem value="crossfit">Кроссфит</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <SelectDemo
      items={[
        { value: "a", label: "Доступно" },
        { value: "b", label: "Тоже доступно" },
        { value: "c", label: "Временно недоступно", disabled: true },
      ]}
      placeholder="Состояния"
    />
  ),
};

export const LongScrollableList: Story = {
  render: () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      value: `v${i + 1}`,
      label: `Пункт ${i + 1}`,
    }));
    return <SelectDemo items={many} placeholder="Длинный список" />;
  },
};