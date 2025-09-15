import PublicTopbar from "@/components/PublicTopbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <PublicTopbar />
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
