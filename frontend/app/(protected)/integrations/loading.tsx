// frontend/app/(protected)/integrations/loading.tsx
export default function LoadingIntegrationsPage() {
    return (
      <main className="space-y-4">
        <div className="rounded-2xl border bg-background">
          <div className="border-b px-6 py-5">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
          </div>
  
          <div className="space-y-6 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted/70" />
                </div>
              </div>
              <div className="h-9 w-36 animate-pulse rounded-md bg-[color:var(--btn-primary-bg,#FFF6E8)]" />
            </div>
  
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-52 animate-pulse rounded-full bg-muted" />
            </div>
  
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-2xl border bg-muted/15 p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-44 animate-pulse rounded bg-muted/70" />
                </div>
              ))}
            </div>
  
            <div className="flex items-center gap-2">
              <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
            </div>
  
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-dashed bg-background p-5 opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
                  </div>
                  <div className="h-4 w-56 animate-pulse rounded bg-muted/70" />
                  <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }