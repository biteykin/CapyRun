// app/(protected)/workouts/upload/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

// shadcn/ui
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// icons
import { Loader2, RefreshCw, UploadCloud, MoreHorizontal, ExternalLink, Trash2 } from "lucide-react";

// analytics (optional)
import PHTrack from "@/components/analytics/PHTrack";
import posthog from "posthog-js";

type FileRow = {
  id: string;
  user_id?: string | null;
  workout_id?: string | null;
  filename: string | null;
  status?: string | null;          // ⬅️ предполагаем, что есть колонка status
  created_at: string;
};

export default function WorkoutUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [sortBy, setSortBy] = useState<"filename" | "status" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // analytics
  useEffect(() => {
    posthog.capture("workout_upload_page_viewed");
  }, []);

  // auth + initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user ?? null;

      if (!u) {
        const hasLegacy = typeof document !== "undefined" && document.cookie.includes("capyrun.auth=");
        if (hasLegacy) {
          window.location.href = `/api/auth/upgrade?returnTo=${encodeURIComponent("/workouts/upload")}`;
          return;
        }
        router.replace("/signin");
        return;
      }

      setUserId(u.id);
      const { data, error, status } = await supabase
        .from("workout_files")
        .select("id,user_id,workout_id,filename,status,created_at")
        .eq("user_id", u.id) // показываем ТОЛЬКО свои файлы
        .order("created_at", { ascending: false })
        .limit(500);

      if (!cancelled) {
        if (error) {
          console.error("workout_files list error:", {
            status,
            code: (error as any)?.code,
            message: (error as any)?.message,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
          });
          setRows([]);
        } else {
          setRows((data || []) as FileRow[]);
        }
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!userId) return;
    setReloading(true);
    const { data, error, status } = await supabase
      .from("workout_files")
      .select("id,user_id,workout_id,filename,status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("workout_files refresh error:", {
        status,
        code: (error as any)?.code,
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      });
    }
    setRows((data || []) as FileRow[]);
    setReloading(false);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // TODO: вставь сюда свою логику загрузки файлов (.fit, .fit.gz, .gpx, .tcx, .zip)
    // Например: вызов Edge Function или загрузка в Storage + insert в public.workout_files
    // После завершения не забудь:
    await refresh();
    // и очистить input (чтобы можно было выбрать те же файлы повторно)
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeRow(id: string) {
    if (!confirm("Удалить запись о файле? (Файл в сторидже может остаться)")) return;
    const { error } = await supabase.from("workout_files").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  }

  // ===== Рендер статуса бейджем с цветной точкой =====
  function StatusBadge({ status }: { status?: string | null }) {
    const s = (status || "pending").toLowerCase();
    const map: Record<string, { label: string; dot: string; variant?: "secondary" | "default" | "outline" }> = {
      pending:    { label: "В ожидании", dot: "bg-muted-foreground", variant: "secondary" },
      uploading:  { label: "Загрузка",   dot: "bg-blue-500",          variant: "secondary" },
      uploaded:   { label: "Загружен",   dot: "bg-indigo-500",        variant: "secondary" },
      processing: { label: "Обработка",  dot: "bg-amber-500",         variant: "secondary" },
      ready:      { label: "Готово",     dot: "bg-green-500",         variant: "default"   },
      error:      { label: "Ошибка",     dot: "bg-red-500",           variant: "outline"   },
      archived:   { label: "Архив",      dot: "bg-slate-500",         variant: "secondary" },
    };
    const m = map[s] || map["pending"];
    // небольшая локальная "пилюля", чтобы не тащить Badge, делаем аккуратный бейдж сами
    return (
      <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${m.variant === "default" ? "bg-primary text-primary-foreground border-transparent" : m.variant === "outline" ? "bg-transparent" : "bg-secondary text-secondary-foreground"} `}>
        <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
        {m.label}
      </span>
    );
  }

  // ===== Сортировка =====
  const statusRank = (s?: string | null) => {
    const order: Record<string, number> = {
      pending: 0, uploading: 1, uploaded: 2, processing: 3, ready: 4, error: 5, archived: 6,
    };
    return order[(s || "pending").toLowerCase()] ?? 0;
  };
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "filename") {
        const A = (a.filename || "").toLowerCase();
        const B = (b.filename || "").toLowerCase();
        cmp = A.localeCompare(B, "ru");
      } else if (sortBy === "status") {
        cmp = statusRank(a.status) - statusRank(b.status);
      } else {
        // created_at
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortBy, sortDir]);

  function toggleSort(col: "filename" | "status" | "created_at") {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "created_at" ? "desc" : "asc"); // по умолчанию: дата ↓, остальное ↑
    }
  }

  return (
    <main className="space-y-6">
      <PHTrack event="workout_upload_viewed" />

      <Card className="overflow-hidden">
        <CardHeader className="sm:flex sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Файлы тренировок
            </CardTitle>
            <CardDescription className="max-w-3xl">
              Здесь вы можете загрузить файлы с ваших тренировок. Поддерживаются форматы:
              <strong> .fit</strong>, <strong>.fit.gz</strong>, <strong>.gpx</strong>, <strong>.tcx</strong>, а также <strong>.zip</strong> с этими файлами внутри.
              Мы распакуем архивы и обработаем данные; если найдём соответствующую тренировку — привяжем её к записи.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".fit,.fit.gz,.gpx,.tcx,.zip"
              className="hidden"
              onChange={handleSelectFiles}
            />
            <Button onClick={openFilePicker}>
              <UploadCloud className="mr-2 size-4" />
              Загрузить файл
            </Button>
            <Button variant="outline" onClick={refresh} disabled={reloading}>
              {reloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Обновить
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Счётчик */}
          <div className="text-sm text-muted-foreground">Файлов: <span className="font-medium">{rows.length}</span></div>

          {/* Таблица (одна) */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Загружаем список…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Записей пока нет — загрузите файл, чтобы начать.</div>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[46%]">
                      <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort("filename")}>
                        Файл {sortBy === "filename" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="w-[18%]">
                      <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort("status")}>
                        Статус {sortBy === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="w-[24%]">
                      <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort("created_at")}>
                        Дата загрузки {sortBy === "created_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="w-[12%] text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="py-3">
                        <div className="font-medium">{r.filename || "без имени"}</div>
                      </TableCell>

                      <TableCell className="py-3">
                        <StatusBadge status={r.status} />
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="text-sm">
                          {new Date(r.created_at).toLocaleString(undefined, {
                            year: "numeric", month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Действия по файлу">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            {r.workout_id && (
                              <DropdownMenuItem onClick={() => router.push(`/workouts/${r.workout_id}`)}>
                                <ExternalLink className="mr-2 size-4" />
                                Открыть тренировку
                              </DropdownMenuItem>
                            )}
                            {r.workout_id && <DropdownMenuSeparator />}
                            <DropdownMenuItem className="text-destructive" onClick={() => removeRow(r.id)}>
                              <Trash2 className="mr-2 size-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}