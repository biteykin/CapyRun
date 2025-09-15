"use client";
import { TooltipProvider } from "@/components/ui/tooltip";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      {children}
    </TooltipProvider>
  );
}
