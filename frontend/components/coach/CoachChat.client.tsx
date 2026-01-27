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
};

function toVM(m: any): ChatMessageVM {
  const role: ChatMessageVM["role"] =
    m.type === "coach" ? "coach" : m.type === "system" ? "system" : "user";
  return {
    id: m.id,
    role,
    body: m.body ?? "",
    created_at: m.created_at,
  };
}

function uniqByIdAsc(list: ChatMessageVM[]) {
  const map = new Map<string, ChatMessageVM>();
  for (const m of list) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return ta - tb;
  });
}

export default function CoachChat(props: {
  threadId: string;
  initialMessages: any[];
  currentUserId: string;
}) {
  const { threadId, initialMessages } = props;

  const [messages, setMessages] = React.useState<ChatMessageVM[]>(() =>
    uniqByIdAsc((initialMessages ?? []).map(toVM))
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

  // 1) Клиентский refetch последних сообщений (чтобы UI был актуален даже без full reload)
  const refetchLatest = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("coach_messages")
      .select("id, thread_id, author_id, type, body, meta, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("coach_messages refetch error", error);
      return;
    }
    setMessages(uniqByIdAsc((data ?? []).map(toVM)));
  }, [threadId]);

  // 2) Realtime: слушаем INSERT по coach_messages для этого thread
  React.useEffect(() => {
    // сразу подтянем актуальные (на случай, если SSR-страница уже устарела)
    void refetchLatest();

    const channel = supabase
      .channel(`coach_messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as RawMessage;
          setMessages((prev) => uniqByIdAsc([...prev, toVM(row)]));
        }
      )
      .subscribe((status) => {
        // optional debug
        // console.log("realtime status", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, refetchLatest]);

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
    setMessages((prev) => uniqByIdAsc([...prev, optimisticUser]));

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
        const userMsg: ChatMessageVM = toVM(data.userMessage);
        const coachMsg: ChatMessageVM = toVM(data.coachMessage);
        return uniqByIdAsc([...withoutTemp, userMsg, coachMsg]);
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
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Диалог: <span className="font-medium">{threadId.slice(0, 8)}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refetchLatest}>
            Обновить
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/10 p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Пока сообщений нет. Загрузи тренировку или напиши тренеру — он ответит.
            </div>
          )}

          {messages.map((m) => (
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

                <div className="mt-1 text-[9px] text-muted-foreground opacity-80">
                  {formatTime(m.created_at)}
                </div>
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
            placeholder="Задай вопрос тренеру… (Enter — отправить, Shift+Enter — новая строка)"
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