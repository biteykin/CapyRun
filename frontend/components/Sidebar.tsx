"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { AppTooltip } from "@/components/ui/AppTooltip";
import { supabase } from "@/lib/supabaseBrowser";
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
  coachUnreadCount,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  coachUnreadCount: number;
}) {
  const Icon = item.icon;
  const btnClass = collapsed ? "justify-center px-2 w-8 h-8" : "gap-3";

  const showCoachBadge = item.href === "/coach" && coachUnreadCount > 0;
  const badgeText = coachUnreadCount > 9 ? "9+" : String(coachUnreadCount);

  const Btn = (
    <SidebarMenuButton asChild isActive={active} className={btnClass}>
      <Link href={item.href}>
        <Icon className="h-5 w-5" />
        <span className="truncate">{item.label}</span>
        {!collapsed && showCoachBadge ? (
          <span
            className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E15425] text-[11px] font-extrabold leading-none text-white"
            aria-label={`Непрочитанных: ${coachUnreadCount}`}
            title={`Непрочитанных: ${coachUnreadCount}`}
          >
            {badgeText}
          </span>
        ) : null}
      </Link>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {collapsed ? (
        <AppTooltip
          content={
            showCoachBadge
              ? `${item.label} • новых: ${coachUnreadCount}`
              : item.label
          }
          side="right"
        >
          <div className="relative">
            {Btn}
            {/* В свернутом состоянии показываем маленькую точку-уведомление */}
            {showCoachBadge ? (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#E15425]"
                aria-hidden
              />
            ) : null}
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

  const [coachUnreadCount, setCoachUnreadCount] = React.useState<number>(0);

  const refreshUnread = React.useCallback(async () => {
    // Если сессии нет (в момент гидрации) — просто не падаем.
    const { data, error } = await supabase.rpc("get_unread_count_global");
    if (error) return;
    setCoachUnreadCount(Number(data ?? 0) || 0);
  }, []);

  // 1) Первичная загрузка + когда вкладка снова активна
  React.useEffect(() => {
    refreshUnread();

    const onFocus = () => refreshUnread();
    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUnread]);

  // 2) Realtime: любые новые сообщения → обновим счетчик
  React.useEffect(() => {
    const channel = supabase
      .channel("coach-unread-badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coach_messages" },
        () => {
          // не увеличиваем руками (чтобы не ошибиться), а просто рефетчим
          refreshUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshUnread]);

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
                  coachUnreadCount={coachUnreadCount}
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