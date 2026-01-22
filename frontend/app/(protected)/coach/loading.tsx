// frontend/app/(protected)/coach/loading.tsx
export default function LoadingCoachPage() {
    return (
      <main className="w-full space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-4 w-[520px] max-w-full rounded bg-muted" />
        </div>
  
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="h-5 w-44 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-5 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="h-28 w-full rounded bg-muted" />
        </div>
  
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-muted" />
            ))}
          </div>
        </div>
      </main>
    );
  }