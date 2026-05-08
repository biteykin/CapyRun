import type { Metadata } from "next";

//frontend/app/(public)/page.tsx

import PHTrack from "@/components/analytics/PHTrack";
import Landing from "@/components/marketing/Landing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";
const TITLE = "CapyRun — AI-тренер по бегу для начинающих и любителей";
const DESCRIPTION =
  "Личный AI-тренер по бегу для начинающих и любителей. Поможет выбрать цель, соберёт понятный план под ваш уровень, объяснит каждую тренировку простыми словами и ответит на вопросы о темпе, восстановлении, технике и подготовке к стартам. Совместим со Strava, Garmin и Apple Watch.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CapyRun",
  keywords: [
    "AI-тренер по бегу",
    "тренер по бегу онлайн",
    "бег",
    "план тренировок по бегу",
    "первые 5 км",
    "первые 10 км",
    "подготовка к марафону",
    "AI running coach",
    "5 км",
    "10 км",
    "Strava",
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
        alt: "CapyRun — AI-тренер по бегу для начинающих и любителей",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  // Telegram-bot протокол парсит обычные OG-теги, но ему помогает
  // явный thumbnail и чёткое описание длиной 80–200 символов
  other: {
    "telegram:channel": "@capyrun",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
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