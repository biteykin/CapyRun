"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  disabled?: boolean;
};

export default function StravaDisconnectButton({ disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function disconnect() {
    if (loading || disabled) return;
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/strava/disconnect", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setErr(json?.detail || json?.reason || "Не удалось отключить Strava.");
        return;
      }
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось отключить Strava.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={disconnect} disabled={disabled || loading}>
        {loading ? "Отключение…" : "Отключить Strava"}
      </Button>
      {err && <div className="text-sm text-destructive">{err}</div>}
    </div>
  );
}
