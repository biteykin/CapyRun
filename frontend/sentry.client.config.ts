// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: isProd ? [Sentry.replayIntegration()] : [],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: isProd ? 1.0 : 0,
  enableLogs: true,
  debug: false,
});