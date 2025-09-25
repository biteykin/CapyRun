"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { User2, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

type ProfileState = {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
} | null;

export default function SidebarProfile() {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<ProfileState>(null);
  const { state } = useSidebar(); // expanded | collapsed
  const collapsed = state === "collapsed";

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setProfile(null);
          return;
        }

        // Попробуем получить данные из public.profiles (если есть)
        const { data: p, error } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (mounted) {
          setProfile({
            display_name: p?.display_name ?? user.user_metadata?.full_name ?? user.email ?? "User",
            avatar_url: p?.avatar_url ?? (user.user_metadata?.avatar_url ?? null),
            email: user.email ?? null,
          });
        }
      } catch (e) {
        console.error("load profile error", e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [supabase]);

  // Если нет пользователя — показываем кнопку входа (или ничего)
  if (!profile) {
    return (
      <SidebarMenuButton asChild className="w-full" onClick={() => (window.location.href = "/login")}>
        <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <User2 className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-sm font-medium">Войти</div>
            <div className="text-xs text-muted-foreground">Аккаунт</div>
          </div>
        </button>
      </SidebarMenuButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? "avatar"} />
            ) : (
              <AvatarFallback>{(profile.display_name ?? "U")[0]}</AvatarFallback>
            )}
          </Avatar>

          {/* Скрываем текст в коллапсе */}
          <div className={`${collapsed ? "sr-only" : "flex flex-col truncate"}`}>
            <span className="text-sm font-medium truncate">{profile.display_name}</span>
            <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
          </div>

          {/* Chevron справа; в коллапсе лучше скрывать */}
          <ChevronUp className={`ml-auto transition-transform ${collapsed ? "sr-only" : ""}`} />
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
            // После signOut можно перенаправить
            window.location.href = "/login";
          }}
        >
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
