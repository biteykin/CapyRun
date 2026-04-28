//frontend/components/coach/CoachChat.client.tsx

"use client";

import * as React from "react";
import { useLayoutEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CoachMessageBubble from "./CoachMessageBubble";
import CoachPlanActions from "./CoachPlanActions";

type RawMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: "user" | "coach" | "system" | "note";
  body: string;
  meta: any;
  created_at: string;
};

const MESSAGES_PAGE_SIZE = 30;

const QUICK_ACTIONS = [
  "Разбери последнюю тренировку",
  "Составь план на неделю",
  "Как улучшить результат?",
  "Что у меня по прогрессу?",
  "Когда лучше отдыхать?",
] as const;

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

const CoachChatInput = React.memo(function CoachChatInput(props: {
  isSending: boolean;
  onSend: (text: string, options?: { action?: string | null }) => Promise<void>;
}) {
  const { isSending, onSend } = props;
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const handleSend = React.useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText("");
    await onSend(trimmed);
  }, [isSending, onSend, text]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder='Напиши Капи… например: "разбери тренировку" или "составь план"'
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={isSending}
                className="border-0 bg-[rgb(45,118,1)] px-3 text-white shadow-[inset_0_-2px_0_rgb(29,71,0)] hover:bg-[rgb(78,142,39)] active:translate-y-px active:shadow-[inset_0_-1px_0_rgb(29,71,0)] [&_span]:font-black"
              >
                +
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {QUICK_ACTIONS.map((action) => (
                <DropdownMenuItem
                  key={action}
                  onClick={() => void onSend(action)}
                >
                  {action}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => void handleSend()}
          >
            {isSending ? "Отправляем…" : "Отправить тренеру"}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default function CoachChat(props: {
  threadId: string;
  initialMessages: any[];
  initialHasMoreMessages?: boolean;
  currentUserId: string;
  initialUnreadCount?: number;
}) {
  const { threadId, initialMessages, initialHasMoreMessages = false, currentUserId } = props;

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

  const [isSending, setIsSending] = React.useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = React.useState(false);
  const [hasMoreMessages, setHasMoreMessages] = React.useState(initialHasMoreMessages);
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

  const loadOlderMessages = React.useCallback(async () => {
    if (isLoadingOlder || !hasMoreMessages) return;

    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    const oldest = messages[0];
    if (!oldest?.created_at) return;

    try {
      setIsLoadingOlder(true);

      const { data, error } = await supabase
        .from("coach_messages")
        .select("id, thread_id, author_id, type, body, meta, created_at")
        .eq("thread_id", threadId)
        .lt("created_at", oldest.created_at)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE + 1);

      if (error) throw error;

      const rows = (data ?? []) as RawMessage[];
      const older = rows.slice(0, MESSAGES_PAGE_SIZE).reverse();

      setHasMoreMessages(rows.length > MESSAGES_PAGE_SIZE);
      setMessages((prev) => mergeDedup(prev, older));

      requestAnimationFrame(() => {
        const nextEl = scrollRef.current;
        if (!nextEl) return;
        const nextScrollHeight = nextEl.scrollHeight;
        nextEl.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      });
    } catch (e) {
      console.error("[coach] load older messages failed", e);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasMoreMessages, isLoadingOlder, messages, threadId]);

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

  const typingMessage = React.useMemo<RawMessage | null>(() => {
    if (!isSending) return null;
    return {
      id: "__typing__",
      thread_id: threadId,
      author_id: "coach",
      type: "coach",
      body: "__typing__",
      meta: { kind: "typing_indicator" },
      created_at: new Date().toISOString(),
    };
  }, [isSending, threadId]);

  const displayMessagesWithTyping = React.useMemo(() => {
    return typingMessage ? [...displayMessages, typingMessage] : displayMessages;
  }, [displayMessages, typingMessage]);

  const [pendingPlanActionMessageId, setPendingPlanActionMessageId] = React.useState<
    string | null
  >(null);
  const [resolvedPlanMessageIds, setResolvedPlanMessageIds] = React.useState<string[]>(
    []
  );

  const latestPlanActionMessageId = React.useMemo(() => {
    const actionable = [...messages]
      .reverse()
      .find(
        (m) =>
          m.type === "coach" &&
          Boolean(m.meta?.plan_confirmation) &&
          !resolvedPlanMessageIds.includes(m.id)
      );

    return actionable?.id ?? null;
  }, [messages, resolvedPlanMessageIds]);

  React.useEffect(() => {
    if (!pendingPlanActionMessageId) return;
    const hasResolutionMessage = messages.some(
      (m) =>
        m.type === "coach" &&
        (m.meta?.stage === "plan_saved" || m.meta?.stage === "plan_cancelled")
    );
    if (hasResolutionMessage) setPendingPlanActionMessageId(null);
  }, [messages, pendingPlanActionMessageId]);

  const markRead = React.useCallback(async () => {
    const { error } = await supabase.rpc("coach_mark_thread_read", {
      p_thread_id: threadId,
    });
    if (error) {
      console.warn("[coach] mark read failed", error);
    }
  }, [threadId]);

  const sendMessage = React.useCallback(
    async (messageText: string, options?: { action?: string | null }) => {
      const action = options?.action ?? null;
      const trimmed = messageText.trim();
      if (!trimmed) return;
      if (isSending) return;

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
      try {
        const res = await fetch("/api/coach/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, text: trimmed, client_nonce, action }),
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
    },
    [currentUserId, isSending, markRead, threadId]
  );

  function getRole(m: RawMessage): "user" | "coach" | "system" {
    if (m.type === "coach") return "coach";
    if (m.type === "system") return "system";
    return "user";
  }

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0 overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/10">
          <div ref={scrollRef} className="h-full overflow-y-auto p-3 space-y-3">
            {hasMoreMessages && (
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={isLoadingOlder}
                  onClick={loadOlderMessages}
                  className="min-w-[180px] rounded-full"
                >
                  {isLoadingOlder ? "Загружаем…" : "Загрузить предыдущие"}
                </Button>
              </div>
            )}

            {hiddenAutoCount > 0 && !showAllAuto && (
              <div className="flex items-center justify-center">
                <Button variant="secondary" size="sm" onClick={() => setShowAllAuto(true)}>
                  Показать ещё авто-отчёты ({hiddenAutoCount})
                </Button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Пока сообщений нет. Напиши Капи о своей цели, тренировке или плане — разберёмся вместе.
              </div>
            )}

            {displayMessagesWithTyping.map((m) => {
              const isTyping = m.meta?.kind === "typing_indicator";
              const isPlanActionableMessage =
                m.type === "coach" &&
                Boolean(m.meta?.plan_confirmation) &&
                m.id === latestPlanActionMessageId &&
                !isTyping &&
                !resolvedPlanMessageIds.includes(m.id);

              const isPlanActionLoading =
                pendingPlanActionMessageId != null && pendingPlanActionMessageId === m.id;

              return (
                <CoachMessageBubble
                  key={msgKey(m)}
                  role={getRole(m)}
                  createdAt={isTyping ? null : m.created_at}
                  hydrated={hydrated}
                  afterBody={
                    isPlanActionableMessage ? (
                      <CoachPlanActions
                        isLoading={isPlanActionLoading}
                        disabled={isSending}
                        confirmLabel="Добавить"
                        cancelLabel="Отменить"
                        onConfirm={() => {
                          setPendingPlanActionMessageId(m.id);
                          setResolvedPlanMessageIds((prev) => [
                            ...new Set([...prev, m.id]),
                          ]);
                          void sendMessage("ок", { action: "confirm_plan" });
                        }}
                        onCancel={() => {
                          setPendingPlanActionMessageId(m.id);
                          setResolvedPlanMessageIds((prev) => [
                            ...new Set([...prev, m.id]),
                          ]);
                          void sendMessage("отмена", { action: "cancel_plan" });
                        }}
                      />
                    ) : null
                  }
                  body={
                    isTyping ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/75 animate-bounce [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/75 animate-bounce [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/75 animate-bounce" />
                      </div>
                    ) : (
                      m.body
                    )
                  }
                />
              );
            })}

            <div className="h-2" />
          </div>
        </div>

        <CoachChatInput isSending={isSending} onSend={sendMessage} />
      </CardContent>
    </Card>
  );
}