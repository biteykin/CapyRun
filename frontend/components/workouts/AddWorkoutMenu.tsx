"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AddWorkoutMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Закрытие по клику вне/ESC
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Триггер — «как у PostHog»: меньше скругление, жёлтый фон и нижняя тень */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold leading-none
                   rounded-md border border-black/10 bg-[#f9bd2b] text-black
                   shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]
                   hover:brightness-95 active:translate-y-px active:shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)]
                   focus:outline-none focus:ring-2 focus:ring-black/10"
      >
        <span className="hidden sm:inline">Добавить тренировку</span>
        <span className="sm:hidden">Добавить тренировку</span>
        <svg className="-mr-1 h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.25 7.5l4.75 5 4.75-5H5.25z" />
        </svg>
      </button>

      {/* Выпадающее меню в стиле PostHog */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--border)] bg-white p-1
                     shadow-[0_8px_24px_rgba(0,0,0,.08)]"
        >
          <button
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--color-bg-fill-tertiary)]"
            onClick={() => { setOpen(false); router.push("/home"); }}  // здесь аплоад .fit
          >
            Загрузить файл
            <div className="text-xs text-[var(--text-secondary)]">Импорт .fit и других форматов</div>
          </button>

          <button
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--color-bg-fill-tertiary)]"
            onClick={() => { setOpen(false); router.push("/workouts/new"); }}
          >
            Добавить вручную
            <div className="text-xs text-[var(--text-secondary)]">Дата, тип, дистанция, время…</div>
          </button>
        </div>
      )}
    </div>
  );
}
