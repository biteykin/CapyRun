// frontend/components/sidebar/SidebarProfile.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppUser } from "@/app/providers";

type ProfileRow = {
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export default function SidebarProfile() {
  const { user, setUser } = useAppUser();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  async function loadProfile(forUserId: string | null | undefined) {
    if (!forUserId) {
      setProfile(null);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", forUserId)
        .maybeSingle();
      setProfile((data as ProfileRow) ?? null);
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      if (!user) {
        const { data: uData } = await supabase.auth.getUser();
        const u = uData?.user ?? null;
        if (mounted) {
          setUser(u);
          await loadProfile(u?.id ?? null);
        }
      } else {
        await loadProfile(user.id);
      }

      if (mounted) setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user || null;
      setUser(u);
      await loadProfile(u?.id ?? null);
    });

    return () => {
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- LOADING SKELETON (с аватаром, если уже знаем его url) ----------
  if (loading) {
    const optimisticAvatar =
      profile?.avatar_url || user?.user_metadata?.avatar_url || null;

    return (
      <SidebarMenuButton asChild className="w-full">
        <div className="w-full px-3 py-2 flex items-center gap-3">
          {optimisticAvatar ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={optimisticAvatar} alt="" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          ) : (
            <Skeleton className="h-8 w-8 rounded-full" />
          )}

          <div className="flex-1">
            <Skeleton className="h-3 w-28" />
            <div className="mt-1">
              <Skeleton className="h-2 w-36" />
            </div>
          </div>
        </div>
      </SidebarMenuButton>
    );
  }

  // ---------- NOT AUTHED ----------
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

  // ---------- AUTHED ----------
  // ВЕРХНЯЯ СТРОКА: только display_name (или full_name), НО НЕ email
  const title =
    (profile?.display_name && String(profile.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Профиль";

  // НИЖНЯЯ СТРОКА: email пользователя
  const subtitle = user.email || "";

  // АВАТАР: сначала из profiles, затем из user_metadata
  const avatarUrl =
    profile?.avatar_url || user.user_metadata?.avatar_url || null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          {avatarUrl ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={title} />
              <AvatarFallback>{(title ?? "U")[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarFallback>{(title ?? "U")[0]}</AvatarFallback>
            </Avatar>
          )}

          <div className="flex flex-col truncate text-left">
            <span className="text-sm font-medium truncate">{title}</span>
            {subtitle ? (
              <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
            ) : null}
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
            try {
              await supabase.auth.signOut();
            } finally {
              // чистим контекст и уходим на логин
              setUser(null);
              window.location.href = "/login";
            }
          }}
        >
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}