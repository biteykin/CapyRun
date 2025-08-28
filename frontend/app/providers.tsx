'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // В свежих версиях SDK включён автосбор pageview.
      // Фиксируем набор дефолтов новой волной (см. доку):
      defaults: '2025-05-24',
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}