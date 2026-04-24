// frontend/app/(protected)/profile/loading.tsx
export default function LoadingProfilePage() {
    return (
      <main className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        </div>
  
        <div className="rounded-2xl border bg-background p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-44 animate-pulse rounded bg-muted" />
                <div className="h-4 w-56 animate-pulse rounded bg-muted/70" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
  
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:min-w-[420px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-xl border bg-muted/10 p-3">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-14 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
  
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-background p-5">
            <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border bg-muted/10 p-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted/70" />
                </div>
              ))}
            </div>
          </div>
  
          <div className="rounded-2xl border bg-background p-5">
            <div className="mb-4 h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-xl border bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                  </div>
                  <div className="h-2 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }