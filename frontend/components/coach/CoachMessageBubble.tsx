"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type CoachMessageBubbleRole = "user" | "coach" | "system";

export function formatCoachMessageTime(iso: string, hydrated = true) {
  if (!hydrated) return "—:—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—:—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function CoachMessageBubble(props: {
  role: CoachMessageBubbleRole;
  body: React.ReactNode;
  createdAt?: string | null;
  hydrated?: boolean;
  label?: string | null;
  className?: string;
  bubbleClassName?: string;
}) {
  const {
    role,
    body,
    createdAt,
    hydrated = true,
    label,
    className,
    bubbleClassName,
  } = props;

  const isUser = role === "user";
  const isCoach = role === "coach";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-[color:var(--btn-primary-main,#E58B21)] text-[color:var(--btn-primary-text,#0E0E0E)]"
            : "bg-muted text-foreground",
          bubbleClassName
        )}
      >
        {isCoach && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label ?? "Тренер"}
          </div>
        )}

        <div>{body}</div>

        {createdAt ? (
          <div className="mt-1 text-[9px] text-muted-foreground opacity-80">
            {formatCoachMessageTime(createdAt, hydrated)}
          </div>
        ) : null}
      </div>
    </div>
  );
}