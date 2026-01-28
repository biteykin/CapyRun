"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";
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

function UnreadBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (!count || count <= 0) return null;

  // в collapsed режиме покажем маленькую точку, чтобы не ломать верстку
  if (collapsed) {
    return (
      <span
        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
        aria-label={`Новых: ${count}`}
        title={`Новых: ${count}`}
      />
    );
  }

  return (
    <span
      className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground"
      aria-label={`Новых: ${count}`}
      title={`Новых: ${count}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function useCoachUnreadCount(opts: { enabled: boolean }) {
  const { enabled } = opts;
  const [count, setCount] = React.useState(0);
  const uidRef = React.useRef<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    const uid = uidRef.current;
    if (!uid) {
      setCount(0);
      return;
    }
    const { data, error } = await supabase.rpc("get_unread_count_global");
    if (error) {
      console.warn("[coach] get_unread_count_global failed", error);
      return;
    }
    setCount(Number(data) || 0);
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let chMsgs: ReturnType<typeof supabase.channel> | null = null;
    let chReads: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id ?? null;
      uidRef.current = uid;
      if (!mounted) return;
      await refresh();

      if (!uid) return;

      // 1) Любое новое сообщение -> если не наше, пересчитаем unread через RPC
      // (да, подписка без фильтра; в рамках одного проекта это нормально, а корректность дает RPC)
      chMsgs = supabase
        .channel(`coach-unread-messages-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "coach_messages" },
          (payload) => {
            const m = payload.new as any;
            if (!m) return;
            if (m.author_id && m.author_id === uid) return;
            refresh();
          }
        )
        .subscribe();

      // 2) Когда мы отмечаем прочитанным (coach_mark_thread_read пишет в coach_thread_reads) -> тоже обновим
      chReads = supabase
        .channel(`coach-unread-reads-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "coach_thread_reads",
            filter: `user_id=eq.${uid}`,
          },
          () => refresh()
        )
        .subscribe();
    })();

    // auth changes => переинициализируем uid и пересчитаем
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      uidRef.current = session?.user?.id ?? null;
      await refresh();
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
      try {
        if (chMsgs) supabase.removeChannel(chMsgs);
      } catch {}
      try {
        if (chReads) supabase.removeChannel(chReads);
      } catch {}
    };
  }, [enabled, refresh]);

  return { unreadCount: count, refresh };
}

function NavItem({
  item,
  active,
  collapsed,
  right,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  right?: React.ReactNode;
}) {
  const Icon = item.icon;
  const btnClass = collapsed ? "justify-center px-2 w-8 h-8" : "gap-3";

  const Btn = (
    <SidebarMenuButton asChild isActive={active} className={btnClass}>
      <Link href={item.href}>
        <span className={collapsed ? "relative" : "contents"}>
          <Icon className="h-5 w-5" />
          {collapsed ? right : null}
        </span>
        <span className="truncate">{item.label}</span>
        {!collapsed ? right : null}
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

  // unread для "Тренер"
  const { unreadCount: coachUnread } = useCoachUnreadCount({ enabled: true });

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
                  right={
                    it.href === "/coach" ? (
                      <UnreadBadge count={coachUnread} collapsed={collapsed} />
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