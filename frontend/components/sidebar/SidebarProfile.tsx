// frontend/components/sidebar/SidebarProfile.tsx
"use client";

import { useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAppUser } from "@/app/providers";

/**
 * Компонент профиля в сайдбаре.
 * - Берёт пользователя из контекста PHProvider (useAppUser)
 * - Загружает актуального пользователя через Supabase, если контекст пуст
 * - Подписывается на изменения сессии Supabase, чтобы обновлять контекст
 */
export default function SidebarProfile() {
  const supabase = createClientComponentClient();
  const { user, setUser } = useAppUser();

  // При первом рендере получаем пользователя, если его нет в контексте
  // и подписываемся на изменения auth-состояния
  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      if (!user) {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (u && !ignore) {
          setUser(u);
        }
      }
    }
    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      ignore = true;
      subscription?.subscription.unsubscribe();
    };
  }, [supabase, user, setUser]);

  // Неавторизованный пользователь — показываем кнопку "Войти"
  if (!user) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <button
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted rounded-md"
          onClick={() => (window.location.href = "/signin")}
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

  // Авторизованный пользователь — отображаем аватар и меню
  const displayName =
    user.user_metadata?.full_name || user.email;
  const avatarUrl = user.user_metadata?.avatar_url || null;

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
            <span className="text-sm font-medium truncate">
              {displayName}
            </span>
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
            // Выходим из аккаунта и обнуляем пользователя в контексте
            await supabase.auth.signOut();
            setUser(null);
            window.location.href = "/signin";
          }}
        >
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}