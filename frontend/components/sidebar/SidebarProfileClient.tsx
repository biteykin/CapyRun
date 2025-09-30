// frontend/components/sidebar/SidebarProfileClient.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

type Props = {
  initialUser?: any | null; // серверный user или null
};

export default function SidebarProfileClient({ initialUser }: Props) {
  const [user, setUser] = useState<any | null>(initialUser ?? null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // загрузка профиля (таблица profiles) для user.id
  async function loadProfile(forUser: any | null) {
    if (!forUser) {
      setProfile(null);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", forUser.id)
        .maybeSingle();
      setProfile(data ?? null);
    } catch (e) {
      console.error("loadProfile error", e);
      setProfile(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      // initialUser может быть передан сервером; если нет — попытаемся получить на клиенте
      if (!initialUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        if (session) {
          const { data: userData } = await supabase.auth.getUser();
          if (mounted) setUser(userData.user ?? null);
          if (userData.user) await loadProfile(userData.user);
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } else {
        // есть serverUser
        if (mounted) {
          setUser(initialUser);
          await loadProfile(initialUser);
        }
      }
      if (mounted) setLoading(false);
    }

    init();

    // Подписываемся на изменения аутентификации (SPA login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, [initialUser, supabase]);

  // Loading / skeleton
  if (loading) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <div className="w-full px-3 py-2 flex items-center gap-2">
          <Avatar className="h-8 w-8"><AvatarFallback>…</AvatarFallback></Avatar>
          <div className="flex-1">
            <div className="h-3 w-24 bg-muted/40 rounded" />
            <div className="h-2 w-32 bg-muted/30 rounded mt-1" />
          </div>
        </div>
      </SidebarMenuButton>
    );
  }

  // Не аутентифицирован
  if (!user) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <button className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted rounded-md" onClick={() => (window.location.href = "/login")}>
          <Avatar className="h-8 w-8"><AvatarFallback>U</AvatarFallback></Avatar>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">Войти</div>
            <div className="text-xs text-muted-foreground">Аккаунт</div>
          </div>
        </button>
      </SidebarMenuButton>
    );
  }

  const displayName = profile?.display_name ?? user.user_metadata?.full_name ?? user.email;
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : <AvatarFallback>{(displayName ?? "U")[0]}</AvatarFallback>}
          </Avatar>
          <div className="flex flex-col truncate text-left">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
        <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>Профиль</DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/workouts")}>Тренировки</DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/thresholds")}>Пороги</DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/notifications")}>Уведомления</DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}>Выйти</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}