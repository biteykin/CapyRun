// frontend/app/(protected)/loading.tsx
export default function LoadingHomePage() {
    return (
      <main className="w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        </div>
  
        {/* KPI блок */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-background p-3 space-y-2"
            >
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
              <div className="h-2 w-10 rounded bg-muted/60 animate-pulse" />
            </div>
          ))}
        </div>
  
        {/* Главная цель */}
        <div className="rounded-2xl border bg-background p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
          </div>
  
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
  
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
            <div className="flex justify-between">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="h-3 w-10 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
  
        {/* Последние тренировки */}
        <div className="rounded-2xl border bg-background p-4 space-y-3">
          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
  
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                  <div className="space-y-1">
                    <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  </div>
                </div>
  
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
  
        {/* Быстрые действия */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-32 rounded-full bg-muted animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }