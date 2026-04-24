// frontend/app/(protected)/workouts/[id]/loading.tsx
export default function LoadingWorkoutDetailPage() {
    return (
      <main className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted/70" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
  
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-32 animate-pulse rounded-md bg-[color:var(--btn-primary-bg,#FFF6E8)]" />
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
  
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border bg-background p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
  
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border bg-background p-3">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
  
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-dashed bg-background p-4">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted/70" />
              <div className="mt-4 h-5 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
  
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-background p-4">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-28 animate-pulse rounded-xl bg-muted/70" />
            <div className="mt-3 flex gap-2">
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
  
          <div className="rounded-2xl border bg-background p-4">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
  
        <div className="rounded-2xl border bg-background p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-72 animate-pulse rounded-xl bg-muted/60" />
        </div>
  
        <div className="rounded-2xl border bg-background p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-[440px] animate-pulse rounded-2xl bg-muted/50" />
        </div>
      </main>
    );
  }