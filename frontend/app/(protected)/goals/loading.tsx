// frontend/app/(protected)/goals/loading.tsx
export default function LoadingGoalsPage() {
    return (
      <main className="w-full space-y-4">
        {/* Верхняя плашка */}
        <div className="rounded-2xl border bg-background p-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted/70" />
          </div>
  
          <div className="flex gap-2">
            <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-36 animate-pulse rounded-md bg-[color:var(--btn-primary-bg,#FFF6E8)]" />
          </div>
        </div>
  
        {/* Главная цель */}
        <div className="rounded-2xl border bg-background p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          </div>
  
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
  
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
  
          <div className="space-y-2">
            <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
            <div className="flex justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-10 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
  
        {/* Остальные цели */}
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
  
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-background p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-2">
                    <div className="h-6 w-6 animate-pulse rounded bg-muted" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
                    </div>
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                </div>
  
                <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
  
                <div className="space-y-1">
                  <div className="h-2 w-full animate-pulse rounded bg-muted" />
                  <div className="flex justify-between">
                    <div className="h-2 w-12 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-8 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }