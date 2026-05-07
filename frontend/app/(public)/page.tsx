import type { Metadata } from "next";

//frontend/app/(public)/page.tsx

import PHTrack from "@/components/analytics/PHTrack";
import Landing from "@/components/marketing/Landing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";
const TITLE = "CapyRun — ИИ-тренер по бегу для начинающих и любителей";
const DESCRIPTION =
  "Выберите цель, получите понятный план и обсуждайте прогресс с ИИ-тренером. Без давления, без сложной терминологии, без необходимости нанимать человека.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CapyRun",
  keywords: [
    "бег",
    "ИИ-тренер",
    "план бега",
    "5 км",
    "10 км",
    "Strava",
    "running coach",
    "AI coach",
  ],
  authors: [{ name: "CapyRun" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CapyRun",
    title: TITLE,
    description: DESCRIPTION,
    locale: "ru_RU",
    // Next.js автоматически подцепит app/opengraph-image.tsx,
    // но дублируем явно — для надёжности парсера Telegram и фолбэка
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CapyRun — ИИ-тренер по бегу",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function LandingPage() {
  return (
    <main>
      <PHTrack event="landing_viewed" />
      <Landing />
    </main>
  );
}