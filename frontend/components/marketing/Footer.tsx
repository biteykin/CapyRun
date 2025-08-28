import Link from "next/link";

const navLinks = [
  { href: "/login", label: "Войти", isExternal: false },
  { href: "/pricing", label: "Прайс", isExternal: false },
  { href: "/legal/privacy", label: "Политика", isExternal: false },
  { href: "mailto:hello@capyrun.com", label: "Контакты", isExternal: true },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-6 w-6 rounded-md"
            style={{ background: "linear-gradient(135deg,#FFD699,#DF6133)" }}
            aria-hidden="true"
          />
          <span className="h-display font-semibold">CapyRun</span>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm">
          {navLinks.map(({ href, label, isExternal }) =>
            isExternal ? (
              <a key={href} href={href} className="hover:underline">
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className="hover:underline">
                {label}
              </Link>
            )
          )}
        </nav>
      </div>
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg,#FFD699,#DF8233)" }}
        aria-hidden="true"
      />
    </footer>
  );
}