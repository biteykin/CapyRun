//frontend/components/marketing/Features.tsx

const items = [
    { title: "📊 Разбор тренировки", text: "Понимайте, где была база, где интенсивность, а где лишняя нагрузка." },
    { title: "❤️ Пульс и зоны", text: "CapyRun помогает увидеть, насколько ровно вы бежали и как организм держал нагрузку." },
    { title: "🧠 AI-подсказки", text: "После тренировки получайте короткий вывод: что хорошо, что поправить, что делать дальше." },
    { title: "📅 План на неделю", text: "Собирайте тренировки в систему: лёгкие дни, качество, восстановление и прогресс." },
  ];
  
  export default function Features() {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((it) => (
            <div key={it.title} className="card p-5">
              <div className="h-display text-lg font-semibold">{it.title}</div>
              <p className="mt-2 text-[var(--text-secondary)]">{it.text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  