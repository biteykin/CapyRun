// components/Shell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import Sidebar from "@/components/Sidebar";
import AddWorkoutMenu from "@/components/workouts/AddWorkoutMenu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const HOME_HREF = "/home";

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
    // /goals → "Главная > Цели"
    crumbs.push({ href: "/goals", label: "Цели" });

    const second = parts[1];
    // /goals/onboarding → "Главная > Цели > Новая цель"
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

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const items = React.useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <SidebarProvider>
      {/* Левый сайдбар — фиксированный/стики внутри компонента Sidebar.tsx */}
      <Sidebar />

      {/* Правая колонка с контентом: занимает всю высоту и скроллится сама */}
      <SidebarInset className="flex min-h-svh flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
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
          <div className="ml-auto">
            <AddWorkoutMenu />
          </div>
        </header>

        {/* ВАЖНО: именно этот блок скроллится, не вся страница */}
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}