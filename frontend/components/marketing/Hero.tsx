import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden border-b border-[var(--border)]"
      style={{ background: "linear-gradient(180deg,#FFF6DE 0%, #FFFFFF 60%)" }} /* creamsicle → white */
    >
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="max-w-3xl">
          <h1 className="h-display text-4xl md:text-6xl font-extrabold leading-[1.05]">
            CapyRun — аналитика бега без лишнего шума
          </h1>
          <p className="mt-4 text-lg md:text-xl text-[var(--text-secondary)]">
            Импортируй <code>.fit</code>, смотри понятные графики темпа и пульса, получай умные подсказки — и становись быстрее.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/login" className="btn btn-primary">Попробовать бесплатно</Link>
            <Link href="/login" className="btn btn-ghost">Войти</Link>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Без карты. Авторизация — Supabase.</p>
        </div>
      </div>
    </section>
  );
}
