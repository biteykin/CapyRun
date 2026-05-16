//frontend/components/coach/CoachChat.client.tsx
"use client";

import * as React from "react";
import { useLayoutEffect, useMemo } from "react";
import Image from "next/image";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Moon,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
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
import logo from "@/app/icon-512.png";

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

type QuickAction = { label: string; Icon: LucideIcon };

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Разбери последнюю тренировку", Icon: Activity },
  { label: "Составь план на неделю", Icon: CalendarDays },
  { label: "Как улучшить результат?", Icon: TrendingUp },
  { label: "Что у меня по прогрессу?", Icon: BarChart3 },
  { label: "Когда лучше отдыхать?", Icon: Moon },
];

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

function CoachAvatar() {
  return (
    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-background shadow-sm">
      <Image
        src={logo}
        alt="Капи"
        width={32}
        height={32}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function SendFailedRetry({
  onRetry,
  disabled,
}: {
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px]">
      <span className="font-semibold text-rose-700">Не доставлено</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="rounded-full border border-rose-300/60 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
      >
        Повторить
      </button>
    </div>
  );
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function messageDateKey(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function formatMessageDateSeparator(iso?: string | null) {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const today = startOfLocalDay(new Date());
  const messageDay = startOfLocalDay(d);
  const diffDays = Math.round(
    (today.getTime() - messageDay.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";

  return d
    .toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: today.getFullYear() === d.getFullYear() ? undefined : "numeric",
    })
    .replace(/\s?г\.?$/, "");
}

function FloatingMessageDateBadge({ label }: { label?: string | null }) {
  if (!label) return null;

  return (
    <div className="pointer-events-none sticky top-2 z-20 flex justify-center">
      <div className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
        {label}
      </div>
    </div>
  );
}

function MessageDateSeparator({ iso }: { iso?: string | null }) {
  const label = formatMessageDateSeparator(iso);
  if (!label) return null;

  return (
    <div className="flex justify-center py-1">
      <div className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
        {label}
      </div>
    </div>
  );
}

function UserAvatar({ src, initials }: { src?: string | null; initials: string }) {
  if (src) {
    return (
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-background shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Вы" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#f9bd2b] text-[10px] font-bold text-black shadow-sm">
      {initials}
    </div>
  );
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
        placeholder='Сообщение...'
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
            <DropdownMenuContent align="start" className="w-72">
              {QUICK_ACTIONS.map(({ label, Icon }) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => void onSend(label)}
                  className="gap-2"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{label}</span>
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
  userAvatarUrl?: string | null;
  userName?: string | null;
}) {
  const {
    threadId,
    initialMessages,
    initialHasMoreMessages = false,
    currentUserId,
    userAvatarUrl = null,
    userName = null,
  } = props;

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
  const [visibleDateLabel, setVisibleDateLabel] = React.useState<string | null>(null);

  const [failedNonces, setFailedNonces] = React.useState<Set<string>>(new Set());
  const [realtimeStatus, setRealtimeStatus] = React.useState<string>("CONNECTING");

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const messagesRef = React.useRef<RawMessage[]>(messages);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/coach/mark-read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });

      if (!res.ok) {
        console.warn("[coach] mark-read http error", res.status);
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
          // Echo собственного user-сообщения — пропускаем (уже добавили оптимистично)
          if (m.type === "user" && m.author_id === currentUserId) {
            const nonce = m.meta?.client_nonce;
            if (typeof nonce === "string") {
              setFailedNonces((prev) => {
                if (!prev.has(nonce)) return prev;
                const next = new Set(prev);
                next.delete(nonce);
                return next;
              });
            }
            return;
          }
          setMessages((prev) => mergeDedup(prev, [m]));
        }
      )
      .subscribe((status) => {
        console.log("[coach] realtime status", status);
        setRealtimeStatus(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, currentUserId]);

  const refetchSinceLatest = React.useCallback(async () => {
    const list = messagesRef.current;
    const latest = list[list.length - 1];
    if (!latest?.created_at) return;

    try {
      const params = new URLSearchParams({
        threadId,
        since: latest.created_at,
      });
      const res = await fetch(`/api/coach/messages?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        console.warn("[coach] refetchSinceLatest http", res.status);
        return;
      }
      const json = (await res.json()) as { messages?: RawMessage[] };
      const fresh = json.messages ?? [];
      if (fresh.length > 0) {
        setMessages((prev) => mergeDedup(prev, fresh));
      }
    } catch (e) {
      console.warn("[coach] refetchSinceLatest failed", e);
    }
  }, [threadId]);

  // Подтягиваем свежие сообщения при возвращении в таб/фокусе окна
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refetchSinceLatest();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refetchSinceLatest]);

  // Polling fallback: если realtime не SUBSCRIBED — дёргаем /messages?since= каждые 25 сек
  React.useEffect(() => {
    if (realtimeStatus === "SUBSCRIBED") return;
    const id = setInterval(() => {
      void refetchSinceLatest();
    }, 25_000);
    return () => clearInterval(id);
  }, [realtimeStatus, refetchSinceLatest]);

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

      const res = await fetch(`/api/coach/messages?threadId=${threadId}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        console.warn("[coach] messages http error", res.status);
        return;
      }

      const json = (await res.json()) as { messages?: RawMessage[] };
      const allRows = json.messages ?? [];
      const olderRows = allRows.filter(
        (m) => new Date(m.created_at).getTime() < new Date(oldest.created_at).getTime()
      );
      const older = olderRows.slice(-MESSAGES_PAGE_SIZE);

      setHasMoreMessages(olderRows.length > MESSAGES_PAGE_SIZE);
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

  const updateVisibleDateLabel = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const messageNodes = Array.from(
      el.querySelectorAll<HTMLElement>("[data-message-date-label]")
    );

    if (messageNodes.length === 0) {
      setVisibleDateLabel(null);
      return;
    }

    const viewportTop = el.getBoundingClientRect().top;
    const threshold = viewportTop + 56;

    let activeLabel = messageNodes[0].dataset.messageDateLabel ?? null;

    for (const node of messageNodes) {
      const top = node.getBoundingClientRect().top;
      if (top <= threshold) {
        activeLabel = node.dataset.messageDateLabel ?? activeLabel;
      } else {
        break;
      }
    }

    setVisibleDateLabel((prev) => (prev === activeLabel ? prev : activeLabel));
  }, []);

  React.useEffect(() => {
    updateVisibleDateLabel();
  }, [displayMessagesWithTyping, updateVisibleDateLabel]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateVisibleDateLabel, { passive: true });
    return () => {
      el.removeEventListener("scroll", updateVisibleDateLabel);
    };
  }, [updateVisibleDateLabel]);

  const [pendingPlanActionMessageId, setPendingPlanActionMessageId] =
    React.useState<string | null>(null);
  const [resolvedPlanMessageIds, setResolvedPlanMessageIds] = React.useState<string[]>([]);

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
    const res = await fetch("/api/coach/mark-read", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });

    if (!res.ok) {
      console.warn("[coach] mark-read http error", res.status);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      try {
        const res = await fetch("/api/coach/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, text: trimmed, client_nonce, action }),
          signal: controller.signal,
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

        // Мержим и user, и coach-ответ из тела ответа — на случай если realtime сейчас лежит
        const incoming: RawMessage[] = [patchedUser];
        if (data.coachMessage) incoming.push(data.coachMessage as RawMessage);
        setMessages((prev) => mergeDedup(prev, incoming));

        try {
          await markRead();
        } catch (e) {
          console.warn("[coach] markRead threw", e);
        }
      } catch (e) {
        console.error("coach_send_failed", e);
        setFailedNonces((prev) => {
          const next = new Set(prev);
          next.add(client_nonce);
          return next;
        });
      } finally {
        clearTimeout(timeoutId);
        setIsSending(false);
      }
    },
    [currentUserId, isSending, markRead, threadId]
  );

  const handleRetryFailed = React.useCallback(
    (failed: RawMessage) => {
      const nonce = failed.meta?.client_nonce as string | undefined;
      if (!nonce) return;

      // Убираем "висящее" temp-сообщение и снимаем failed-флаг
      setMessages((prev) => prev.filter((m) => m.id !== failed.id));
      setFailedNonces((prev) => {
        if (!prev.has(nonce)) return prev;
        const next = new Set(prev);
        next.delete(nonce);
        return next;
      });

      // Заново отправляем тот же текст — будет новый client_nonce
      void sendMessage(failed.body);
    },
    [sendMessage]
  );

  function getRole(m: RawMessage): "user" | "coach" | "system" {
    if (m.type === "coach") return "coach";
    if (m.type === "system") return "system";
    return "user";
  }

  // Аватары + инициалы
  const userInitials = useMemo(() => {
    if (!userName) return "Я";
    const parts = userName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase() || "Я";
  }, [userName]);

  const coachAvatarNode = useMemo(() => <CoachAvatar />, []);
  const userAvatarNode = useMemo(
    () => <UserAvatar src={userAvatarUrl} initials={userInitials} />,
    [userAvatarUrl, userInitials]
  );

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0 overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-1 pb-3 pt-1"
        >
            <FloatingMessageDateBadge label={visibleDateLabel} />

            <div className="space-y-3">
            {hasMoreMessages && (
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
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
              <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-background shadow-md">
                  <Image
                    src={logo}
                    alt="Капи"
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-lg font-bold">Привет! Я Капи</div>
                <div className="mt-1.5 max-w-md text-sm text-muted-foreground">
                  Твой AI-тренер. Расскажи о цели, тренировке или просто спроси совета —
                  разберёмся вместе.
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.slice(0, 4).map(({ label, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void sendMessage(label)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted hover:shadow-sm"
                    >
                      <Icon className="size-3.5 text-muted-foreground" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {displayMessagesWithTyping.map((m, i, arr) => {
              const next = arr[i + 1];
              const showAvatar =
                !next || next.author_id !== m.author_id || next.type !== m.type;
              const role = getRole(m);
              const isTyping = m.meta?.kind === "typing_indicator";
              const isPlanActionableMessage =
                m.type === "coach" &&
                Boolean(m.meta?.plan_confirmation) &&
                m.id === latestPlanActionMessageId &&
                !isTyping &&
                !resolvedPlanMessageIds.includes(m.id);

              const isPlanActionLoading =
                pendingPlanActionMessageId != null &&
                pendingPlanActionMessageId === m.id;

              const isFailedUserMessage =
                m.type === "user" &&
                typeof m.meta?.client_nonce === "string" &&
                failedNonces.has(m.meta.client_nonce);

              const avatar =
                role === "user"
                  ? userAvatarNode
                  : role === "coach"
                    ? coachAvatarNode
                    : null;

              return (
                <div
                  key={msgKey(m)}
                  data-message-date-key={messageDateKey(m.created_at)}
                  data-message-date-label={formatMessageDateSeparator(m.created_at)}
                >
                  {messageDateKey(m.created_at) !==
                  messageDateKey(arr[i - 1]?.created_at) ? (
                    <MessageDateSeparator iso={m.created_at} />
                  ) : null}

                  <CoachMessageBubble
                  role={role}
                  createdAt={isTyping ? null : m.created_at}
                  hydrated={hydrated}
                  showAvatar={showAvatar}
                  avatar={avatar}
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
                    ) : isFailedUserMessage ? (
                      <SendFailedRetry
                        onRetry={() => handleRetryFailed(m)}
                        disabled={isSending}
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
                </div>
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