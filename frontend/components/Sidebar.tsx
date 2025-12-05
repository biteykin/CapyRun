"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { AppTooltip } from "@/components/ui/AppTooltip";
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Home, Activity, Target, Calendar, User } from "lucide-react";

// профиль
import SidebarProfile from "./sidebar/SidebarProfile";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

// ----- НОВОЕ МЕНЮ -----
const TOP: Item[] = [
  { href: "/home",     label: "Главная",    icon: Home },
  { href: "/plan",     label: "Календарь",  icon: Calendar },
  { href: "/workouts", label: "Тренировки", icon: Activity },
  { href: "/coach",    label: "Тренер",     icon: User },
  { href: "/goals",    label: "Цели",       icon: Target },
];

function NavItem({
  item,
  active,
  collapsed,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const btnClass = collapsed ? "justify-center px-2 w-8 h-8" : "gap-3";

  const Btn = (
    <SidebarMenuButton asChild isActive={active} className={btnClass}>
      <Link href={item.href}>
        <Icon className="h-5 w-5" />
        <span className="truncate">{item.label}</span>
      </Link>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {collapsed ? (
        <AppTooltip content={item.label} side="right">
          {Btn}
        </AppTooltip>
      ) : (
        Btn
      )}
    </SidebarMenuItem>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = React.useCallback(
    (href: string) => pathname === href || pathname?.startsWith(href + "/"),
    [pathname]
  );

  return (
    <UISidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
      className="sticky top-0 h-svh"
    >
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className={collapsed ? "justify-center px-2 w-8 h-8" : "gap-3"}
            >
              <Link href="/home">
                <span
                  aria-hidden
                  className="inline-block h-6 w-6 rounded-md"
                  style={{
                    background: "linear-gradient(135deg,#FFD699,#DF6133)",
                  }}
                />
                <span
                  className={`h-display font-semibold truncate ${
                    collapsed ? "sr-only" : ""
                  }`}
                >
                  CapyRun
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="flex-1 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOP.map((it) => (
                <NavItem
                  key={it.href}
                  item={it}
                  active={isActive(it.href)}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="mt-auto border-t">
        <SidebarProfile />
      </SidebarFooter>

      <SidebarRail />
    </UISidebar>
  );
}