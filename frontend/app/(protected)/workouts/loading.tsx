// frontend/app/(protected)/workouts/loading.tsx
export default function LoadingWorkoutsPage() {
    return (
      <main className="w-full space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-[color:var(--btn-primary-bg,#FFF6E8)]" />
        </div>
  
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl border bg-background p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
  
        <div className="overflow-hidden rounded-2xl border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
          </div>
  
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 border-b bg-muted/20 px-4 py-3 md:grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-muted" />
            ))}
          </div>
  
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr] md:items-center">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
                  </div>
                </div>
  
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 w-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }