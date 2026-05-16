//frontend/components/coach/CoachTypingIndicator.tsx

import * as React from "react";
import { cn } from "@/lib/utils";
import CoachMessageBubble from "./CoachMessageBubble";

export function CoachTypingIndicator(props: {
  className?: string;
  label?: string;
}) {
  const { className, label = "Тренер печатает…" } = props;

  const body = (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="sr-only">{label}</span>

        <span className="coach-typing-dot coach-typing-dot--1 h-2 w-2 rounded-full bg-muted-foreground/75" />
        <span className="coach-typing-dot coach-typing-dot--2 h-2 w-2 rounded-full bg-muted-foreground/75" />
        <span className="coach-typing-dot coach-typing-dot--3 h-2 w-2 rounded-full bg-muted-foreground/75" />
      </div>

      {label ? (
        <div className="text-[9px] text-muted-foreground opacity-80">{label}</div>
      ) : null}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes coach-typing-dot {
          0% {
            transform: translateY(0px);
            opacity: 0.45;
          }
          25% {
            transform: translateY(-2px);
            opacity: 0.65;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
          75% {
            transform: translateY(-2px);
            opacity: 0.65;
          }
          100% {
            transform: translateY(0px);
            opacity: 0.45;
          }
        }

        .coach-typing-dot {
          animation-name: coach-typing-dot;
          animation-duration: 1.25s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          will-change: transform, opacity;
        }

        .coach-typing-dot--1 {
          animation-delay: 0s;
        }

        .coach-typing-dot--2 {
          animation-delay: 0.18s;
        }

        .coach-typing-dot--3 {
          animation-delay: 0.36s;
        }
      `}</style>

      <CoachMessageBubble
        role="coach"
        body={body}
        className={cn("min-w-[96px]", className)}
      />
    </>
  );
}

export default CoachTypingIndicator;