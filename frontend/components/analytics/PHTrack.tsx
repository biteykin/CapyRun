'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

type Props = { event: string; props?: Record<string, any> };

export default function PHTrack({ event, props }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!event) return;
    const utm = Object.fromEntries(
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']
        .map(k => [k, sp.get(k) || undefined])
        .filter(([, v]) => !!v)
    );
    const referrer = typeof document !== 'undefined' ? document.referrer : undefined;
    posthog.capture(event, { path: pathname, referrer, ...utm, ...props });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // стреляем один раз на маунт

  return null;
}