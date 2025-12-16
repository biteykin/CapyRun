"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { MoreHorizontal, LogOut } from "lucide-react";

export default function ProfileUserMenu() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("logout error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Меню пользователя">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        {/* сюда позже можно добавить пункты типа "Настройки", "Профиль" и т.д. */}

        <DropdownMenuSeparator />

        {/* Самый низ меню */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onLogout}
          disabled={loading}
        >
          <LogOut className="mr-2 size-4" />
          {loading ? "Выходим…" : "Выйти"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}