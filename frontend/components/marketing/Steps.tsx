export default function Steps() {
    const items = [
      {
        n: "01",
        title: "Загрузи .fit",
        text: "Импортируй файл с часов — CapyRun распарсит метрики за секунды.",
      },
      {
        n: "02",
        title: "Смотри суть",
        text: "Темп, пульс, зоны. Без воды — только то, что влияет на прогресс.",
      },
      {
        n: "03",
        title: "Действуй",
        text: "Получай подсказки и планируй следующую неделю осознанно.",
      },
    ];
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="h-display text-2xl md:text-4xl font-extrabold text-center">Как это работает</h2>
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