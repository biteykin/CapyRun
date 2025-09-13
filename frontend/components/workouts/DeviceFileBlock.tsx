"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

/* ---------- helpers ---------- */
function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${(v % 1 === 0 ? v : v.toFixed(1))} ${units[i]}`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}
function firstDefined<T = any>(obj: Record<string, any> | null, keys: string[], map?: (v: any) => T): T | null {
  if (!obj) return null as any;
  for (const k of keys) {
    if (k in obj && obj[k] != null) {
      return map ? map(obj[k]) : (obj[k] as T);
    }
  }
  return null as any;
}
function extFromContentType(ct?: string | null) {
  if (!ct) return null;
  const m: Record<string, string> = {
    "application/zip": "ZIP",
    "application/gzip": "GZ",
    "application/octet-stream": "",
    "text/xml": "TCX",
    "application/xml": "XML",
    "application/json": "JSON",
  };
  return m[ct] ?? null;
}
function extFromFilename(name?: string | null) {
  if (!name) return null;
  const m = name.split(".").pop();
  return m ? m.toUpperCase() : null;
}

/* ---------- component ---------- */
export default function DeviceFileBlock({ workoutId }: { workoutId: string }) {
  const [row, setRow] = useState<Record<string, any> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setErr(null);
      // ⚠️ Берём все поля, чтобы не падать на несуществующих колонках
      const { data, error } = await supabase
        .from("workout_files")
        .select("*")
        .eq("workout_id", workoutId)
        .limit(5);

      if (canceled) return;

      if (error) {
        setErr(error.message);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      // Сортируем по лучшему доступному временному полю
      rows.sort((a: any, b: any) => {
        const ad = new Date(
          a?.uploaded_at || a?.created_at || a?.inserted_at || 0
        ).getTime();
        const bd = new Date(
          b?.uploaded_at || b?.created_at || b?.inserted_at || 0
        ).getTime();
        return bd - ad;
      });

      setRow(rows[0] ?? null);
    })();

    return () => {
      canceled = true;
    };
  }, [workoutId]);

  // Безопасно собираем отображаемые поля с кучей синонимов
  const fileName =
    firstDefined<string>(row, ["original_filename", "client_filename", "filename", "name", "file_name"]) ||
    (row?.storage_path ? String(row.storage_path).split("/").pop() || null : null) ||
    "—";

  const format =
    firstDefined<string>(row, ["format", "ext", "file_ext"]) ||
    extFromFilename(fileName) ||
    extFromContentType(firstDefined<string>(row, ["content_type", "mimetype"])) ||
    "—";

  const size =
    firstDefined<number>(row, ["size_bytes", "size", "bytes", "content_length"]) ?? null;

  const uploadedRaw =
    firstDefined<string>(row, ["uploaded_at", "created_at", "inserted_at"]) ?? null;

  const source =
    firstDefined<string>(row, ["source", "origin"]) || "upload";

  const device = useMemo(() => {
    if (!row) return "—";
    // пытаемся собрать из разных мест
    const vendor =
      firstDefined<string>(row, ["device_vendor", "device_brand"]) ||
      firstDefined<string>(row?.metadata ?? {}, ["device_vendor", "brand"]);
    const model =
      firstDefined<string>(row, ["device_model", "device_product", "device_name"]) ||
      firstDefined<string>(row?.metadata ?? {}, ["device_model", "model", "product"]);
    const parts = [vendor, model].filter(Boolean) as string[];
    return parts.length ? parts.join(" ") : "—";
  }, [row]);

  return (
    <section className="card p-4">
      <div className="mb-2 font-medium">Устройство и файл</div>
      {err && <div className="text-sm text-red-600">Ошибка: {err}</div>}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Устройство</dt>
          <dd>{device ?? "—"}</dd>
        </div>

        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Файл</dt>
          <dd>{fileName ?? "—"}</dd>
        </div>

        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Формат</dt>
          <dd>{format ?? "—"}</dd>
        </div>

        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Размер</dt>
          <dd>{formatBytes(size)}</dd>
        </div>

        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Загружен</dt>
          <dd>{fmtDate(uploadedRaw)}</dd>
        </div>

        <div className="flex flex-col">
          <dt className="text-[var(--text-secondary)]">Источник</dt>
          <dd>{source}</dd>
        </div>
      </dl>
    </section>
  );
}