// frontend/app/(protected)/coach/loading.tsx
export default function LoadingCoachPage() {
  return (
    <main className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 rounded bg-muted animate-pulse" />
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Chat container */}
      <div className="flex h-[70vh] flex-col rounded-2xl border bg-background overflow-hidden">
        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-hidden p-4">
          {Array.from({ length: 6 }).map((_, i) => {
            const isUser = i % 2 === 1;

            return (
              <div
                key={i}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[75%] space-y-2 rounded-2xl px-4 py-3
                    ${isUser
                      ? "bg-muted/60"
                      : "bg-muted/40"}
                  `}
                >
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions (имитация кнопок подсказок) */}
        <div className="border-t bg-background p-3 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-32 rounded-full bg-muted animate-pulse"
            />
          ))}
        </div>

        {/* Input area */}
        <div className="border-t bg-background p-3">
          <div className="flex items-center gap-2">
            <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
            <div className="h-10 w-10 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}