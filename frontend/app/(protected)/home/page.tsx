"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import PHTrack from "@/components/analytics/PHTrack";
import UploadFits from "@/components/fit/UploadFits";

export default function HomePage() {
  const qs = useSearchParams();

  useEffect(() => {
    // фиксируем «первый вход после регистрации», если нужно (как делали ранее)
    const fromQuery = qs.get("just_signed_up") === "1";
    const fromSession =
      typeof window !== "undefined" && sessionStorage.getItem("capy.just_signed_up") === "1";
    if ((fromQuery || fromSession) && typeof window !== "undefined" && !localStorage.getItem("capy.first_dashboard_tracked")) {
      posthog.capture("first_dashboard_after_signup");
      localStorage.setItem("capy.first_dashboard_tracked", "1");
      try { sessionStorage.removeItem("capy.just_signed_up"); } catch {}
    }
  }, [qs]);

  return (
    <main className="space-y-8">
      <PHTrack event="dashboard_viewed" />
      <UploadFits />
    </main>
  );
}
