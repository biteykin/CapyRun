import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.05 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/(capyrun\.com|capyrun\.vercel\.app)\/api/
  ],
});
