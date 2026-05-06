// frontend/components/workouts/DeviceFileBlock.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${(v % 1 === 0 ? v : v.toFixed(1)
  )} ${units[i]}`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}
function firstDefined<T>(
  obj: Record<string, unknown> | null,
  keys: string[],
  map?: (v: unknown) => T
): T | null {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj && obj[k] != null) {
      return map ? map(obj[k]) : (obj[k] as T);
    }
  }
  return null;
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
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setErr(null);
      const res = await fetch(`/api/workouts/${workoutId}/files`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (canceled) return;

      if (!res.ok) {
        setErr(json?.error ?? `HTTP ${res.status}`);
        return;
      }

      setRow(json?.file ?? null);
    })();

    return () => {
      canceled = true;
    };
  }, [workoutId]);

  // Безопасно собираем отображаемые поля с кучей синонимов
  const fileName =
    firstDefined<string>(row, ["original_filename", "client_filename", "filename", "name", "file_name"]) ||
    (typeof row?.storage_path === "string" ? row.storage_path.split("/").pop() || null : null) ||
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
    const meta = isRecord(row.metadata) ? row.metadata : null;
    // пытаемся собрать из разных мест
    const vendor =
      firstDefined<string>(row, ["device_vendor", "device_brand"]) ||
      firstDefined<string>(meta, ["device_vendor", "brand"]);
    const model =
      firstDefined<string>(row, ["device_model", "device_product", "device_name"]) ||
      firstDefined<string>(meta, ["device_model", "model", "product"]);
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