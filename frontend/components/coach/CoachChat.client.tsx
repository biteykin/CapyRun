"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

type ChatMessageVM = {
  id: string;
  role: "user" | "coach" | "system";
  body: string;
  created_at: string;
  author_id?: string;
  meta?: any;
};

export default function CoachChat(props: {
  threadId: string;
  initialMessages: any[];
  currentUserId: string;
  initialUnreadCount?: number;
}) {
  const { threadId, initialMessages, currentUserId, initialUnreadCount = 0 } = props;

  const [messages, setMessages] = React.useState<ChatMessageVM[]>(() =>
    (initialMessages ?? []).map((m: any) => ({
      id: m.id,
      role: m.type === "coach" ? "coach" : m.type === "system" ? "system" : "user",
      body: m.body,
      created_at: m.created_at,
      author_id: m.author_id,
      meta: m.meta,
    }))
  );

  const [unreadCount, setUnreadCount] = React.useState<number>(Number(initialUnreadCount) || 0);

  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  // 1) Mark thread as read on first chat open
  React.useEffect(() => {
    (async () => {
      const { error } = await supabase.rpc("coach_mark_thread_read", {
        p_thread_id: threadId,
      });
      if (error) {
        console.warn("[coach] mark read failed", error);
      }
    })();
  }, [threadId]);

  // 2) Realtime subscription to new messages, no duplicates by id
  React.useEffect(() => {
    const channel = supabase
      .channel(`coach-thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const m = payload.new as RawMessage;

          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                role: m.type === "coach" ? "coach" : m.type === "system" ? "system" : "user",
                body: m.body,
                created_at: m.created_at,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

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

  // --- UI: не спамим чат сотней одинаковых авто-сообщений ---
  const AUTO_LIMIT = 10;
  const [showAllAuto, setShowAllAuto] = React.useState(false);

  const displayMessages = React.useMemo(() => {
    const auto = messages.filter((m) => m.meta?.kind === "workout_first_message");
    if (showAllAuto) return messages;
    if (auto.length <= AUTO_LIMIT) return messages;

    // скрываем старые авто-сообщения, оставляем только последние AUTO_LIMIT
    const autoIdsToKeep = new Set(
      auto
        .slice(-AUTO_LIMIT)
        .map((m) => m.id)
    );
    return messages.filter((m) => m.meta?.kind !== "workout_first_message" || autoIdsToKeep.has(m.id));
  }, [messages, showAllAuto]);

  const hiddenAutoCount = React.useMemo(() => {
    const auto = messages.filter((m) => m.meta?.kind === "workout_first_message").length;
    return Math.max(0, auto - AUTO_LIMIT);
  }, [messages]);

  // markRead isn't strictly needed anymore for read-on-open, but we keep for manual "mark read" button
  const markRead = React.useCallback(async () => {
    const { error } = await supabase.rpc("coach_mark_thread_read", { p_thread_id: threadId });
    if (!error) setUnreadCount(0);
  }, [threadId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput("");

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticUser: ChatMessageVM = {
      id: tempId,
      role: "user",
      body: text,
      created_at: new Date().toISOString(),
      author_id: currentUserId,
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

        // avoid duplicate user/coach messages if realtime already received.
        const hasUser = withoutTemp.some((m) => m.id === data.userMessage.id);
        const hasCoach = withoutTemp.some((m) => m.id === data.coachMessage.id);

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
        return [
          ...withoutTemp,
          ...(hasUser ? [] : [userMsg]),
          ...(hasCoach ? [] : [coachMsg]),
        ];
      });

      // we are in the chat, so we consider it read
      await markRead();
    } catch (e) {
      console.error("coach send error", e);
      setInput(text);
      setMessages((prev) => prev.filter((m) => !m.id?.startsWith?.("temp-")));
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
        {/* мини-хедер чата с бейджем */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Общий чат с тренером</div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markRead}
              title="Новые сообщения"
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold leading-none text-white transition hover:opacity-90"
              style={{ backgroundColor: "#E15425" }}
            >
              {unreadCount}
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/10 p-3 space-y-3">
          {hiddenAutoCount > 0 && !showAllAuto && (
            <div className="flex items-center justify-center">
              <Button variant="secondary" size="sm" onClick={() => setShowAllAuto(true)}>
                Показать ещё авто-отчёты ({hiddenAutoCount})
              </Button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Пока сообщений нет. Напиши тренеру, расскажи о своих целях и последней тренировке — он ответит и предложит,
              с чего начать.
            </div>
          )}

          {displayMessages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
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

                <div className="mt-1 text-[9px] text-muted-foreground opacity-80">{formatTime(m.created_at)}</div>
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Задай вопрос тренеру или опиши, как прошла тренировка… (Enter — отправить, Shift+Enter — новая строка)"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={isSending} onClick={() => setInput("")}>
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