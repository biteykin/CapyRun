// frontend/app/(protected)/plan/loading.tsx
export default function LoadingPlanPage() {
    return (
      <main className="w-full space-y-4">
        <div className="rounded-2xl border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="h-6 w-36 animate-pulse rounded bg-muted" />
  
            <div className="flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
  
          <div className="grid grid-cols-7 gap-px border-b bg-border/50 px-2 py-2">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <div key={day} className="flex justify-center">
                <div className="h-3 w-5 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
  
          <div className="grid grid-cols-7 gap-px bg-border/50 p-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-28 bg-background p-2">
                <div className="mb-3 h-6 w-6 animate-pulse rounded-md bg-muted" />
  
                <div className="space-y-1.5">
                  {i % 3 === 0 ? (
                    <div className="h-8 animate-pulse rounded-md bg-muted/80" />
                  ) : null}
  
                  {i % 5 === 0 ? (
                    <div className="h-8 animate-pulse rounded-md bg-muted/60" />
                  ) : null}
  
                  {i % 7 === 0 ? (
                    <div className="h-8 animate-pulse rounded-md bg-[color:var(--btn-primary-bg,#FFF6E8)]" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }