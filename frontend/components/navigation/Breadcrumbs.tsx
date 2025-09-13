"use client";

import Link from "next/link";
import clsx from "clsx";

type Crumb = {
  label: string;
  href?: string; // если не передан — элемент некликабельный (последний)
};

export default function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Хлебные крошки" className={clsx("text-sm", className)}>
      <ol className="flex flex-wrap items-center">
        {items.map((it, idx) => {
          const isLast = idx === items.length - 1;
          const content = it.href && !isLast ? (
            // Кликабельно, но визуально — как обычный текст
            <Link
              href={it.href}
              className="text-foreground no-underline hover:no-underline focus:no-underline active:no-underline"
            >
              {it.label}
            </Link>
          ) : (
            <span className={clsx("text-foreground", isLast && "font-medium")}>
              {it.label}
            </span>
          );

          return (
            <li key={idx} className="inline-flex items-center">
              {idx > 0 && <span className="mx-2 opacity-60">/</span>}
              <span className="truncate max-w-[60vw] sm:max-w-[40vw]">{content}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}