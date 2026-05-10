import type { Metadata, Viewport } from "next";

import PHTrack from "@/components/analytics/PHTrack";
import Landing from "@/components/marketing/Landing";
import StructuredData from "@/components/marketing/StructuredData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";
const TITLE = "CapyRun — AI-тренер по бегу для начинающих и любителей";
const DESCRIPTION =
  "Личный AI-тренер по бегу для начинающих и любителей. Поможет выбрать цель, соберёт понятный план под ваш уровень, объяснит каждую тренировку простыми словами и ответит на вопросы о темпе, восстановлении, технике и подготовке к стартам. Совместим со Strava, Garmin и Apple Watch.";

export const viewport: Viewport = {
  themeColor: "#FFF6DE",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CapyRun",
  keywords: [
    // RU — основные коммерческие
    "AI-тренер по бегу",
    "ИИ тренер по бегу",
    "тренер по бегу",
    "тренер по бегу онлайн",
    "онлайн тренер по бегу",
    "программа подготовки к забегу",
    "программа подготовки к марафону",
    "программа подготовки к полумарафону",
    "программа бега для начинающих",
    "план тренировок по бегу",
    "беговой план",
    "беговая программа",
    "подготовка к 5 км",
    "подготовка к 10 км",
    "подготовка к марафону",
    "подготовка к полумарафону",
    "как начать бегать",
    "бег для начинающих",
    "приложение для бега",
    "приложение тренер по бегу",
    "AI приложение для бега",
    // RU — long-tail
    "научиться бегать с нуля",
    "первая пробежка",
    "восстановление после бега",
    "пульсовые зоны для бега",
    "техника бега",
    "темп бега",
    // EN — для будущей англоязычной версии
    "AI running coach",
    "running coach app",
    "personalized running plan",
    "couch to 5k AI",
    "marathon training plan",
    "half marathon training plan",
    "AI running training program",
    "online running coach",
    "running plan generator",
    "бег",
    "Strava",
    "Garmin",
  ],
  authors: [{ name: "CapyRun" }],
  creator: "CapyRun",
  publisher: "CapyRun",
  category: "sports",
  classification: "AI Running Coach",
  alternates: {
    canonical: "/",
    languages: {
      "ru-RU": "/",
      "en-US": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CapyRun",
    title: TITLE,
    description: DESCRIPTION,
    countryName: "Worldwide",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
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
    creator: "@capyrun",
    site: "@capyrun",
  },
  // Верификации поисковых систем — впиши коды после регистрации в каждом сервисе
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    yahoo: process.env.YAHOO_SITE_VERIFICATION,
    other: {
      // Bing — также через meta-тег
      "msvalidate.01": process.env.BING_SITE_VERIFICATION || "",
      // Pinterest, если будет
      // 'p:domain_verify': process.env.PINTEREST_VERIFICATION || '',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Yandex-специфичные метатеги
  other: {
    "telegram:channel": "@capyrun",
    // Geo-таргетинг — указывает регион сайта (RU = Россия)
    "geo.region": "RU",
    "geo.placename": "Russia",
    // Яндекс читает этот тег для определения языка
    "yandex-tableau-link": SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function LandingPage() {
  return (
    <main>
      <StructuredData />
      <PHTrack event="landing_viewed" />
      <Landing />
    </main>
  );
}
