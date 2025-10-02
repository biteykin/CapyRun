// frontend/components/sidebar/SidebarProfile.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAppUser } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";

export default function SidebarProfile() {
  // 1) Хуки: контекст, локальный стейт — всегда вызываются в одном порядке
  const { user, setUser } = useAppUser();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 2) Поднимаем сессию и подписку на изменения auth
  useEffect(() => {
    let isMounted = true;

    (async () => {
      // Попытка быстро получить user из текущей сессии
      const { data: sess } = await supabase.auth.getSession();
      const u = sess?.session?.user ?? null;

      if (isMounted) setUser(u);

      // Если пользователя нет — дополнительная попытка
      if (!u) {
        const { data: uData } = await supabase.auth.getUser();
        if (isMounted) setUser(uData?.user ?? null);
      }

      if (isMounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, [setUser]);

  // 3) Подтягиваем профиль из БД, когда появился user.id
  useEffect(() => {
    let canceled = false;

    async function loadProfile() {
      if (!user?.id) {
        setProfile(null);
        return;
      }
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!canceled) setProfile(data ?? null);
      } catch {
        if (!canceled) setProfile(null);
      }
    }

    loadProfile();
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  // 4) Производные значения — вычисляем ХУКАМИ ПОВЕРХУ (безусловно)
  const displayName = useMemo(() => {
    const fromProfile =
      profile?.display_name && String(profile.display_name).trim();
    const fromMeta =
      user?.user_metadata?.full_name &&
      String(user.user_metadata.full_name).trim();

    // верхняя строка: display_name > full_name > дефолт
    return fromProfile || fromMeta || "Резвая Капибара";
  }, [profile?.display_name, user?.user_metadata?.full_name]);

  const avatarUrl = useMemo(() => {
    // Порядок: avatar_url из profiles > avatar_url из метаданных > дефолт
    return (
      profile?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      "/avatars/default-1.svg"
    );
  }, [profile?.avatar_url, user?.user_metadata?.avatar_url]);

  // 5) Рендер

  // Лоадер (скелетон) — красивый и постоянный
  if (loading) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <div className="w-full px-3 py-2 flex items-center gap-3">
          <Skeleton
            className="h-8 w-8 rounded-full shrink-0"
            style={{ backgroundColor: "#5a6772" }}
          />
          <div className="flex-1">
            <Skeleton
              className="h-4 w-[160px] rounded"
              style={{ backgroundColor: "#5a6772" }}
            />
            <Skeleton
              className="mt-2 h-3 w-[120px] rounded"
              style={{ backgroundColor: "#5a6772" }}
            />
          </div>
        </div>
      </SidebarMenuButton>
    );
  }

  // Не авторизован
  if (!user) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <button
          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md"
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

  // Авторизован
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
              onError={(e) => {
                // если svg/картинка не загрузилась — подставим дефолт
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith("/avatars/default-1.svg")) return;
                img.src = "/avatars/default-1.svg";
              }}
            />
            <AvatarFallback>
              {(displayName ?? "U").toString().trim().charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate text-left">
            {/* ВЕРХНЯЯ СТРОКА: только display_name|full_name|дефолт, БЕЗ email */}
            <span className="text-sm font-medium truncate">{displayName}</span>
            {/* НИЖНЯЯ СТРОКА: email */}
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
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
            try {
              await fetch("/api/auth/callback", { method: "POST" });
            } catch {}
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