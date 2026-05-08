//components/Sidebar.tsx

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import * as React from "react";
import { AppTooltip } from "@/components/ui/AppTooltip";
import logo from "@/app/icon.png";
import UnreadCountBadge from "@/components/ui/unread-count-badge";
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
  { href: "/coach",    label: "Тренер",     icon: User },
  { href: "/plan",     label: "Календарь",  icon: Calendar },
  { href: "/workouts", label: "Тренировки", icon: Activity },
  { href: "/goals",    label: "Цели",       icon: Target },
];

function NavItem({
  item,
  active,
  collapsed,
  rightSlot,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  rightSlot?: React.ReactNode;
}) {
  const Icon = item.icon;
  const btnClass = collapsed ? "justify-center px-2 w-8 h-8" : "gap-3";

  const Btn = (
    <SidebarMenuButton asChild isActive={active} className={btnClass}>
      <Link href={item.href}>
        <Icon className="h-5 w-5" />
        <span className="truncate">{item.label}</span>
        {!collapsed ? <span className="ml-auto">{rightSlot}</span> : null}
      </Link>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {collapsed ? (
        <AppTooltip
          content={item.label}
          side="right"
        >
          <div className="relative">
            {Btn}
            {rightSlot}
          </div>
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

  const [coachUnread, setCoachUnread] = React.useState<number>(0);

  const refetchUnread = React.useCallback(async () => {
    try {
      const res = await fetch("/api/coach/unread-count", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        console.warn("[sidebar] unread-count http error", res.status);
        return;
      }

      const json = (await res.json()) as { count?: number };

      setCoachUnread(Number(json.count) || 0);
    } catch (e) {
      console.warn("[sidebar] unread-count failed", e);
    }
  }, []);

  // 1) при старте + при смене роута
  React.useEffect(() => {
    refetchUnread();
  }, [refetchUnread, pathname]);

  // 2) при возвращении на вкладку
  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refetchUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refetchUnread]);

  // 3) лёгкий polling (потом заменим на realtime без таймера)
  React.useEffect(() => {
    const t = window.setInterval(() => {
      refetchUnread();
    }, 15000);
    return () => window.clearInterval(t);
  }, [refetchUnread]);

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
                <Image
                  src={logo}
                  alt="CapyRun"
                  width={28}
                  height={28}
                  priority
                  className="h-7 w-7 shrink-0 rounded-md object-contain"
                />
                <span
                  className={`h-display truncate font-semibold ${
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
                  rightSlot={
                    it.href === "/coach" ? (
                      <UnreadCountBadge
                        count={coachUnread}
                        // если collapsed — позиционирование делаем через wrapper в NavItem
                        className={collapsed ? "absolute -top-1 -right-1" : ""}
                      />
                    ) : null
                  }
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