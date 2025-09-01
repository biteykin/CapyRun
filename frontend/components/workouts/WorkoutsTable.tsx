"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";

type Workout = {
  id: string;
  user_id?: string;
  date?: string | null;         // ISO
  type?: string | null;         // run, bike, swim, strength, fitness, padel, ...
  duration_min?: number | null; // минут
  distance_km?: number | null;
  calories?: number | null;
};

const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const WD = ["вс","пн","вт","ср","чт","пт","сб"];

function fmtDateRu(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  const day = String(x.getDate()).padStart(2,"0");
  const mon = MONTHS[x.getMonth()];
  const yy = String(x.getFullYear()).slice(2);
  return `${day} ${mon} ${yy}`;
}
function weekdayRu(d?: string | null) {
  if (!d) return "—";
  return WD[new Date(d).getDay()];
}
function asNum(v: any) { return typeof v === "number" ? v : (v ? Number(v) : null); }

const PAGE_SIZES = [5, 10, 20, 50];

export default function WorkoutsTable() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Workout[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) await fetchPage(uid, page, pageSize);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchPage(userId, page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, userId]);

  async function fetchPage(uid: string, p: number, ps: number) {
    setError(null);
    setLoading(true);
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    const q = supabase
      .from("workouts")
      .select("*", { count: "exact" })
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .range(from, to);

    const { data, error, count } = await q;
    if (error) setError(error.message);
    setRows((data as Workout[]) ?? []);
    setCount(count ?? 0);
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm("Удалить тренировку?")) return;
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    // оптимистично обновим
    setRows(prev => prev.filter(r => r.id !== id));
    setCount(x => Math.max(0, x - 1));
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);

  return (
    <section className="card overflow-hidden">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm text-[var(--text-secondary)]">
          Всего: {count} • Страница {page}/{totalPages}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Показывать:</span>
          <select
            className="input h-9 w-28"
            value={pageSize}
            onChange={(e)=>{ setPage(1); setPageSize(parseInt(e.target.value,10)); }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">День</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Дистанция</th>
                <th className="px-4 py-3 font-medium">Время</th>
                <th className="px-4 py-3 font-medium">Ккал</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const dist = asNum((r as any).distance_km);
                const mins = asNum((r as any).duration_min);
                const kcal = asNum((r as any).calories);
                return (
                  <tr key={r.id} className="hover:bg-[var(--color-bg-fill-tertiary)]/60">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateRu(r.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--text-secondary)]">{weekdayRu(r.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full"
                              style={{ background: iconColor(r.type) }} />
                        <span className="font-medium">{humanType(r.type)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{dist != null ? `${dist.toFixed(2)} км` : "—"}</td>
                    <td className="px-4 py-3">{mins != null ? `${mins} мин` : "—"}</td>
                    <td className="px-4 py-3">{kcal != null ? `${kcal}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/workouts/${r.id}`} className="btn btn-ghost h-8">Перейти</Link>
                        <RowMenu id={r.id} onDelete={() => remove(r.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* pager */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
        <button className="btn btn-ghost h-9" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Назад</button>
        <div className="text-sm text-[var(--text-secondary)]">Стр. {page} из {totalPages}</div>
        <button className="btn btn-ghost h-9" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Вперёд</button>
      </div>

      {error && (
        <div className="m-4 alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div>{error}</div>
        </div>
      )}
    </section>
  );
}

function humanType(t?: string | null) {
  const m: Record<string,string> = {
    run: "Бег",
    bike: "Велосипед",
    swim: "Плавание",
    strength: "Силовая",
    fitness: "Фитнес",
    padel: "Падел",
  };
  return m[(t||"").toLowerCase()] || "Другая";
}
function iconColor(t?: string | null) {
  const k = (t||"").toLowerCase();
  if (k==="run") return "#DF6133";
  if (k==="bike") return "#FFBA53";
  if (k==="swim") return "#4FA3FF";
  if (k==="strength") return "#6B7280";
  if (k==="fitness") return "#22C55E";
  if (k==="padel") return "#A855F7";
  return "#B7B9AE";
}

function RowMenu({ id, onDelete }: { id: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn btn-ghost h-8" onClick={() => setOpen(v=>!v)}>⋯</button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-[var(--border)] bg-white p-1 shadow"
          onMouseLeave={() => setOpen(false)}
        >
          <Link className="block rounded-xl px-3 py-2 hover:bg-[var(--color-bg-fill-tertiary)]" href={`/workouts/${id}`}>Открыть</Link>
          <Link className="block rounded-xl px-3 py-2 hover:bg-[var(--color-bg-fill-tertiary)]" href={`/workouts/${id}/edit`}>Редактировать</Link>
          <button className="block w-full rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={onDelete}>
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}