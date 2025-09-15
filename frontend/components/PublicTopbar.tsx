"use client";

import Link from "next/link";

export default function PublicTopbar() {
  return (
    <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3">
      <Link href="/public" className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-6 w-6 rounded-md"
          style={{ background: "linear-gradient(135deg,#FFD699,#DF6133)" }}
        />
        <span className="h-display font-semibold">CapyRun</span>
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