// frontend/components/sidebar/SidebarProfile.tsx
"use client";

import { useEffect } from "react";
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
  }, [user, setUser]);

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