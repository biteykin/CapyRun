"use client";

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

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

type ChatMessageVM = {
  id: string;
  role: "user" | "coach" | "system";
  body: string;
  created_at: string;
  author_id?: string;
  meta?: any;
};

// --- Helpers ---
function makeNonce() {
  // достаточно для дедупа в UI
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function msgKey(m: Partial<RawMessage> & { meta?: any }) {
  // 1) иначе по client_nonce (важно для optimistic и temp-coach)
  const cn = m?.meta?.client_nonce;
  if (typeof cn === "string" && cn.length) {
    const t = (m as any)?.type ?? "unknown";
    return `cn:${cn}:t:${t}`;
  }
  // 2) стабильный ключ по id
  if (m?.id) return `id:${m.id}`;
  // 3) fallback
  return `fb:${m.type}:${m.created_at}:${(m.body ?? "").slice(0, 24)}`;
}

function mergeDedup(prev: RawMessage[], incoming: RawMessage[]) {
  // merge так, чтобы:
  // - server message заменял optimistic по client_nonce
  // - temp сообщения не исчезали при refetch, пока не приехал серверный аналог

  const map = new Map<string, RawMessage>();
  // 1) кладём prev
  for (const m of prev) map.set(msgKey(m), m);
  // 2) кладём incoming (перезаписывает prev, если тот же key)
  for (const m of incoming) map.set(msgKey(m), m);
  // 3) если пришло серверное сообщение с id, но у нас был optimistic по client_nonce,
  //    то оставим серверное, а optimistic не дублируем.
  // (это уже достигается одинаковым key cn:..., потому что мы прокидываем client_nonce в meta)
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

  // Инициализация сообщений (history)
  const [messages, setMessages] = React.useState<RawMessage[]>(() => {
    const msgArr: RawMessage[] = (initialMessages ?? []).map((m: any) => ({
      id: m.id,
      thread_id: m.thread_id,
      author_id: m.author_id,
      type: m.type,
      body: m.body,
      meta: m.meta,
      created_at: m.created_at,
    }));
    return msgArr;
  });

  const [text, setText] = React.useState("");
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

  // 2) Realtime subscription to new messages, no duplicates by key
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

  const displayMessages = useMemo(() => {
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

  const hiddenAutoCount = useMemo(() => {
    const auto = messages.filter((m) => m.meta?.kind === "workout_first_message").length;
    return Math.max(0, auto - AUTO_LIMIT);
  }, [messages]);

  // markRead isn't strictly needed anymore for read-on-open, but we keep for manual "mark read" button
  const markRead = React.useCallback(async () => {
    const { error } = await supabase.rpc("coach_mark_thread_read", { p_thread_id: threadId });
    if (error) {
      // best-effort: read receipt не должен ломать отправку/UX
      console.warn("[coach] mark read failed", error);
    }
  }, [threadId]);

  // Загрузка истории — пример реализации для дальнейшей интеграции при необходимости
  // async function loadHistory() {
  //   try {
  //     const res = await fetch(`/api/coach/history?threadId=${threadId}`, { method: "GET" });
  //     if (!res.ok) return;
  //     const data = await res.json();
  //     const serverMsgs: RawMessage[] = (data.messages ?? []) as RawMessage[];
  //     setMessages((prev) => mergeDedup(prev, serverMsgs));
  //   } catch {}
  // }

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSending(true);

    const client_nonce = makeNonce();
    const nowIso = new Date().toISOString();

    // optimistic user message (ONE)
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
        // важно: Supabase auth живёт в cookie, на некоторых сетапах без include куки не улетают
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

      const userMsg = data.userMessage as RawMessage;
      const coachMsg = data.coachMessage as RawMessage | undefined;

      // Если бэк прислал dbg — покажем в консоль (помогает понять, почему "заглушка")
      if (data?.dbg) {
        console.warn("[coach] /api/coach/send dbg", data.dbg);
      }

      // ВАЖНО:
      // 1) гарантируем, что у server userMessage в meta сохранён client_nonce (у вас он вставляется в route.ts)
      // 2) если по какой-то причине meta пустая — подставим nonce, чтобы заменить optimistic
      const patchedUser = {
        ...userMsg,
        meta: { ...(userMsg.meta ?? {}), client_nonce },
      } as RawMessage;

      let newMsgs: RawMessage[] = [patchedUser];
      if (coachMsg) {
        // coachMessage тоже пометим client_nonce, чтобы temp-coach не исчезал при refetch/мердже
        const patchedCoach = {
          ...coachMsg,
          meta: { ...(coachMsg.meta ?? {}), client_nonce },
        } as RawMessage;
        newMsgs.push(patchedCoach);
      }

      setMessages((prev) => mergeDedup(prev, newMsgs));

      // we are in the chat, so we consider it read
      // best-effort: read receipt не должен ломать чат
      try {
        await markRead();
      } catch (e) {
        console.warn("[coach] markRead threw", e);
      }
      // optional: мягкий refetch истории, если нужно
      // await loadHistory();
    } catch (e) {
      // если упали после вставки userMsg на сервере — мы уже показываем optimistic.
      // НЕ показываем модалку, которая провоцирует повторную отправку и дубли.
      console.error("coach_send_failed", e);
      // можно показать тихий toast, если у вас есть
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
    <Card className="flex h-full min-h-0 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="text-xs text-muted-foreground">Общий чат с тренером</div>

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
            <div key={msgKey(m)} className={cn("flex", getRole(m) === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
                  getRole(m) === "user"
                    ? "bg-[color:var(--btn-primary-main,#E58B21)] text-[color:var(--btn-primary-text,#0E0E0E)]"
                    : "bg-muted text-foreground"
                )}
              >
                {getRole(m) === "coach" && (
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Задай вопрос тренеру или опиши, как прошла тренировка… (Enter — отправить, Shift+Enter — новая строка)"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={isSending} onClick={() => setText("")}>
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