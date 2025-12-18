"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Props = {
  disabled?: boolean;
  autoStart?: boolean;
};

export default function StravaSyncButton({ disabled, autoStart }: Props) {
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
        setErr(json?.detail || json?.reason || "Ошибка синхронизации");
        return;
      }

      const added = Number(json?.added ?? 0);
      const updated = Number(json?.updated ?? 0);
      setResult({ added, updated });

      // чтобы серверная страница (SettingsPage) перечитала last_synced_at и т.п.
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка синхронизации");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, router]);

  // автостарт после callback
  React.useEffect(() => {
    if (!autoStart) return;
    if (disabled) return;
    // запускаем один раз
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="space-y-2">
      <Button type="button" onClick={run} disabled={disabled || loading}>
        {loading ? "Синхронизация…" : "Синхронизировать"}
      </Button>

      {result && (
        <div className="text-sm text-muted-foreground">
          Добавлено: <span className="font-medium">{result.added}</span>, обновлено:{" "}
          <span className="font-medium">{result.updated}</span>
        </div>
      )}

      {err && <div className="text-sm text-destructive">{err}</div>}
    </div>
  );
}