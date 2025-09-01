"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

const TOP: Item[] = [
  { href: "/home",      label: "Главная" },
  { href: "/workouts",  label: "Мои тренировки" },
  { href: "/goals",     label: "Цели" },
  { href: "/plan",      label: "План" },
  { href: "/coach",     label: "Coach" },
  // { href: "/nutrition", label: "Дневник питания" }, // скрыто на первый релиз
  // { href: "/badges",    label: "Бейджи и рекорды" }, // скрыто на первый релиз
];

const BOTTOM: Item[] = [
  { href: "/profile",   label: "Профиль" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-full flex-col">
      {/* Логотип (кликабелен → /home) */}
      <div className="px-3 py-4 border-b border-[var(--border)]">
        <Link href="/home" className="flex items-center gap-2">
          <span
            className="h-6 w-6 rounded-md"
            style={{ background: "linear-gradient(135deg,#FFD699,#DF6133)" }}
          />
          <span className="h-display font-semibold">CapyRun</span>
        </Link>
      </div>

      {/* Навигация */}
      <nav className="p-2">
        {TOP.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "block rounded-xl px-3 py-2 transition",
              isActive(it.href)
                ? "bg-[var(--color-bg-fill-tertiary)] font-semibold"
                : "hover:bg-[var(--color-bg-fill-tertiary)]"
            ].join(" ")}
          >
            {it.label}
          </Link>
        ))}
      </nav>

      {/* Низ сайдбара — прижат к низу */}
      <div className="mt-auto p-2 border-t border-[var(--border)]">
        {BOTTOM.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "block rounded-xl px-3 py-2 transition",
              isActive(it.href)
                ? "bg-[var(--color-bg-fill-tertiary)] font-semibold"
                : "hover:bg-[var(--color-bg-fill-tertiary)]"
            ].join(" ")}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
