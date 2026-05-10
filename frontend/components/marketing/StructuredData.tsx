/**
 * JSON-LD структурированные данные schema.org для лендинга CapyRun.
 * Включает: Organization, WebSite, SoftwareApplication, FAQPage.
 *
 * Что это даёт:
 * - Google: rich snippets (FAQ-аккордеон в выдаче, карточки приложения)
 * - Yandex: лучшее понимание тематики, sitelinks
 * - Bing/DuckDuckGo: тематические карточки
 * - Perplexity/Brave/ChatGPT Search: точные цитаты с правильной атрибуцией
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://capyrun.com";

const faqsForSchema = [
  {
    q: "CapyRun правда подходит новичкам?",
    a: "Да. Сервис рассчитан на людей, которые хотят начать бегать и не хотят разбираться в сложной спортивной терминологии. Тренер объясняет всё простыми словами и поднимает нагрузку плавно.",
  },
  {
    q: "Это заменяет живого тренера?",
    a: "Для элитного спорта — нет. Для начинающих и любителей CapyRun закрывает главную потребность: понятный план, регулярную обратную связь и ответы на вопросы в любое время.",
  },
  {
    q: "Можно использовать со Strava?",
    a: "Да. Интеграция со Strava — текущий ключевой сценарий. Также поддерживаются Garmin, Polar, Coros, Suunto.",
  },
  {
    q: "Что если я ничего не понимаю в беге?",
    a: "Это нормальная стартовая точка. CapyRun помогает выбрать цель, объясняет тренировки и постепенно вводит в базовые понятия — пульсовые зоны, темп, восстановление, технику.",
  },
  {
    q: "Можно просто общаться с AI-тренером?",
    a: "Да. Можно обсуждать технику, питание, восстановление, мотивацию, страх перед стартом или просто делиться мыслями после тренировки. Это не ограничено.",
  },
  {
    q: "Мои данные приватны?",
    a: "Мы не продаём тренировочные данные и не строим рекламные профили. Данные используются только для генерации плана, отслеживания прогресса и персональных рекомендаций.",
  },
];

export default function StructuredData() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CapyRun",
    legalName: "CapyRun",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description:
      "AI-тренер по бегу для начинающих и любителей. Персональные планы, понятные тренировки, AI-собеседник 24/7.",
    sameAs: [
      // Когда появятся соцсети — добавь сюда:
      // "https://twitter.com/capyrun",
      // "https://t.me/capyrun",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@capyrun.com",
      contactType: "customer support",
      availableLanguage: ["Russian", "English"],
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CapyRun",
    url: SITE_URL,
    inLanguage: ["ru-RU", "en-US"],
    description:
      "Персональный AI-тренер по бегу. Помогает выбрать цель, собрать план и обсуждать прогресс.",
    publisher: {
      "@type": "Organization",
      name: "CapyRun",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CapyRun — AI Running Coach",
    description:
      "AI-тренер по бегу для начинающих и любителей. Подбирает цель, строит адаптивный план, объясняет тренировки простым языком и отвечает на вопросы 24/7.",
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Sports",
    operatingSystem: "Web, iOS, Android",
    url: SITE_URL,
    image: `${SITE_URL}/og-image.png`,
    inLanguage: ["ru-RU", "en-US"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      description: "Free to start, no credit card required",
    },
    featureList: [
      "Персональный план тренировок",
      "AI-чат с тренером 24/7",
      "Подготовка к 5 км, 10 км, полумарафону, марафону",
      "Адаптация плана под усталость и сон",
      "Интеграция со Strava, Garmin, Polar, Coros, Suunto",
      "Отслеживание прогресса и регулярности",
      "Объяснения тренировок простым языком",
    ],
    audience: {
      "@type": "Audience",
      audienceType: "Beginner and amateur runners",
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsForSchema.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const schemas = [organization, website, softwareApp, faqPage];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
