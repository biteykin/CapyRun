"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { createPortal } from "react-dom";
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // removed, not needed

type Workout = {
  id: string;
  user_id?: string;
  name?: string | null;
  sport?: string | null;          // run | ride | swim | walk | hike | row | other | strength | yoga | aerobics | crossfit | pilates
  start_time?: string | null;     // ISO
  local_date?: string | null;     // 'YYYY-MM-DD'
  weekday_iso?: number | null;    // 1..7 (ISO: 1=Пн … 7=Вс)
  distance_m?: number | null;
  duration_sec?: number | null;
  calories_kcal?: number | null;
};

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сент","окт","ноя","дек"];
const WD_RU = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"]; // getDay(): 0=Вс

// ISO 1..7 → короткие названия (экономим ширину колонки)
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
function weekdayRu(row: Workout) {
  const d = parsePreferredDate(row);
  if (!d) return "—";
  return WD_RU[d.getDay()];
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
function asNum(v: any) { return typeof v === "number" ? v : (v ? Number(v) : null); }
function humanSport(s?: string | null) {
  const k = (s || "").toLowerCase();
  const map: Record<string, string> = {
    run: "Бег", ride: "Вело", swim: "Плавание", walk: "Ходьба", hike: "Хайк", row: "Гребля",
    strength: "Силовая", yoga: "Йога", aerobics: "Аэробика", crossfit: "Кроссфит", pilates: "Пилатес", other: "Другая",
  };
  return map[k] || "Другая";
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

const PAGE_SIZES = [5, 10, 20, 50];
const LS_KEY_PAGE_SIZE = "capyrun.workouts.pageSize";

export default function WorkoutsTable({ setTotalCount }: { setTotalCount?: (n: number) => void } = {}) {
  const router = useRouter();

  // data
  // const [userId, setUserId] = useState<string | null>(null); // not needed for new effect
  const [rows, setRows] = useState<Workout[]>([]);
  const [count, setCount] = useState<number>(0);

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // paging/sorting/filtering
  // --- REWRITE: use pageIndex (0-based) instead of page (1-based) ---
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    try {
      const raw = localStorage.getItem(LS_KEY_PAGE_SIZE);
      const v = raw ? parseInt(raw, 10) : NaN;
      return PAGE_SIZES.includes(v) ? v : 5;
    } catch {
      return 5;
    }
  });
  const [sortBy, setSortBy] = useState<"date"|"sport"|"distance"|"duration"|"kcal">("date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const SORT_MAP: Record<typeof sortBy, string> = {
    date: "start_time",
    sport: "sport",
    distance: "distance_m",
    duration: "duration_sec",
    kcal: "calories_kcal",
  };
  function toggleSort(col: typeof sortBy) {
    setPageIndex(0);
    setSortBy(col);
    setSortDir(prev => (sortBy === col ? (prev === "asc" ? "desc" : "asc") : "desc"));
  }

  // sports filter
  const [sports, setSports] = useState<string[]>([]);
  const [sportFilter, setSportFilter] = useState<"all" | string>("all");

  // request race guard
  const rqRef = useRef(0);

  // first mount: fetch workouts via RPC (with fallback)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Пробуем public.list_dashboard RPC (без getUser, RLS ограничит строки)
        const { data, error, status } = await supabase.rpc("list_dashboard", {
          limit_files: 0,
          limit_workouts: 200,
        });

        if (error) {
          console.warn("RPC list_dashboard failed", { status, error });
          throw error;
        }

        const rows = (Array.isArray(data?.workouts) ? data?.workouts : []) as any[];
        if (!cancelled) {
          setRows(rows);
          setTotalCount?.(rows.length); // после setRows(rows);
        }
      } catch {
        // 2) Фолбэк на прямой select (лёгкие поля и без getUser)
        try {
          const { data: rows2, error: err2 } = await supabase
            .from("workouts")
            .select(
              "id,start_time,local_date,uploaded_at,sport,sub_sport,duration_sec,distance_m,avg_hr,name,visibility,weekday_iso"
            )
            .order("start_time", { ascending: false })
            .limit(200);

          if (err2) throw err2;
          if (!cancelled) {
            setRows((rows2 ?? []) as any[]);
            setTotalCount?.((rows2 ?? []).length); // …и в фолбэке после rows2 — тоже setTotalCount?.(rows2.length)
          }
        } catch (e2: any) {
          if (!cancelled) setError(e2?.message || "Не удалось загрузить тренировки");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setTotalCount]);

  // сохраняем выбор pageSize в localStorage при изменении
  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(LS_KEY_PAGE_SIZE, String(pageSize));
    } catch {}
  }, [pageSize]);

  // --- REWRITE: pagination logic with pageIndex ---
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (pageIndex > totalPages - 1) setPageIndex(Math.max(0, totalPages - 1)); }, [totalPages, pageIndex]);
  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  // Calculate visibleRows for current page
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const visibleRows = useMemo(() => rows.slice(start, end), [rows, start, end, pageSize]);

  // delete modal
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  function askDelete(id: string) { setPendingDeleteId(id); }
  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const { error } = await supabase.from("workouts").delete().eq("id", pendingDeleteId);
    if (error) { alert(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== pendingDeleteId));
    setCount(x => Math.max(0, x - 1));
    setPendingDeleteId(null);
  }

  return (
    <>
      <section className="card overflow-visible">
        {/* header controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm text-[var(--text-secondary)]">Тренировок: {rows.length}</div>

          <div className="flex items-center gap-3">
            {/* sport filter */}
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm">Вид спорта:</span>
              <select
                className="input h-9 w-44"
                value={sportFilter}
                onChange={(e) => { setPageIndex(0); setSportFilter(e.target.value as any); }}
              >
                <option value="all">Все</option>
                {sports.map(s => <option key={s} value={s}>{humanSport(s)}</option>)}
              </select>
            </div>

            {/* page size */}
            <div className="flex items-center gap-2">
              <span className="text-sm">Показывать:</span>
              <select
                className="input h-9 w-28"
                value={pageSize}
                onChange={(e)=>{ setPageIndex(0); setPageSize(parseInt(e.target.value,10)); }}
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* table */}
        {loading ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Загружаем…</div>
        ) : empty ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Пока нет тренировок. Добавь первую.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-bg-fill-tertiary)]">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Название</th>
                  <th className="px-4 py-3 font-medium"><SortHead label="Дата" col="date" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></th>
                  <th className="px-4 py-3 font-medium">День недели</th>
                  <th className="px-4 py-3 font-medium"><SortHead label="Тип" col="sport" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></th>
                  <th className="px-4 py-3 font-medium"><SortHead label="Расстояние" col="distance" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></th>
                  <th className="px-4 py-3 font-medium"><SortHead label="Время" col="duration" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></th>
                  <th className="px-4 py-3 font-medium"><SortHead label="Ккал" col="kcal" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} /></th>
                  <th className="px-4 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.map((r) => (
                  <tr
                    key={r.id}
                    className="group hover:bg-[var(--color-bg-fill-tertiary)]/60 hover:cursor-pointer hover:[&>td]:cursor-pointer"
                    onClick={() => router.push(`/workouts/${r.id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium">{r.name || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateRu(r)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--text-secondary)]">{weekdayRu(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: iconColor(r.sport) }} />
                        <span className="font-medium">{humanSport(r.sport)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{fmtKm(asNum(r.distance_m))}</td>
                    <td className="px-4 py-3">{fmtDurationMinSec(asNum(r.duration_sec))}</td>
                    <td className="px-4 py-3">{r.calories_kcal != null ? `${r.calories_kcal}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RowMenu id={r.id} onDelete={() => askDelete(r.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* pager */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <button
            className="btn btn-ghost h-9"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex(p => Math.max(0, p - 1))}
          >
            Назад
          </button>
          <div className="text-sm text-[var(--text-secondary)]">
            Стр. {totalPages === 0 ? 1 : pageIndex + 1} из {totalPages}
          </div>
          <button
            className="btn btn-ghost h-9"
            disabled={pageIndex >= totalPages - 1}
            onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
          >
            Вперёд
          </button>
        </div>

        {error && (
          <div className="m-4 alert alert-error">
            <span className="alert-icon">⚠️</span>
            <div>{error}</div>
          </div>
        )}
      </section>

      {/* Delete confirmation modal — вне секции, перекрывает всю страницу */}
      {pendingDeleteId && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={()=>setPendingDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl z-[10001]"
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2">Удалить тренировку?</div>
            <div className="text-sm text-[var(--text-secondary)] mb-4">
              Это действие необратимо.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={()=>setPendingDeleteId(null)}>Отмена</button>
              <button className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={confirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ───────── helpers: сортировка-заголовок ───────── */

function SortHead({
  label, col, sortBy, sortDir, onToggle,
}: {
  label: string;
  col: "date"|"sport"|"distance"|"duration"|"kcal";
  sortBy: "date"|"sport"|"distance"|"duration"|"kcal";
  sortDir: "asc"|"desc";
  onToggle: (c: "date"|"sport"|"distance"|"duration"|"kcal") => void;
}) {
  const active = sortBy === col;
  const dir = active ? sortDir : "desc";
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 hover:underline whitespace-nowrap ${active ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}`}
      onClick={() => onToggle(col)}
    >
      <span>{label}</span>
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc"|"desc" }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path
        d={dir === "asc" ? "M2 6 L5 3 L8 6" : "M2 4 L5 7 L8 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={active ? 1 : 0.4}
      />
    </svg>
  );
}

/* ───────── row menu ───────── */

function RowMenu({ id, onDelete }: { id: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  function positionMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuW = 176; // w-44 ≈ 176px
    const gap = 8;
    const maxLeft = window.innerWidth - menuW - 8;
    const left = Math.min(maxLeft, Math.max(8, r.right - menuW));
    const top = Math.min(window.innerHeight - 8, r.bottom + gap);
    setPos({ top, left });
  }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) positionMenu();
    setOpen(v => !v);
  }

  function close() {
    setOpen(false);
  }

  // Reposition on scroll/resize and close on ESC
  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => positionMenu();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative" onClick={(e)=>e.stopPropagation()}>
      <button ref={btnRef} className="btn btn-ghost h-8" onClick={toggle}>⋯</button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          {/* backdrop to catch clicks and sit UNDER the menu */}
          <div className="fixed inset-0 z-[9998]" onClick={close} />

          {/* the menu itself, positioned near the trigger, always above everything */}
          <div
            className="fixed z-[9999] w-44 rounded-2xl border border-[var(--border)] bg-white p-1 shadow"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e)=>e.stopPropagation()}
          >
            <Link
              className="block rounded-xl px-3 py-2 hover:bg-[var(--color-bg-fill-tertiary)]"
              href={`/workouts/${id}`}
              onClick={close}
            >
              Открыть
            </Link>
            <Link
              className="block rounded-xl px-3 py-2 hover:bg-[var(--color-bg-fill-tertiary)]"
              href={`/workouts/${id}/edit`}
              onClick={close}
            >
              Редактировать
            </Link>
            <button
              className="block w-full rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); close(); onDelete(); }}
            >
              Удалить
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}