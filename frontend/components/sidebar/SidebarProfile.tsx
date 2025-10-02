// frontend/components/sidebar/SidebarProfile.tsx
"use client";

import { useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAppUser } from "@/app/providers";

export default function SidebarProfile() {
  const { user, setUser } = useAppUser();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(prev => {
        const next = u ?? null;
        if ((prev?.id ?? null) === (next?.id ?? null)) return prev;
        return next;
      });
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(prev => {
        const next = session?.user ?? null;
        if ((prev?.id ?? null) === (next?.id ?? null)) return prev;
        return next;
      });
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, []); // ❗️важно: без зависимости от `user`

  if (!user) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <button
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted rounded-md"
          onClick={() => (window.location.href = "/login")}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">Войти</div>
            <div className="text-xs text-muted-foreground">Аккаунт</div>
          </div>
        </button>
      </SidebarMenuButton>
    );
  }

  // имя берём из профиля, если уже лежит в user_metadata — используем его
  const displayName = useMemo(() => {
    const dm = user?.user_metadata as any | undefined;
    const fromMeta = (dm?.display_name || dm?.full_name || "").toString().trim();
    if (fromMeta) return fromMeta;
    return "Спортивная Капибара";
  }, [user]);

  const avatarUrl = (user?.user_metadata as any)?.avatar_url || null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName ?? ""} />
            ) : (
              <AvatarFallback>
                {(displayName ?? "U")[0]}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col truncate text-left">
            {/* верхняя строка — только display_name */}
            <span className="text-sm font-medium truncate">{displayName}</span>
            {/* нижняя строка — email (если хочешь, можно скрыть) */}
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
        <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>
          Профиль
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/workouts")}>
          Тренировки
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/thresholds")}>
          Пороги
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/notifications")}>
          Уведомления
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            setUser(null);
            window.location.href = "/login";
          }}
        >
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}