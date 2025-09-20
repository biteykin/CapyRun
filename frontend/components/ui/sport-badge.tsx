// components/ui/sport-badge.tsx
"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { humanSport, sportColor } from "./sport-theme";

export function SportPill({
  sport,
  showLabel = true,
  className,
}: {
  sport?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  const color = sportColor(sport);
  const label = humanSport(sport);
  return (
    <Badge
      variant="secondary"
      className={`gap-2 px-2.5 py-1 rounded-xl ${className ?? ""}`}
      title={label}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {showLabel && <span className="font-medium">{label}</span>}
    </Badge>
  );
}

/** Круглый «икон-бейдж» без подписи — если захочется использовать где-то отдельно */
export function SportCircle({
  sport,
  size = 20,
  className,
}: {
  sport?: string | null;
  size?: number;
  className?: string;
}) {
  const color = sportColor(sport);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className ?? ""}`}
      style={{ width: size, height: size, background: color }}
      aria-label={humanSport(sport)}
    />
  );
}