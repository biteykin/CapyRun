export default function Logos() {
    const logos = [
      { name: "Garmin",  w: 84 },
      { name: "Coros",   w: 72 },
      { name: "Polar",   w: 72 },
      { name: "Strava",  w: 80 },
      { name: "Suunto",  w: 84 },
    ];
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <div className="text-center text-sm text-[var(--text-secondary)]">Интеграции — скоро</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {logos.map((l) => (
            <div
              key={l.name}
              className="opacity-60 hover:opacity-100 transition"
              style={{ filter: "grayscale(100%)" }}
            >
              <div
                className="h-6 rounded"
                style={{ width: l.w, background: "linear-gradient(180deg,#DADBDD,#B9BBC0)" }}
                title={l.name}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }
  