"use client";
const [row, setRow] = useState<WF | null>(null);
const [err, setErr] = useState<string | null>(null);

useEffect(() => {
let canceled = false;
(async () => {
setErr(null);
const { data, error } = await supabase
.from("workout_files")
.select("id, original_filename, size_bytes, uploaded_at, source, device_vendor, device_model, device_product, device_serial, format, ext")
.eq("workout_id", workoutId)
.is("deleted_at", null)
.order("uploaded_at", { ascending: false })
.limit(1)
.maybeSingle();
if (canceled) return;
if (error) { setErr(error.message); return; }
setRow(data as any as WF);
})();
return () => { canceled = true; };
}, [workoutId]);

const device = useMemo(() => {
if (!row) return "—";
const parts = [row.device_vendor, row.device_model || row.device_product].filter(Boolean) as string[];
return parts.length ? parts.join(" ") : "—";
}, [row]);

const fileName = row?.original_filename || "—";
const fmt = (row?.format || row?.ext || "—").toString().toUpperCase();
const size = formatBytes(row?.size_bytes ?? undefined);
const uploaded = fmtDate(row?.uploaded_at ?? undefined);
const source = row?.source || "upload";

return (
<section className="card p-4">
<div className="mb-2 font-medium">Устройство и файл</div>
{err && <div className="text-sm text-red-600">Ошибка: {err}</div>}
<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Устройство</dt><dd>{device}</dd></div>
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Файл</dt><dd>{fileName}</dd></div>
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Формат</dt><dd>{fmt}</dd></div>
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Размер</dt><dd>{size}</dd></div>
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Загружен</dt><dd>{uploaded}</dd></div>
<div className="flex flex-col"><dt className="text-[var(--text-secondary)]">Источник</dt><dd>{source}</dd></div>
</dl>
</section>
);
}