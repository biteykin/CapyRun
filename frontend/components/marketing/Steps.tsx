//frontend/components/marketing/Steps.tsx

export default function Steps() {
    const items = [
      {
        n: "01",
        title: "Добавьте тренировку",
        text: "Загрузите .fit-файл с часов или импортируйте пробежку из подключённого источника.",
      },
      {
        n: "02",
        title: "Получите разбор",
        text: "CapyRun покажет ключевые метрики и объяснит, что они значат для вашей формы.",
      },
      {
        n: "03",
        title: "Двигайтесь дальше",
        text: "AI-коуч подскажет, когда восстановиться, где добавить объём и когда делать качество.",
      },
    ];
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="h-display text-2xl md:text-4xl font-extrabold text-center">От пробежки к понятному решению</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.n} className="card p-6">
              <div className="h-display text-sm font-bold text-[var(--text-secondary)]">{it.n}</div>
              <div className="h-display mt-2 text-lg font-semibold">{it.title}</div>
              <p className="mt-1 text-[var(--text-secondary)]">{it.text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }  