"use client";
setTimeout(() => { setStatus("idle"); }, 1500);
}

// Автосейв через 5 секунд после остановки ввода
useEffect(() => {
if (timerRef.current) clearTimeout(timerRef.current);
timerRef.current = setTimeout(() => { void saveNow(text); }, 5000);
return () => { if (timerRef.current) clearTimeout(timerRef.current); };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [text]);

// Сохранять по blur / Cmd+Enter
function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
e.preventDefault();
if (timerRef.current) clearTimeout(timerRef.current);
void saveNow(text);
}
}

return (
<section className="card p-4">
<div className="mb-2 flex items-center justify-between">
<div className="font-medium">Заметка</div>
<div className="text-xs text-[var(--text-secondary)]">
{status === "saving" && "Сохраняем…"}
{status === "saved" && "Сохранено"}
{status === "error" && <span className="text-red-600">Ошибка сохранения</span>}
</div>
</div>
{error && <div className="text-xs text-red-600 mb-2">{error}</div>}
<textarea
className="w-full min-h-28 resize-vertical rounded-xl border px-3 py-2 outline-none focus:ring"
placeholder="Добавьте заметку к тренировке…"
value={text}
onChange={(e) => setText(e.target.value)}
onBlur={() => { if (timerRef.current) { clearTimeout(timerRef.current); } void saveNow(text); }}
onKeyDown={onKeyDown}
/>
<div className="mt-1 text-[10px] text-[var(--text-secondary)]">Автосохранение через 5 сек. ⌘↩︎ — сохранить сейчас</div>
</section>
);
}