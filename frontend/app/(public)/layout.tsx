import type { ReactNode } from "react";
import "@/app/globals.css";
import NavbarPublic from "@/components/marketing/NavbarPublic";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-bg-surface-primary)]">
      <NavbarPublic />
      {children}
    </div>
  );
}