"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

type StravaSyncApi = {
  run: () => Promise<void>;
  loading: boolean;
  err: string | null;
  result: { added: number; updated: number } | null;
  disabled: boolean;
};

const StravaSyncContext = React.createContext<StravaSyncApi | null>(null);

function useStravaSyncWorkflow(opts: { disabled: boolean; autoStart: boolean }): StravaSyncApi {
  const { disabled, autoStart } = opts;
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ added: number; updated: number } | null>(null);

  const run = React.useCallback(async () => {
    if (disabled || loading) return;
    setErr(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const detail = String(json?.detail || json?.reason || "Ошибка синхронизации");
        if (detail.includes("strava_app_athlete_limit_exceeded")) {
          setErr("Strava отклонила запрос: приложение упёрлось в лимит подключённых аккаунтов.");
          return;
        }
        if (detail.includes("strava_cloudfront_403")) {
          setErr(
            "Strava временно отклоняет запросы приложения (403 CloudFront). Проверьте лимиты и статус приложения Strava.",
          );
          return;
        }
        setErr(detail);
        return;
      }

      const added = Number(json?.added ?? 0);
      const updated = Number(json?.updated ?? 0);
      setResult({ added, updated });

      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка синхронизации");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, router]);

  React.useEffect(() => {
    if (!autoStart) return;
    if (disabled) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return { run, loading, err, result, disabled };
}

export function StravaSyncGroup({
  disabled = false,
  autoStart = false,
  children,
}: {
  disabled?: boolean;
  autoStart?: boolean;
  children: React.ReactNode;
}) {
  const api = useStravaSyncWorkflow({ disabled, autoStart });
  return <StravaSyncContext.Provider value={api}>{children}</StravaSyncContext.Provider>;
}

type Props = {
  disabled?: boolean;
  autoStart?: boolean;
  compact?: boolean;
  statusOnly?: boolean;
};

export default function StravaSyncButton({
  disabled,
  autoStart,
  compact,
  statusOnly,
}: Props) {
  const ctx = React.useContext(StravaSyncContext);
  const own = useStravaSyncWorkflow({
    disabled: ctx ? true : Boolean(disabled),
    autoStart: ctx ? false : Boolean(autoStart),
  });
  const api = ctx ?? own;
  const { run, loading, err, result } = api;

  if (compact && statusOnly) {
    return null;
  }

  if (compact) {
    return (
      <Button type="button" onClick={() => void run()} disabled={api.disabled || loading}>
        <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Синхронизация…" : "Синхронизировать"}
      </Button>
    );
  }

  if (statusOnly) {
    return (
      <>
        {result ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground">
            Добавлено: <span className="font-medium">{result.added}</span>, обновлено:{" "}
            <span className="font-medium">{result.updated}</span>
          </div>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        ) : null}
      </>
    );
  }

  return null;
}
