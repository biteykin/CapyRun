"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";

type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

type ChatMessageVM = {
  id: string;
  role: "user" | "coach" | "system";
  body: string;
  meta?: any;
  created_at: string;
};

export default function CoachChat(props: {
  threadId: string;
  initialMessages: RawMessage[];
  currentUserId: string;
}) {
  const { threadId, initialMessages } = props;

  const [messages, setMessages] = React.useState<ChatMessageVM[]>(() =>
    (initialMessages ?? []).map((m) => ({
      id: m.id,
      role: m.type === "coach" ? "coach" : m.type === "system" ? "system" : "user",
      body: m.body,
      meta: m.meta,
      created_at: m.created_at,
    }))
  );

  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatTime = React.useCallback(
    (iso: string) => {
      if (!hydrated) return "—:—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—:—";
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    },
    [hydrated]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    const optimisticUser: ChatMessageVM = {
      id: tempId,
      role: "user",
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await fetch("/api/coach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        userMessage: RawMessage;
        coachMessage: RawMessage;
      };

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [
          ...withoutTemp,
          {
            id: data.userMessage.id,
            role: "user",
            body: data.userMessage.body,
            created_at: data.userMessage.created_at,
          },
          {
            id: data.coachMessage.id,
            role: "coach",
            body: data.coachMessage.body,
            meta: data.coachMessage.meta,
            created_at: data.coachMessage.created_at,
          },
        ];
      });
    } catch (e) {
      console.error("coach send error", e);
      setInput(text);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert("Не удалось отправить сообщение тренеру. Попробуй ещё раз.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/10 p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Пока сообщений нет. Напиши тренеру — он ответит и подскажет, как двигаться дальше.
            </div>
          )}

          {messages.map((m) => {
            const isWorkoutFirst =
              m.role === "coach" && m.meta?.kind === "workout_first_message";

            return (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                    m.role === "user"
                      ? "bg-[color:var(--btn-primary-main,#E58B21)] text-[color:var(--btn-primary-text,#0E0E0E)]"
                      : "bg-muted text-foreground"
                  )}
                >
                  {isWorkoutFirst && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      Комментарий по новой тренировке
                    </div>
                  )}

                  {m.role === "coach" && !isWorkoutFirst && (
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Тренер
                    </div>
                  )}

                  {m.body}

                  <div className="mt-1 text-[9px] text-muted-foreground opacity-80">
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Задай вопрос тренеру или опиши, как прошла тренировка…"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSending}
              onClick={() => setInput("")}
            >
              Очистить
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isSending || !input.trim()}
              onClick={handleSend}
            >
              {isSending ? "Отправляем…" : "Отправить тренеру"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}