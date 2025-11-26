import * as React from "react";
import * as RD from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;

export const DialogPortal = RD.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RD.Overlay>,
  React.ComponentPropsWithoutRef<typeof RD.Overlay>
>(({ className, ...props }, ref) => (
  <RD.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = RD.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RD.Content>,
  React.ComponentPropsWithoutRef<typeof RD.Content>
>(({ className, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <RD.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,90vw)] " +
          "rounded-[var(--radius-lg,var(--radius))] bg-background text-foreground shadow-strong border border-border " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring p-6",
        className
      )}
      {...props}
    />
  </DialogPortal>
));
DialogContent.displayName = RD.Content.displayName;

export const DialogTitle = RD.Title;
export const DialogDescription = RD.Description;
export const DialogClose = RD.Close;