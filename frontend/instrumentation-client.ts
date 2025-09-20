// instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";

// НИЧЕГО не инициализируем здесь
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
