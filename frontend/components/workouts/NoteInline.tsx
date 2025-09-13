"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

type Props = {
  workoutId: string;
  initial?: string | null;
};

export default function NoteInline({ workoutId, initial }: Props) {
  const [text, setText] = useState(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(initial ?? "");

  useEffect(() => {
    if ((initial ?? "") !== lastSavedRef.current && status === "idle") {
      setText(initial ?? "");
      lastSavedRef.current = initial ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function saveNow(v: string) {
    if (v === lastSavedRef.current) return;
    setStatus("saving");
    setError(null);

    const { error } = await supabase
      .from("workouts")
      .update({ description: v }) // сохраняем в description
      .eq("id", workoutId)
      .select("id")
      .maybeSingle();

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    lastSavedRef.current = v;
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveNow(text), 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (timerRef.current) clearTimeout(timerRef.current);
      void saveNow(text);
    }
  }

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">Заметка</div>
        <div className="text-xs text-[var(--text-secondary)]">
          {status === "saving" && "Сохраняем…"}
          {status === "saved" && "Сохранено"}
          {status === "error" && <span className="text-red-600">Ошибка сохранения</span>}
        </div>

      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <textarea
        className="w-full min-h-28 resize-vertical rounded-xl border px-3 py-2 outline-none focus:ring"
        placeholder="Добавьте заметку к тренировке…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          void saveNow(text);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
        Автосохранение через 5 сек. ⌘↩︎ / Ctrl+↩︎ — сохранить сейчас
      </div>
    </section>
  );
}