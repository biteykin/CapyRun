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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAppUser } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Settings, LogOut } from "lucide-react";

type SidebarSessionUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, any> | null;
};

export default function SidebarProfile() {
  const { user, setUser } = useAppUser();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const json = (await res.json()) as {
          user: SidebarSessionUser | null;
          profile: any | null;
        };

        if (!cancelled) {
          setUser(json.user as any);
          setProfile(json.profile ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const displayName = useMemo(() => {
    const fromProfile =
      profile?.display_name && String(profile.display_name).trim();
    const fromMeta =
      user?.user_metadata?.full_name &&
      String(user.user_metadata.full_name).trim();

    return fromProfile || fromMeta || "Резвая Капибара";
  }, [profile?.display_name, user?.user_metadata?.full_name]);

  const avatarUrl = useMemo(() => {
    return (
      profile?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      "/avatars/default-1.png"
    );
  }, [profile?.avatar_url, user?.user_metadata?.avatar_url]);

  if (loading) {
    return (
      <SidebarMenuButton asChild className="w-full">
        <div className="w-full px-3 py-2 flex items-center gap-3">
          <Skeleton
            className="h-8 w-8 rounded-full shrink-0"
          />
          <div className="flex-1">
            <Skeleton
              className="h-4 w-[160px] rounded"
            />
            <Skeleton
              className="mt-2 h-3 w-[120px] rounded"
            />
          </div>
        </div>
      </SidebarMenuButton>
    );
  }

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-md">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith("/avatars/default-1.png")) return;
                img.src = "/avatars/default-1.png";
              }}
            />
            <AvatarFallback>
              {(displayName ?? "U").toString().trim().charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate text-left">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">
              {user.email ?? ""}
            </span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
        <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Профиль</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (window.location.href = "/integrations")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Интеграции</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              try {
                window.sessionStorage.setItem("capyrun:logout-in-progress", "1");
              } catch {}

              await supabase.auth.signOut({ scope: "local" });

              await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
              });
            } catch {}

            try {
              window.sessionStorage.removeItem("capyrun:logout-in-progress");
            } catch {}

            setUser(null);
            window.location.href = "/login";
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Выйти</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}