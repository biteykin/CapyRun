"use client";

import AddWorkoutMenu from "./workouts/AddWorkoutMenu";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/home": "Главная",
  "/workouts": "Тренировки",
  "/goals": "Цели",
  "/plan": "План",
  "/coach": "Coach",
  "/nutrition": "Питание",
  "/profile": "Профиль",
  "/badges": "Бейджи",
  "/upload": "Загрузка .fit",
};

export function Topbar() {
  const pathname = usePathname();
  const base = "/" + (pathname?.split("/")[1] || "home");
  const title = TITLES[base] ?? "CapyRun";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--color-bg-surface-primary)]/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <h1 className="h-display text-base font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <AddWorkoutMenu />
        </div>
      </div>
    </header>
  );
}