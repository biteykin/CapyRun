"use client";

import Link from "next/link";

export default function NavbarPublic() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md" style={{ background: "linear-gradient(135deg,#FFD699,#DF6133)" }} />
          <span className="h-display text-base font-semibold">CapyRun</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">Войти</Link>
          <Link href="/login" className="btn btn-primary">Попробовать бесплатно</Link>
        </nav>
      </div>
    </header>
  );
}
