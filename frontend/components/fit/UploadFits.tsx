"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import posthog from "posthog-js";

type Obj = {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: { size?: number };
};

export default function UploadFits() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Obj[]>([]);
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
    const { data, error } = await supabase.storage
      .from("fits")
      .list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) setError(error.message);
    setItems(data ?? []);
  }

  function safeName(name: string) {
    return name.replace(/[^\w.\-]+/g, "_");
  }
  function fmtBytes(b?: number) {
    if (!b && b !== 0) return "—";
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }
  function fmtDate(s?: string) {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString();
  }

  async function handleFiles(fileList: FileList) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".fit"));
    if (files.length === 0) {
      setError("Выберите файлы с расширением .fit");
      setBusy(false);
      return;
    }
    posthog.capture("fit_upload_started", { count: files.length });

    try {
      for (const f of files) {
        const path = `${userId}/${Date.now()}_${safeName(f.name)}`;
        const { error } = await supabase.storage
          .from("fits")
          .upload(path, f, {
            upsert: false,
            cacheControl: "3600",
            contentType: "application/octet-stream",
          });
        if (error) throw error;
      }
      posthog.capture("fit_upload_succeeded", { count: files.length });
      await refresh(userId);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка загрузки");
      posthog.capture("fit_upload_failed", { message: String(e?.message || "") });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(name: string) {
    if (!userId) return;
    if (!confirm("Удалить файл?")) return;
    const full = `${userId}/${name}`;
    const { error } = await supabase.storage.from("fits").remove([full]);
    if (error) {
      setError(error.message);
      return;
    }
    setItems(prev => prev.filter(it => it.name !== name));
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
            Перетащи сюда файлы <code>.fit</code> или выбери вручную
          </div>
          <div className="flex gap-3">
            <label className="btn btn-primary">
              Выбрать .fit
              <input
                ref={inputRef}
                type="file"
                accept=".fit"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
            <button className="btn btn-ghost" onClick={() => refresh(userId!)} disabled={!userId || busy}>
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
          <div className="h-display font-semibold">Загруженные .fit</div>
          <div className="text-sm text-[var(--text-secondary)]">{items.length} файл(ов)</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем список…</div>
        ) : empty ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Пока пусто — загрузи первый .fit</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.name} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{it.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {fmtDate(it.updated_at || it.created_at)} · {fmtBytes(it.metadata?.size)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* на будущее можно сделать "Скачать" через signedUrl */}
                  <button className="btn btn-ghost" onClick={() => remove(it.name)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
