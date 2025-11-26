// components/ui/skeleton.stories.tsx
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<
  typeof Skeleton & {
    width?: number;
    height?: number;
    animated?: boolean;
    radius?: "none" | "sm" | "md" | "lg" | "xl" | "full";
  }
>;

function radiusClass(r: NonNullable<Story["args"]>["radius"]) {
  switch (r) {
    case "none": return "rounded-none";
    case "sm":   return "rounded-sm";
    case "md":   return "rounded-md";
    case "lg":   return "rounded-lg";
    case "xl":   return "rounded-xl";
    case "full": return "rounded-full";
    default:     return "rounded-md";
  }
}

/** Один базовый прямоугольник (настраиваемый через Controls) */
export const Playground: Story = {
  args: { width: 160, height: 24, animated: true, radius: "md" },
  render: (args) => (
    <Skeleton
      style={{ width: args.width, height: args.height }}
      className={`${radiusClass(args.radius)} ${args.animated ? "animate-pulse" : "animate-none"}`}
      aria-label="Skeleton example"
    />
  ),
};

/** Набор типовых вариантов — строка текста, аватар, бейдж, карточка */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {/* Текстовая строка */}
      <div className="space-y-2 min-w-[220px]">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Аватар + 2 строки */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Бейдж */}
      <div className="space-y-2 min-w-[160px]">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Карточка */}
      <div className="w-[280px] rounded-lg border p-4">
        <Skeleton className="mb-3 h-36 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
    </div>
  ),
};

/** Список / таблица-заглушка */
export const ListPlaceholder: Story = {
  render: () => (
    <div className="w-full max-w-3xl overflow-hidden rounded-lg border">
      <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-xs font-medium">
        <div className="col-span-5">Название</div>
        <div className="col-span-2">Дата</div>
        <div className="col-span-2">Тип</div>
        <div className="col-span-3 text-right">Ккал</div>
      </div>
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 items-center px-4 py-3">
            <div className="col-span-5">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="col-span-3 flex justify-end">
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};