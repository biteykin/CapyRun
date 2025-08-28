import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20 text-center">
        <h2 className="h-display text-3xl md:text-5xl font-extrabold">Готов бежать быстрее?</h2>
        <p className="mt-3 text-[var(--text-secondary)]">Подключай Supabase-аккаунт и загружай свои .fit</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/login" className="btn btn-primary">Начать</Link>
          <Link href="/login" className="btn btn-ghost">У меня есть аккаунт</Link>
        </div>
      </div>
    </section>
  );
}
