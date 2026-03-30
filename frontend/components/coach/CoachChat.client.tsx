// frontend/components/coach/CoachChat.client.tsx

"use client";

import * as React from "react";
import { useLayoutEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import CoachMessageBubble from "./CoachMessageBubble";
import CoachTypingIndicator from "./CoachTypingIndicator";

// --- Types ---
type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

function makeNonce() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function msgKey(m: Partial<RawMessage> & { meta?: any }) {
  const clientNonce = m?.meta?.client_nonce;
  if (typeof clientNonce === "string" && clientNonce.length) {
    const t = (m as any)?.type ?? "unknown";
    return `cn:${clientNonce}:t:${t}`;
  }
  if (m?.id) return `id:${m.id}`;
  return `fb:${m.type}:${m.created_at}:${(m.body ?? "").slice(0, 24)}`;
}

function mergeDedup(prev: RawMessage[], incoming: RawMessage[]) {
  const map = new Map<string, RawMessage>();

  for (const m of prev) map.set(msgKey(m), m);
  for (const m of incoming) map.set(msgKey(m), m);

  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return ta - tb;
  });

  return arr;
}

export default function CoachChat(props: {
  threadId: string;
  initialMessages: any[];
  currentUserId: string;
  initialUnreadCount?: number;
}) {
  const { threadId, initialMessages, currentUserId } = props;

  const [messages, setMessages] = React.useState<RawMessage[]>(() => {
    return (initialMessages ?? []).map((m: any) => ({
      id: m.id,
      thread_id: m.thread_id,
      author_id: m.author_id,
      type: m.type,
      body: m.body,
      meta: m.meta,
      created_at: m.created_at,
    }));
  });

  const [text, setText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [showAllAuto, setShowAllAuto] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

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
          setMessages((prev) => mergeDedup(prev, [m]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending]);

  const formatTime = React.useCallback(
    (iso: string) => {
      if (!hydrated) return "—:—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—:—";
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [hydrated]
  );

  const AUTO_LIMIT = 10;

  const displayMessages = useMemo(() => {
    const auto = messages.filter((m) => m.meta?.kind === "workout_first_message");
    if (showAllAuto) return messages;
    if (auto.length <= AUTO_LIMIT) return messages;

    const autoIdsToKeep = new Set(auto.slice(-AUTO_LIMIT).map((m) => m.id));
    return messages.filter(
      (m) => m.meta?.kind !== "workout_first_message" || autoIdsToKeep.has(m.id)
    );
  }, [messages, showAllAuto]);

  const hiddenAutoCount = useMemo(() => {
    const auto = messages.filter((m) => m.meta?.kind === "workout_first_message").length;
    return Math.max(0, auto - AUTO_LIMIT);
  }, [messages]);

  const markRead = React.useCallback(async () => {
    const { error } = await supabase.rpc("coach_mark_thread_read", {
      p_thread_id: threadId,
    });
    if (error) {
      console.warn("[coach] mark read failed", error);
    }
  }, [threadId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSending(true);

    const client_nonce = makeNonce();
    const nowIso = new Date().toISOString();

    const optimisticUser: RawMessage = {
      id: `temp-user-${client_nonce}`,
      thread_id: threadId,
      author_id: currentUserId,
      type: "user",
      body: trimmed,
      meta: { client_nonce, temp: true },
      created_at: nowIso,
    };

    setMessages((prev) => mergeDedup(prev, [optimisticUser]));
    setText("");

    try {
      const res = await fetch("/api/coach/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, text: trimmed, client_nonce }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        threadId: string;
        userMessage: RawMessage;
        coachMessage?: RawMessage;
        dbg?: any;
      };

      if (data?.dbg) {
        console.warn("[coach] /api/coach/send dbg", data.dbg);
      }

      const patchedUser = {
        ...data.userMessage,
        meta: { ...(data.userMessage.meta ?? {}), client_nonce },
      } as RawMessage;

      setMessages((prev) => mergeDedup(prev, [patchedUser]));

      try {
        await markRead();
      } catch (e) {
        console.warn("[coach] markRead threw", e);
      }
    } catch (e) {
      console.error("coach_send_failed", e);
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

  function getRole(m: RawMessage): "user" | "coach" | "system" {
    if (m.type === "coach") return "coach";
    if (m.type === "system") return "system";
    return "user";
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="text-xs text-muted-foreground">Общий чат с тренером</div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/10">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-3 space-y-3"
          >
            {hiddenAutoCount > 0 && !showAllAuto && (
              <div className="flex items-center justify-center">
                <Button variant="secondary" size="sm" onClick={() => setShowAllAuto(true)}>
                  Показать ещё авто-отчёты ({hiddenAutoCount})
                </Button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Пока сообщений нет. Напиши тренеру, расскажи о своих целях и последней
                тренировке — он ответит и предложит, с чего начать.
              </div>
            )}

            {displayMessages.map((m) => (
              <CoachMessageBubble
                key={msgKey(m)}
                role={getRole(m)}
                body={m.body}
                createdAt={m.created_at}
                hydrated={hydrated}
              />
            ))}

            <div className="h-12" />
          </div>

          {isSending ? (
            <div className="pointer-events-none absolute bottom-2 left-0 right-0 px-3">
              <CoachTypingIndicator />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t pt-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
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
              onClick={() => setText("")}
            >
              Очистить
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isSending || !text.trim()}
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