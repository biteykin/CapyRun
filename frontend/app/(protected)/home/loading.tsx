// frontend/app/(protected)/loading.tsx
export default function LoadingHomePage() {
  return (
    <main className="w-full space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="h-9 w-44 rounded bg-muted animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-48 rounded-full bg-muted animate-pulse" />
          <div className="h-8 w-28 rounded-md bg-muted animate-pulse" />
        </div>
      </header>

      {/* Hero row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border bg-background p-5 sm:p-6">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-muted/60 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-6 w-28 rounded-full bg-muted animate-pulse" />
              <div className="h-6 w-32 rounded-full bg-muted animate-pulse" />
            </div>

            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="h-24 w-44 rounded-t-full border-[14px] border-muted animate-pulse" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-8 w-44 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full max-w-md rounded bg-muted animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-36 rounded bg-muted/70 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-background/70 p-3 space-y-2">
                  <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
                  <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-background p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="h-3 w-14 rounded bg-muted/70 animate-pulse" />
            </div>
          </div>
          <div className="h-32 rounded-2xl border bg-muted/40 animate-pulse" />
          <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Goal + next workout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-background p-5 space-y-4">
            <div className="h-6 w-36 rounded-full bg-muted animate-pulse" />
            <div className="rounded-3xl border bg-muted/20 p-4">
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-2xl bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted/70 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="rounded-2xl border bg-background p-5 space-y-4">
        <div>
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="mt-2 h-3 w-72 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="flex h-56 items-end gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-muted animate-pulse"
              style={{ height: `${30 + ((i * 17) % 65)}%` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-background p-5 space-y-4">
            <div>
              <div className="h-5 w-36 rounded bg-muted animate-pulse" />
              <div className="mt-2 h-3 w-52 rounded bg-muted/70 animate-pulse" />
            </div>
            <div className="h-52 rounded-2xl bg-muted/30 animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}