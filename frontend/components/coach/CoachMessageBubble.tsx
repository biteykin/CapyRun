//frontend/components/coach/CoachMessageBubble.tsx

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
        code: (props: any) => {
          const { inline, children } = props as { inline?: boolean; children?: React.ReactNode };
          return inline ? (
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
          );
        },
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

function CoachMessageBubble(props: {
  role: CoachMessageBubbleRole;
  body: React.ReactNode;
  createdAt?: string | null;
  hydrated?: boolean;
  label?: string | null;
  className?: string;
  bubbleClassName?: string;
  afterBody?: React.ReactNode;
}) {
  const {
    role,
    body,
    createdAt,
    hydrated = true,
    label,
    className,
    bubbleClassName,
    afterBody,
  } = props;

  const isUser = role === "user";
  const isCoach = role === "coach";
  const isSystem = role === "system";

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
          "max-w-[78%] rounded-[var(--radius)] px-3.5 py-2.5 text-xs leading-relaxed break-words",
          "border border-black/10 transition-transform",
          isUser
            ? [
                "bg-[#f9bd2b] text-black",
                "shadow-[inset_0_-2px_0_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.08)]",
              ]
            : isSystem
              ? [
                  "bg-muted text-muted-foreground",
                  "shadow-[inset_0_-2px_0_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
                ]
              : [
                  "bg-white text-black dark:bg-[hsl(var(--btn-light-bg))] dark:text-[hsl(var(--btn-light-text))]",
                  "shadow-[inset_0_-2px_0_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]",
                ],
          bubbleClassName
        )}
      >
        {isCoach && (
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            {label ?? "Тренер"}
          </div>
        )}

        <div className="min-w-0">
          {bodyNode}
        </div>

        {afterBody ? <div>{afterBody}</div> : null}

        {createdAt ? (
          <div
            className={cn(
              "mt-1 text-[9px] opacity-70",
              isUser ? "text-black/70" : "text-muted-foreground"
            )}
          >
            {formatCoachMessageTime(createdAt, hydrated)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default React.memo(CoachMessageBubble, (prev, next) => {
  return (
    prev.role === next.role &&
    prev.body === next.body &&
    prev.createdAt === next.createdAt &&
    prev.hydrated === next.hydrated &&
    prev.label === next.label &&
    prev.className === next.className &&
    prev.bubbleClassName === next.bubbleClassName &&
    prev.afterBody === next.afterBody
  );
});