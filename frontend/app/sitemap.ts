import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          ru: `${SITE_URL}/`,
          en: `${SITE_URL}/en`,
          "x-default": `${SITE_URL}/`,
        },
      },
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/login?mode=signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // По мере появления новых публичных страниц добавляй сюда:
    // блог, разделы про подготовку к 5/10/21/42 км, про FAQ-разделы и т.д.
  ];
}
