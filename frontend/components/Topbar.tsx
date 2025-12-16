// components/Topbar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AddWorkoutMenu from "@/components/workouts/AddWorkoutMenu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const HOME_HREF = "/home"; // у тебя домашняя — /home

function buildCrumbs(pathname: string) {
  const path = (pathname || "/").split("#")[0].split("?")[0];
  const parts = path.split("/").filter(Boolean);
  const crumbs: { href?: string; label: string }[] = [{ href: HOME_HREF, label: "Главная" }];

  if (parts.length === 0 || parts[0] === "home") return crumbs;

  const root = parts[0];
  if (root === "workouts") {
    crumbs.push({ href: "/workouts", label: "Тренировки" });
    const second = parts[1];
    if (second === "upload") crumbs.push({ label: "Загрузка файла" });
    else if (second === "new") crumbs.push({ label: "Новая тренировка" });
    else if (second) {
      crumbs.push({ label: "Тренировка" });
      if (parts[2] === "edit") crumbs.push({ label: "Редактировать" });
    }
  } else if (root === "goals") {
    crumbs.push({ href: "/goals", label: "Цели" });

    const second = parts[1];
    if (second === "onboarding") {
      crumbs.push({ label: "Новая цель" });
    }
  } else if (root === "plan") {
    crumbs.push({ label: "План" });
  }
  else if (root === "coach") crumbs.push({ label: "Coach" });
  else if (root === "nutrition") crumbs.push({ label: "Питание" });
  else if (root === "profile") crumbs.push({ label: "Профиль" });
  else if (root === "badges") crumbs.push({ label: "Бейджи" });
  else crumbs.push({ label: "CapyRun" });

  return crumbs;
}

// ВАЖНО: именованный экспорт (как у тебя раньше)
export function Topbar() {
  const pathname = usePathname() || "/";
  const items = React.useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--color-bg-surface-primary)]/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* Сохраняем размер/стиль заголовка как раньше */}
        <div className="h-display text-base font-semibold text-foreground">
          <Breadcrumb>
            <BreadcrumbList>
              {items.map((c, i) => {
                const last = i === items.length - 1;
                return (
                  <React.Fragment key={`${c.label}-${i}`}>
                    <BreadcrumbItem>
                      {last || !c.href ? (
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          {/* Выглядит как обычный текст, не как ссылка */}
                          <Link className="no-underline hover:no-underline focus:no-underline" href={c.href}>
                            {c.label}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {i < items.length - 1 && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <AddWorkoutMenu />
        </div>
      </div>
    </header>
  );
}