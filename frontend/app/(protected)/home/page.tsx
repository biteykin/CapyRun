// в компоненте страницы /app/(protected)/home/page.tsx
"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PHTrack from '@/components/analytics/PHTrack';

export default function HomePage() {
  const r = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) r.push("/login");
      else setReady(true);
    });
  }, [r]);

  if (!ready) return null;

  return (
    <>
      <PHTrack event="dashboard_viewed" />
      <div>
        <h1 className="text-2xl font-semibold mb-2">🏃 CapyRun — FIT Analyzer</h1>
        <p className="text-neutral-400 mb-4">
          Загрузите .fit → отчёт / прогресс / план.
        </p>

        <div className="flex gap-3">
          <Link href="/workouts" className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2">
            Мои тренировки
          </Link>
          <Link href="/workouts" className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2">
            Загрузить тренировку (скоро)
          </Link>
        </div>
      </div>
    </>
  );
}
