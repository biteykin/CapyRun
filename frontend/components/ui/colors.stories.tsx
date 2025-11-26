// components/ui/colors.stories.tsx
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { COLORS_NAMED, rgbString } from "./colors";

const meta: Meta = {
  title: "UI/Colors",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj;

function Swatch({ hex, label }: { hex: string; label?: string }) {
  const rgb = rgbString(hex);
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2 min-w-[320px]">
      <div
        className="h-8 w-8 rounded-md border"
        style={{ backgroundColor: hex }}
        aria-label={label ? `${label} ${hex}` : `color ${hex}`}
      />
      <div className="text-xs leading-tight">
        {label ? <div className="font-semibold">{label}</div> : null}
        <div className="font-medium">{hex}</div>
        <div className="text-muted-foreground">rgb({rgb})</div>
      </div>
    </div>
  );
}

export const Palette: Story = {
  render: () => (
    <div className="space-y-6">
      {Object.entries(COLORS_NAMED).map(([group, shades]) => (
        <section key={group} className="space-y-2">
          <h3 className="text-sm font-semibold">{group}</h3>
          <div className="flex flex-wrap gap-3">
            {shades.map(({ hex, name }, i) => (
              <Swatch key={hex + i} hex={hex} label={name} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

// +++ add below existing imports/Palette story +++

export const List: Story = {
  render: () => (
    <div className="space-y-6">
      {Object.entries(COLORS_NAMED).map(([group, shades]) => (
        <section key={group} className="space-y-2">
          <h3 className="text-sm font-semibold">{group}</h3>
          <ul className="divide-y rounded-md border">
            {shades.map(({ hex, name }, i) => (
              <li key={hex + i} className="flex items-center gap-3 p-2">
                <span
                  className="h-5 w-5 rounded border"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <span className="min-w-[180px] font-medium">{name}</span>
                <span className="tabular-nums">{hex}</span>
                <span className="ml-auto text-muted-foreground text-xs">
                  rgb({rgbString(hex)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ),
};