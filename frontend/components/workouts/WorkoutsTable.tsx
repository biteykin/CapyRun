// components/workouts/WorkoutsTable.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";

// shadcn/ui
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Workout = {
  id: string;
  user_id?: string;
  name?: string | null;
  sport?: string | null;
  start_time?: string | null;   // ISO
  local_date?: string | null;   // 'YYYY-MM-DD'
  weekday_iso?: number | null;  // 1..7 (ISO)
  distance_m?: number | null;
  duration_sec?: number | null;
  calories_kcal?: number | null;
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сент","окт","ноя","дек"];
const WEEKDAY_RU_SHORT_ISO = ["","Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function weekdayIsoShort(n?: number | null) {
  return n ? (WEEKDAY_RU_SHORT_ISO[n] ?? "—") : "—";
}
function parsePreferredDate(row: Workout): Date | null {
  if (row.local_date) return new Date(`${row.local_date}T00:00:00`);
  if (row.start_time) return new Date(row.start_time);
  return null;
}
function fmtDateRu(row: Workout) {
  const d = parsePreferredDate(row);
  if (!d) return "—";
  const day = d.getDate();
  const mon = MONTHS_RU[d.getMonth()];
  const year = d.getFullYear();
  const now = new Date();
  const yearStr = year === now.getFullYear() ? String(year).slice(2) : String(year);
  return `${day} ${mon} ${yearStr}`;
}
function humanSport(s?: string | null) {
  const k = (s || "").toLowerCase();
  const map: Record<string, string> = {
    run: "Бег", ride: "Вело", swim: "Плавание", walk: "Ходьба", hike: "Хайк", row: "Гребля",
    strength: "Силовая", yoga: "Йога", aerobics: "Аэробика", crossfit: "Кроссфит", pilates: "Пилатес", other: "Другая",
  };
  return map[k] || "Другая";
}
function fmtKm(distance_m?: number | null) {
  if (distance_m == null) return "—";
  const km = distance_m / 1000;
  const decimals = km >= 100 ? 0 : km >= 10 ? 1 : 2;
  return `${km.toFixed(decimals).replace(".", ",")} км`;
}
function fmtDurationMinSec(duration_sec?: number | null) {
  if (duration_sec == null) return "—";
  const totalMin = Math.round(duration_sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function iconColor(s?: string | null) {
  const k = (s || "").toLowerCase();
  if (k === "run") return "#DF6133";
  if (k === "ride") return "#FFBA53";
  if (k === "swim") return "#4FA3FF";
  if (k === "walk") return "#16A34A";
  if (k === "hike") return "#0E7490";
  if (k === "row") return "#2563EB";
  if (k === "strength") return "#6B7280";
  if (k === "yoga") return "#10B981";
  if (k === "aerobics") return "#F59E0B";
  if (k === "crossfit") return "#9333EA";
  if (k === "pilates") return "#22D3EE";
  return "#B7B9AE";
}

const LS_KEY_PAGE_SIZE = "capyrun.workouts.pageSize.v2";
const PAGE_SIZES = [5, 10, 20, 50]; // финальный набор по ТЗ

export default function WorkoutsTable({
  initialRows = [],
  setTotalCount,
}: {
  initialRows?: Workout[];
  setTotalCount?: (n: number) => void;
} = {}) {
  const router = useRouter();

  // ── data
  const [rows, setRows] = React.useState<Workout[]>(initialRows);
  const [loading, setLoading] = React.useState(initialRows.length === 0);
  const [error, setError] = React.useState<string | null>(null);

  // список видов спорта → строим по данным
  const sports = React.useMemo(() => {
    const uniq = Array.from(new Set(rows.map(r => (r.sport || "").toLowerCase()).filter(Boolean)));
    uniq.sort((a, b) => humanSport(a).localeCompare(humanSport(b), "ru", { sensitivity: "base" }));
    return uniq;
  }, [rows]);

  // ── fetch on mount (only if no initialRows)
  React.useEffect(() => {
    if (initialRows.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error, status } = await supabase.rpc("list_dashboard", {
          limit_files: 0,
          limit_workouts: 200,
        });

        if (error) {
          console.warn("RPC list_dashboard failed", { status, error });
          throw error;
        }

        const arr = (Array.isArray(data?.workouts) ? data?.workouts : []) as Workout[];
        if (!cancelled) {
          setRows(arr);
          setTotalCount?.(arr.length);
        }
      } catch {
        try {
          const { data: rows2, error: err2 } = await supabase
            .from("workouts")
            .select(
              "id,start_time,local_date,uploaded_at,sport,sub_sport,duration_sec,distance_m,avg_hr,calories_kcal,name,visibility,weekday_iso"
            )
            .order("start_time", { ascending: false })
            .limit(200);

          if (err2) throw err2;
          if (!cancelled) {
            setRows((rows2 ?? []) as Workout[]);
            setTotalCount?.((rows2 ?? []).length);
          }
        } catch (e: any) {
          if (!cancelled) setError(e?.message || "Не удалось загрузить тренировки");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setTotalCount, initialRows.length]);

  // ── table state (tanstack)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "start_time", desc: true }]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  // фильтр по виду спорта
  const [sportFilter, setSportFilter] = React.useState<string>("all");
  // Фиксированные стартовые 5 — так SSR == 1-й клиентский рендер (без гидрации)
  const [pageSize, setPageSize] = React.useState<number>(5);
  // явное состояние пагинации
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  // синхронизация pageSize в state таблицы
  React.useEffect(() => { setPagination((p) => ({ ...p, pageSize })); }, [pageSize]);

  // после монтирования применяем сохранённый размер из localStorage (без гидрации)
  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY_PAGE_SIZE) : null;
      const saved = raw ? parseInt(raw, 10) : NaN;
      if (PAGE_SIZES.includes(saved) && saved !== pageSize) {
        setPageSize(saved);
        setPagination({ pageIndex: 0, pageSize: saved });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // сохраняем выбор пользователя
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(LS_KEY_PAGE_SIZE, String(pageSize));
    } catch {}
  }, [pageSize]);

  // колбэк для удаления строки (используется в RowActions)
  const handleDeleted = React.useCallback((id: string) => {
    setRows(prev => {
      const next = prev.filter(r => r.id !== id);
      setTotalCount?.(next.length);
      return next;
    });
  }, [setTotalCount]);

  const columns = React.useMemo<ColumnDef<Workout>[]>(() => [
    {
      accessorKey: "name",
      header: () => <span>Название</span>,
      cell: ({ row }) => <div className="font-medium">{row.original.name || "—"}</div>,
      enableSorting: false,
    },
    {
      id: "start_time",
      accessorFn: row => row.start_time ?? row.local_date ?? "",
      header: ({ column }) => <SortHeader column={column} label="Дата" />,
      cell: ({ row }) => fmtDateRu(row.original),
    },
    {
      id: "weekday",
      accessorFn: row => row.weekday_iso ?? null,
      header: () => <span>День недели</span>,
      cell: ({ row }) => <span className="text-[var(--text-secondary)]">{weekdayIsoShort(row.original.weekday_iso)}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "sport",
      header: ({ column }) => <SortHeader column={column} label="Тип" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: iconColor(row.original.sport) }} />
          <span className="font-medium">{humanSport(row.original.sport)}</span>
        </div>
      ),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "distance_m",
      header: ({ column }) => <SortHeader column={column} label="Расстояние" />,
      cell: ({ row }) => fmtKm(row.original.distance_m),
      sortingFn: "basic",
    },
    {
      accessorKey: "duration_sec",
      header: ({ column }) => <SortHeader column={column} label="Время" />,
      cell: ({ row }) => fmtDurationMinSec(row.original.duration_sec),
      sortingFn: "basic",
    },
    {
      accessorKey: "calories_kcal",
      header: ({ column }) => (
        <div className="text-right">
          <SortHeader column={column} label="Ккал" alignRight />
        </div>
      ),
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.calories_kcal ?? "—"}</div>,
      sortingFn: "basic",
    },
    {
      id: "actions",
      header: () => <span>Действия</span>,
      cell: ({ row }) => (
        <RowActions
          workoutId={row.original.id}
          name={row.original.name ?? undefined}
          onOpen={() => router.push(`/workouts/${row.original.id}`)}
          onEdit={() => router.push(`/workouts/${row.original.id}/edit`)}
          onDeleted={handleDeleted}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ], [router, handleDeleted]);

  // данные для таблицы с учётом фильтра вида спорта
  const dataForTable = React.useMemo(() => {
    if (sportFilter === "all" || !sportFilter) return rows;
    return rows.filter((r) => (r.sport || "").toLowerCase() === sportFilter.toLowerCase());
  }, [rows, sportFilter]);
  const filteredCount = dataForTable.length;

  const table = useReactTable({
    data: dataForTable,
    columns,
    state: { sorting, columnVisibility, pagination },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id, // стабильный ключ строки
    autoResetPageIndex: true,  // при изменении данных возвращаемся на первую страницу
    initialState: {
      sorting: [{ id: "start_time", desc: true }],
    },
  });

  // ── helper: список видимых страниц с «…»
  function visiblePages(pageIndex: number, pageCount: number): Array<number | "…"> {
    const p = pageIndex + 1; // 1-based
    const last = pageCount;
    const pages: Array<number | "…"> = [];
    if (last <= 7) {
      for (let i = 1; i <= last; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (p > 4) pages.push("…");
    const start = Math.max(2, p - 1);
    const end = Math.min(last - 1, p + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (p < last - 3) pages.push("…");
    pages.push(last);
    return pages;
  }

  if (loading) {
    return (
      <section className="card">
        <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем…</div>
      </section>
    );
  }
  if (!loading && rows.length === 0) {
    return (
      <section className="card">
        <div className="p-6 text-sm text-[var(--text-secondary)]">Пока нет тренировок. Добавь первую.</div>
      </section>
    );
  }

  return (
    <>
      <section className="card overflow-visible">
        {/* header controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          {/* Левый верхний угол: счётчик тренировок (учитывает фильтр) */}
          <div className="text-sm text-[var(--text-secondary)]">Тренировок: {filteredCount}</div>

          {/* Правый верхний угол: Вид спорта (слева) + На странице (справа) */}
          <div className="flex items-center gap-3">
            {/* Вид спорта */}
            <div className="flex items-center gap-2">
              <span className="text-sm">Вид спорта</span>
              <Select
                value={sportFilter}
                onValueChange={(v) => {
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  setSportFilter(v);
                }}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value="all">Все</SelectItem>
                  {sports.map((s) => (
                    <SelectItem key={s} value={s}>
                      {humanSport(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* На странице */}
            <div className="flex items-center gap-2">
              <span className="text-sm">На странице</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => {
                  const n = parseInt(v, 10);
                  setPageSize(n);
                  setPagination({ pageIndex: 0, pageSize: n });
                }}
              >
                <SelectTrigger className="h-9 w-[80px]">
                  <SelectValue placeholder={pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-bg-fill-tertiary)]">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="text-left">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-4 py-3 font-medium select-none">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="group hover:bg-[var(--color-bg-fill-tertiary)]/60 hover:cursor-pointer"
                  onClick={() => router.push(`/workouts/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {/* пустое состояние, если действительно нет данных после фильтра */}
              {table.getRowModel().rows.length === 0 && dataForTable.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-[var(--text-secondary)]" colSpan={columns.length}>
                    Ничего не найдено{sportFilter !== "all" ? " для выбранного вида спорта" : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pager — снизу только номера и Назад/Вперёд */}
        <Pagination className="border-t border-[var(--border)] px-4 py-3">
          <PaginationContent className="w-full items-center justify-between gap-3">
            {/* numeric page buttons */}
            <PaginationItem>
              <div className="flex items-center gap-1">
                {visiblePages(pagination.pageIndex, table.getPageCount() || 1).map((it, idx) =>
                  it === "…" ? (
                    <PaginationEllipsis key={`e${idx}`} />
                  ) : (
                    <button
                      key={it}
                      type="button"
                      className={
                        "btn btn-ghost h-9 w-9 px-0 tabular-nums " +
                        (it === pagination.pageIndex + 1
                          ? "border border-[var(--border)] bg-[var(--color-bg-fill-tertiary)]"
                          : "")
                      }
                      aria-current={it === pagination.pageIndex + 1 ? "page" : undefined}
                      onClick={() => table.setPageIndex(it - 1)}
                    >
                      {it}
                    </button>
                  )
                )}
              </div>
            </PaginationItem>

            {/* Right: Prev/Next — PostHog-стиль */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost h-9"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Назад
              </button>
              <button
                type="button"
                className="btn btn-ghost h-9"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Вперёд
              </button>
            </div>
          </PaginationContent>
        </Pagination>

        {error && (
          <div className="m-4 alert alert-error">
            <span className="alert-icon">⚠️</span>
            <div>{error}</div>
          </div>
        )}
      </section>
    </>
  );
}

/** Заголовок-сплиттер с сортировкой (в духе shadcn data-table) */
function SortHeader({ column, label, alignRight }: { column: any; label: string; alignRight?: boolean }) {
  const isSorted = column.getIsSorted(); // 'asc' | 'desc' | false
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(isSorted === "asc")}
      className={`inline-flex items-center gap-1 hover:underline whitespace-nowrap ${alignRight ? "justify-end w-full" : ""}`}
    >
      <span>{label}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path
          d={isSorted === "asc" ? "M2 6 L5 3 L8 6" : isSorted === "desc" ? "M2 4 L5 7 L8 4" : "M2 4 L5 7 L8 4"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity={isSorted ? 1 : 0.4}
        />
      </svg>
    </button>
  );
}

/** Row actions (shadcn: dropdown + alert-dialog) — с гардом от гидрации */
function RowActions({
  workoutId,
  name,
  onOpen,
  onEdit,
  onDeleted,
}: {
  workoutId: string;
  name?: string;
  onOpen: () => void;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const doDelete = async () => {
    try {
      setDeleting(true);
      const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
      if (error) throw error;
      onDeleted(workoutId);
      setConfirmOpen(false);
    } catch (e: any) {
      alert(e?.message || "Не удалось удалить тренировку");
    } finally {
      setDeleting(false);
    }
  };

  if (!mounted) {
    return (
      <span suppressHydrationWarning>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label="Действия"
          onClick={(e)=>e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </span>
    );
  }

  return (
    <span suppressHydrationWarning>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Действия"
          >
            <span className="sr-only">Открыть меню</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel>Действия</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => { setMenuOpen(false); onOpen(); }}>
            <Eye className="mr-2 h-4 w-4" /> Открыть
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setMenuOpen(false); onEdit(); }}>
            <Pencil className="mr-2 h-4 w-4" /> Редактировать
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Тренировка{ name ? ` «${name}»` : "" } будет удалена из CapyRun.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleting}
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}