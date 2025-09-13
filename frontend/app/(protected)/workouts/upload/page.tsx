"use client";

import { useEffect } from "react";
import { useSearchParams /*, useRouter */ } from "next/navigation";
import posthog from "posthog-js";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import PHTrack from "@/components/analytics/PHTrack";
import UploadFits from "@/components/fit/UploadFits";
// Если нужен безопасный импорт без SSR:
// import dynamic from "next/dynamic";
// const UploadFits = dynamic(() => import("@/components/fit/UploadFits"), { ssr: false });

export default function WorkoutUploadPage() {
  const qs = useSearchParams();
  // const router = useRouter();

  useEffect(() => {
    // Отдельное событие для PostHog (страница загрузки)
    posthog.capture("workout_upload_page_viewed", {
      from: qs.get("from") || undefined,
    });
  }, [qs]);

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Тренировки", href: "/workouts" },
            { label: "Загрузка файла" },
          ]}
        />
      </div>

      {/* Унифицированный трекинг через твой компонент */}
      <PHTrack event="workout_upload_viewed" />

      {/* Основной блок загрузки */}
      <section>
        <UploadFits
          // Если UploadFits поддерживает колбэк — раскомментируй для редиректа на список:
          // onSuccess={() => router.push("/workouts")}
        />
      </section>
    </main>
  );
}