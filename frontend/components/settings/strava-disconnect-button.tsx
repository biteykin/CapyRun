"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import { Unplug } from "lucide-react";

type Props = {
  disabled?: boolean;
};

export default function StravaDisconnectButton({ disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

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
      setConfirmOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось отключить Strava.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || loading}
      >
        <Unplug className="mr-2 size-4" />
        {loading ? "Отключение…" : "Отключить Strava"}
      </Button>
      {err && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Отключить Strava?"
        description="CapyRun перестанет импортировать новые тренировки из Strava, пока вы не подключите аккаунт заново."
        confirmLabel={loading ? "Отключаем…" : "Отключить"}
        cancelLabel="Отмена"
        confirmVariant="danger"
        isLoading={loading}
        onConfirm={disconnect}
        contentClassName="max-w-md"
      />
    </div>
  );
}
