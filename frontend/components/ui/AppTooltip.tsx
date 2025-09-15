"use client";
import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";


type AppTooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  disableOnTouch?: boolean;
  asChild?: boolean;
};
export function AppTooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  disableOnTouch = true,
  asChild = true,
}: AppTooltipProps) {
  const [enabled, setEnabled] = React.useState(true);
  React.useEffect(() => {
    if (!disableOnTouch || typeof window === "undefined") return;
    const canHover = window.matchMedia("(hover: hover)").matches;
    setEnabled(canHover);
  }, [disableOnTouch]);
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={8} className={`app-tooltip ${className ?? ""}`}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
