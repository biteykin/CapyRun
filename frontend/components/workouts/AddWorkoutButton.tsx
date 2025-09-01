"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddWorkoutButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button className="btn btn-primary" onClick={() => setOpen(v => !v)}>
        Добавить тренировку
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-white p-1 shadow"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--color-bg-fill-tertiary)]"
            onClick={() => { setOpen(false); router.push("/workouts/new"); }}
          >
            Вручную
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--color-bg-fill-tertiary)]"
            onClick={() => { setOpen(false); router.push("/home"); }}
          >
            Загрузить .fit
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--color-bg-fill-tertiary)]"
            onClick={() => { setOpen(false); alert("Импорт CSV — скоро"); }}
          >
            Импорт CSV (скоро)
          </button>
        </div>
      )}
    </div>
  );
}