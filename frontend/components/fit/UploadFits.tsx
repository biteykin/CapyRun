"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import posthog from "posthog-js";
// ⚠️ относительный импорт исключает проблемы алиаса `@` в сборках Sentry/CI
import { uploadWorkoutFile } from "../../lib/uploadWorkoutFile";

type Wf = {
  id: string;
  filename: string | null;
  storage_bucket: string;
  storage_path: string;
  size_bytes: number | null;
  status: string | null; // pending | uploading | uploaded | processing | ready | error | archived
  uploaded_at: string | null;
  processed_at: string | null;
  error_message: string | null;
  kind: string | null;
  content_type: string | null;
  workout_id: string | null;
};

export default function UploadFits() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Wf[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) await refresh(uid);
      setLoading(false);
    })();
  }, []);

  async function refresh(uid: string) {
    setError(null);
    const { data, error } = await supabase
      .from("workout_files")
      .select(
        "id, filename, storage_bucket, storage_path, size_bytes, status, uploaded_at, processed_at, error_message, kind, content_type, workout_id"
      )
      .eq("user_id", uid)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(200);

    if (error) setError(error.message);
    setItems((data as Wf[]) ?? []);
  }

  function fmtBytes(b?: number | null) {
    if (b === undefined || b === null) return "—";
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }
  function fmtDate(s?: string | null) {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString();
  }

  async function handleFiles(fileList: FileList) {
    if (!userId) {
      setError("Нет сессии. Попробуй перелогиниться.");
      return;
    }

    setBusy(true);
    setError(null);

    const files = Array.from(fileList);
    if (files.length === 0) {
      setError("Файлы не выбраны");
      setBusy(false);
      return;
    }

    posthog.capture("fit_upload_started", { count: files.length });

    let ok = 0,
      dup = 0,
      failed = 0;

    try {
      for (const f of files) {
        const res = await uploadWorkoutFile(f, { bucket: "fits" });
        if (!res.ok) {
          failed++;
          const msg = (res as any).error || "Ошибка загрузки";
          setError(msg);
          console.error("upload error:", msg);
          continue;
        }
        if (res.duplicate) dup++;
        else ok++;
      }
      posthog.capture("fit_upload_succeeded", { ok, dup, failed });
      await refresh(userId);
    } catch (e: any) {
      failed++;
      const msg = e?.message ?? "Ошибка загрузки";
      setError(msg);
      posthog.capture("fit_upload_failed", { message: String(msg) });
      console.error("upload exception:", e);
    } finally {
      setBusy(false);
      try {
        if (inputRef.current) inputRef.current.value = "";
      } catch {}
    }
  }

  async function remove(row: Wf) {
    if (!userId) return;
    if (!confirm("Удалить файл?")) return;

    // 1) remove from Storage (best-effort)
    const _storage = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
    if (_storage.error) {
      console.warn("storage.remove error:", _storage.error.message);
    }

    // 2) soft-delete DB row
    const { error } = await supabase
      .from("workout_files")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", row.id);

    if (error) {
      setError(error.message);
      return;
    }

    setItems((prev) => prev.filter((it) => it.id !== row.id));
  }

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  return (
    <section className="space-y-6">
      <div
        className="card p-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-sm text-[var(--text-secondary)]">
            Перетащи сюда файлы <code>.fit</code> (поддерживаются также .gpx, .tcx, .zip) или выбери вручную
          </div>
          <div className="flex gap-3">
            <label className={`btn btn-primary ${!userId || busy ? "pointer-events-none opacity-50" : ""}`} aria-disabled={!userId || busy}>
              Выбрать файл(ы)
              <input
                ref={inputRef}
                type="file"
                accept=".fit,.gpx,.tcx,.zip,application/octet-stream,application/gpx+xml,application/vnd.garmin.tcx+xml,application/zip"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                disabled={!userId || busy}
              />
            </label>
            <button className="btn btn-ghost" onClick={() => userId && refresh(userId)} disabled={!userId || busy}>
              Обновить список
            </button>
          </div>
          {busy && <div className="text-sm">Загружаем…</div>}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="h-display font-semibold">Загруженные файлы</div>
          <div className="text-sm text-[var(--text-secondary)]">{items.length} файл(ов)</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем список…</div>
        ) : empty ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Пока пусто — загрузи первый .fit</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => {
              const displayName = it.filename || it.storage_path.split("/").pop() || it.storage_path;
              return (
                <li key={it.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{displayName}</div>
                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-2">
                      <span>{fmtDate(it.uploaded_at || it.processed_at || undefined)}</span>
                      <span>·</span>
                      <span>{fmtBytes(it.size_bytes ?? undefined)}</span>
                      {it.status && (
                        <>
                          <span>·</span>
                          <span className="rounded-full border px-2 py-[2px]">{it.status}</span>
                        </>
                      )}
                      {it.error_message && (
                        <>
                          <span>·</span>
                          <span className="text-red-600">{it.error_message}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost" onClick={() => remove(it)}>
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}