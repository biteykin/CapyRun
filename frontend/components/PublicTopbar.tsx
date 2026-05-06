//frontend/components/PublicTopbar.tsx

"use client";

import Link from "next/link";

export default function PublicTopbar() {
  return (
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
      <Link href="/public" className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#0E0E0E] bg-[#FFD600] text-lg shadow-[3px_3px_0_#0E0E0E]"
        >
          🦫
        </span>
        <span>
          <span className="h-display block text-base font-black leading-none">CapyRun</span>
          <span className="hidden text-xs text-[#595958] sm:block">AI running coach</span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Светлая (ghost) как на лендинге */}
        <Link href="/login?mode=login" className="btn btn-ghost">
          Войти
        </Link>
        {/* Жёлтая primary как на лендинге */}
        <Link href="/login?mode=signup" className="btn btn-primary">
          Попробовать бесплатно
        </Link>
      </div>
    </div>
  );
}