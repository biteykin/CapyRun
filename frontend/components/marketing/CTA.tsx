//frontend/components/marketing/CTA.tsx

import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20 text-center">
        <h2 className="h-display text-3xl md:text-5xl font-extrabold">Пора тренироваться осознанно</h2>
        <p className="mt-3 text-[var(--text-secondary)]">Загрузите первую тренировку и получите понятный AI-разбор.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/login?mode=signup" className="btn btn-primary">Начать бесплатно</Link>
          <Link href="/login?mode=login" className="btn btn-ghost">У меня есть аккаунт</Link>
        </div>
      </div>
    </section>
  );
}
