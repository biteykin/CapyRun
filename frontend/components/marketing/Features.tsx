const items = [
    { title: "📈 Графики без воды", text: "Темп, пульс, зоны — видно, где «жёг», а где строил базу." },
    { title: "❤️ Авто-зоны ЧСС", text: "Подбор зон и разбор тренировки в нужном контексте." },
    { title: "🧭 Персональные подсказки", text: "Что улучшить уже на следующем забеге." },
    { title: "🎯 Цели и прогресс", text: "Следи за ростом и узкими местами по неделям." },
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
  