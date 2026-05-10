import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Базовое правило для всех ботов
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/dashboard/",
          "/legal/", // если такие появятся
          "/*?utm_*", // не индексируем UTM-варианты
          "/*?ref=*",
        ],
      },
      // Поисковые боты — явное allow для надёжности
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Googlebot-Image", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
      { userAgent: "DuckDuckBot", allow: "/" },
      { userAgent: "Yandex", allow: "/" },
      { userAgent: "YandexBot", allow: "/" },
      { userAgent: "YandexImages", allow: "/" },
      // Brave Search использует свой индекс через Goggles + не имеет явного UA,
      // но уважает общие правила
      // Ecosia использует индекс Bing — отдельные правила не нужны

      // AI-поисковики
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Perplexity-User", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" }, // ChatGPT search
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "Applebot", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },

      // Боты, тренирующие LLM на твоём контенте.
      // Если не хочешь, чтобы Claude/ChatGPT/Gemini обучались на лендинге —
      // поменяй allow на disallow. Сейчас разрешаем для лучшей цитируемости.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" }, // обучение Gemini
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, ""), // Яндекс-специфика, для канонического домена
  };
}
