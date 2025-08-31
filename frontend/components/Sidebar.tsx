"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

const NAV = [
  { href: "/home", icon: "🏠", label: "Главная страница" },
  { href: "/workouts", icon: "📋", label: "Мои тренировки" },
  { href: "/goals", icon: "🎯", label: "Цели" },
  { href: "/plan", icon: "📅", label: "Тренировочный план" },
  { href: "/coach", icon: "💬", label: "Общение с тренером" },
  { href: "/nutrition", icon: "🍽️", label: "Дневник питания" },
  { href: "/profile", icon: "👤", label: "Профиль" },
  { href: "/badges", icon: "🥇", label: "Бейджи и рекорды" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userLabel, setUserLabel] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      const label =
        (u?.email as string) ||
        (u?.user_metadata as any)?.full_name ||
        (u?.id as string) ||
        "Профиль";
      setUserLabel(label);
    });
  }, []);

  return (
    <aside className="w-[260px] border-r border-white/10 bg-[#0e0f13] text-neutral-100 flex flex-col">
      {/* sticky header как у ChatGPT */}
      <div className="sticky top-0 z-10 bg-[#0e0f13] border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 font-semibold">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10">
            🏃‍♂️
          </div>
          <div>CapyRun</div>
        </div>
      </div>

      {/* плоское меню — белые ссылки, без подчёркивания */}
      <nav className="px-2 pt-2 space-y-1">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 transition ${
                active ? "bg-white/15 text-white" : "hover:bg-white/10"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* подпись профиля внизу слева */}
      <div className="mt-auto px-3 py-3 text-sm text-neutral-400 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center font-bold">
          {userLabel ? userLabel.slice(0, 1).toUpperCase() : "U"}
        </div>
        <div className="truncate">{userLabel || "Профиль"}</div>
      </div>
    </aside>
  );
}
