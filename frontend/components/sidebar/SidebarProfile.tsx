"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { User } from "@supabase/supabase-js";

export default function SidebarProfile() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    // Получаем текущего пользователя при монтировании
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Подписка на изменение состояния авторизации
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!user) {
    return (
      <button
        onClick={() => supabase.auth.signInWithPassword({ email, password })}
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        Войти
      </button>
    );
  }

  return (
    <div className="flex items-center space-x-2 p-2">
      {user.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt="Avatar"
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white">
          {user.email?.[0].toUpperCase() || "U"}
        </div>
      )}
      <span>{user.user_metadata?.full_name || user.email}</span>
    </div>
  );
}