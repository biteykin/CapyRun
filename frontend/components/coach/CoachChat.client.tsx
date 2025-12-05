// components/coach/CoachChat.client.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // если нет — замени на свой
import { Card, CardContent } from "@/components/ui/card";

type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

export type CoachChatProps = {
  threadId: string;
  initialMessages: RawMessage[];
  currentUserId: string;
};

type ChatMessageVM = {
  id: string;
  role: "user" | "coach" | "system";
  body: string;
  created_at: string;
};

export default function CoachChat({
  threadId,
  initialMessages,
  currentUserId,
}: CoachChatProps) {
  const [messages, setMessages] = React.useState<ChatMessageVM[]>(() =>
    (initialMessages ?? []).map((m) => ({
      id: m.id,
      role: m.type === "coach" ? "coach" :
            m.type === "system" ? "system" : "user",
      body: m.body,
      created_at: m.created_at,
    }))
  );

  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput("");

    // Оптимистично добавляем сообщение пользователя
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
        body: JSON.stringify({
          threadId, // можно null / string — на бэке мы это обрабатываем
          message: text, // 👈 важное изменение: поле message вместо text
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as {
        userMessage: RawMessage;
        coachMessage: RawMessage;
      };

      // Заменяем оптимистичное сообщение реальным и добавляем ответ тренера
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const userMsg: ChatMessageVM = {
          id: data.userMessage.id,
          role: "user",
          body: data.userMessage.body,
          created_at: data.userMessage.created_at,
        };
        const coachMsg: ChatMessageVM = {
          id: data.coachMessage.id,
          role: "coach",
          body: data.coachMessage.body,
          created_at: data.coachMessage.created_at,
        };
        return [...withoutTemp, userMsg, coachMsg];
      });
    } catch (e) {
      console.error("coach send error", e);
      // Возвращаем текст обратно в инпут
      setInput(text);
      // Убираем оптимистичное
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
    <Card className="flex h-[70vh] flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Лента сообщений */}
        <div className="flex-1 overflow-y-auto rounded-md border bg-muted/10 p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Пока сообщений нет. Напиши тренеру, расскажи о своих целях и последней тренировке — он ответит и предложит, с чего начать.
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-[color:var(--btn-primary-main,#E58B21)] text-[color:var(--btn-primary-text,#0E0E0E)]"
                    : "bg-muted text-foreground"
                )}
              >
                {m.role === "coach" && (
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Тренер
                  </div>
                )}
                {m.body}
                <div className="mt-1 text-[9px] text-muted-foreground opacity-80">
                  {new Date(m.created_at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Инпут */}
        <div className="mt-2 flex flex-col gap-2 border-t pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Задай вопрос тренеру или опиши, как прошла тренировка… (Enter — отправить, Shift+Enter — новая строка)"
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