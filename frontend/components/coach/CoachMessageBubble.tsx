"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

export type CoachMessageBubbleRole = "user" | "coach" | "system";

export function formatCoachMessageTime(iso: string, hydrated = true) {
  if (!hydrated) return "—:—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—:—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function MarkdownMessage(props: {
  content: string;
  role: CoachMessageBubbleRole;
}) {
  const { content, role } = props;
  const isUser = role === "user";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => (
          <p className="my-0 leading-relaxed [&:not(:last-child)]:mb-2">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => (
          <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote
            className={cn(
              "my-2 border-l-2 pl-3 italic",
              isUser ? "border-black/20 text-black/80" : "border-border text-muted-foreground"
            )}
          >
            {children}
          </blockquote>
        ),
        code: ({ inline, children }) =>
          inline ? (
            <code
              className={cn(
                "rounded px-1 py-0.5 font-mono text-[0.95em]",
                isUser
                  ? "bg-black/10 text-[color:var(--btn-primary-text,#0E0E0E)]"
                  : "bg-black/5 dark:bg-white/10"
              )}
            >
              {children}
            </code>
          ) : (
            <code className="font-mono text-[0.95em]">{children}</code>
          ),
        pre: ({ children }) => (
          <pre
            className={cn(
              "my-2 overflow-x-auto rounded-md px-3 py-2 text-[11px]",
              isUser
                ? "bg-black/10 text-[color:var(--btn-primary-text,#0E0E0E)]"
                : "bg-black/5 dark:bg-white/10"
            )}
          >
            {children}
          </pre>
        ),
        h1: ({ children }) => <h1 className="mb-2 text-sm font-semibold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 text-xs font-semibold">{children}</h3>,
        hr: () => <hr className="my-3 border-border/70" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "underline underline-offset-2",
              isUser ? "text-[color:var(--btn-primary-text,#0E0E0E)]" : "text-primary"
            )}
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
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

  const bodyNode =
    typeof body === "string" ? (
      <MarkdownMessage content={body} role={role} />
    ) : (
      body
    );

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
          "max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed break-words",
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

        <div className="min-w-0">
          {bodyNode}
        </div>

        {createdAt ? (
          <div className="mt-1 text-[9px] text-muted-foreground opacity-80">
            {formatCoachMessageTime(createdAt, hydrated)}
          </div>
        ) : null}
      </div>
    </div>
  );
}