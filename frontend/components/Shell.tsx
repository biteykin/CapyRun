"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="grid min-h-[100svh] md:h-dvh w-full grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside
        className="hidden md:block border-r border-[var(--border)] bg-[var(--color-bg-surface-primary)]
                   sticky top-0 h-[100svh] md:h-dvh overflow-y-auto"
      >
        <Sidebar />
      </aside>
      <main className="flex min-w-0 flex-col">
        <Topbar />
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
          <div className={mounted ? "" : "opacity-0"}>{children}</div>
        </div>
      </main>
    </div>
  );
}