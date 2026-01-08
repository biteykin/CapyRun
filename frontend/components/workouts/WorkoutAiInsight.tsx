"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AiInsight = {
  id: string;
  summary: string;
  content_md: string;
  title: string | null;
  created_at: string;
};

type Tone = "supportive" | "tough" | "analyst";
type Focus = "recovery" | "performance" | "technique";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const LS_TONE = "capyrun.ai.workoutInsight.tone";
const LS_FOCUS = "capyrun.ai.workoutInsight.focus";

function safeGetLS(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key: string, val: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, val);
  } catch {}
}

const MONTHS_RU_SHORT = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "май",
  "июн.",
  "июл.",
  "авг.",
  "сент.",
  "окт.",
  "ноя.",
  "дек.",
];

function fmtUpdatedRu(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = d.getDate();
  const mon = MONTHS_RU_SHORT[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Обновлено: ${dd} ${mon} ${yyyy}, ${hh}:${mm}`;
}

function normalizeMd(md: string) {
  return (md ?? "").replace(/\r/g, "").trim();
}

function stripDuplicateShortSection(md: string) {
  // Убираем дублирующий блок "Кратко" в markdown (summary показываем сверху).
  const s = normalizeMd(md);
  const re =
    /(^|\n)(#{2,3})\s*(?:✨\s*)?Кратко\s*\n([\s\S]*?)(?=\n#{2,3}\s|\s*$)/i;
  return s.replace(re, "\n").trim();
}

function emojiifyMd(md: string) {
  // Лёгкое оживление заголовков (не перебор)
  return normalizeMd(md)
    .replace(/^###\s*Итог\b/gm, "### ✨ Итог")
    .replace(/^##\s*Итог\b/gm, "## ✨ Итог")
    .replace(/^###\s*Что было хорошо\b/gm, "### ✅ Что было хорошо")
    .replace(/^##\s*Что хорошо\b/gm, "## ✅ Что хорошо")
    .replace(/^###\s*Риски\s*\/\s*что улучшить\b/gm, "### ⚠️ Риски / что улучшить")
    .replace(/^##\s*Риски\s*\/\s*что улучшить\b/gm, "## ⚠️ Риски / что улучшить")
    .replace(/^###\s*Следующая тренировка\b/gm, "### 🏃 Следующая тренировка")
    .replace(/^##\s*Следующая тренировка\b/gm, "## 🏃 Следующая тренировка");
}

type ParsedSections = {
  positives: string[];
  risks: string[];
  next: string[];
  tags: string[];
};

function pickTags(summary: string, md: string): string[] {
  const s = `${summary}\n${md}`.toLowerCase();

  const tags: Array<{ key: string; label: string }> = [
    { key: "z2", label: "Аэробная база" },
    { key: "аэроб", label: "Аэробная база" },
    { key: "темп", label: "Темповая работа" },
    { key: "интервал", label: "Интервалы" },
    { key: "восстанов", label: "Восстановление" },
    { key: "техника", label: "Техника" },
    { key: "каденс", label: "Каденс" },
    { key: "пульс", label: "Пульс/контроль" },
    { key: "аномал", label: "Риск" },
    { key: "риск", label: "Риск" },
    { key: "сон", label: "Сон/стресс" },
    { key: "боль", label: "Тело/сигналы" },
    { key: "снег", label: "Условия" },
    { key: "ветер", label: "Условия" },
    { key: "жара", label: "Условия" },
    { key: "холод", label: "Условия" },
  ];

  const out: string[] = [];
  for (const t of tags) {
    if (s.includes(t.key)) out.push(t.label);
    if (out.length >= 4) break;
  }

  // дефолт, если ничего не нашли
  if (!out.length) out.push("Коуч-разбор");
  return Array.from(new Set(out)).slice(0, 4);
}

function extractBullets(md: string, heading: RegExp) {
  // ищем секцию по заголовку и вытаскиваем маркированные строки
  // поддержка: "- " / "• " / "* "
  const s = normalizeMd(md);
  const start = s.search(heading);
  if (start === -1) return [] as string[];

  const after = s.slice(start);
  const nextHeaderIdx = after.slice(1).search(/\n#{2,3}\s+/); // следующий заголовок
  const block = nextHeaderIdx === -1 ? after : after.slice(0, nextHeaderIdx + 1);

  const lines = block.split("\n");
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:-|\*|•)\s+(.*)\s*$/);
    if (m?.[1]) bullets.push(m[1].trim());
  }
  return bullets.filter(Boolean).slice(0, 6);
}

function extractNextParagraph(md: string) {
  // “Следующая тренировка” — если без буллетов, берём абзацы
  const s = normalizeMd(md);
  const m = s.match(/(^|\n)#{2,3}\s*(?:🏃\s*)?Следующая тренировка\s*\n([\s\S]*?)(?=\n#{2,3}\s|\s*$)/i);
  if (!m?.[2]) return [];
  const body = m[2].trim();
  if (!body) return [];
  const lines = body
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // если там буллеты — они уже будут вытащены отдельно
  const plain = lines.filter((x) => !/^(-|\*|•)\s+/.test(x));
  const joined = plain.join(" ").trim();
  if (!joined) return [];
  // порежем на 1–2 предложения
  const parts = joined.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2);
}

function parseSections(summary: string, contentMd: string): ParsedSections {
  const md = emojiifyMd(stripDuplicateShortSection(contentMd));

  // заголовки могут быть "## ✅ Что хорошо" и т.п.
  const positives = extractBullets(md, /(^|\n)#{2,3}\s*(?:✅\s*)?Что (?:было )?хорошо\b/i);
  const risks = extractBullets(md, /(^|\n)#{2,3}\s*(?:⚠️\s*)?Риски\b/i);
  const nextBullets = extractBullets(md, /(^|\n)#{2,3}\s*(?:🏃\s*)?Следующая тренировка\b/i);
  const nextText = extractNextParagraph(md);

  const next = [...nextBullets, ...nextText].filter(Boolean).slice(0, 3);
  const tags = pickTags(summary, md);

  return { positives, risks, next, tags };
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
    </span>
  );
}

function AiPulse() {
  return (
    <div className="h-10 w-10 rounded-2xl border bg-background grid place-items-center shadow-sm animate-pulse-slow">
      <span className="text-base">✨</span>
      <style jsx>{`
        @keyframes pulse-slow {
          0% { box-shadow: 0 0 0 0 rgba(180, 180, 255, 0.08);}
          60% { box-shadow: 0 0 0 11px rgba(180, 180, 255, 0.10);}
          100% { box-shadow: 0 0 0 0 rgba(180, 180, 255, 0.08);}
        }
        .animate-pulse-slow {
          animation: pulse-slow 2.4s cubic-bezier(.4,0,.6,1) infinite;
        }
      `}</style>
    </div>
  );
}

function SoftProgress({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full w-1/3 rounded-full bg-muted-foreground/35 animate-[cr-ai-progress_1.2s_ease-in-out_infinite]" />
      <style jsx>{`
        @keyframes cr-ai-progress {
          0% {
            transform: translateX(-45%);
          }
          50% {
            transform: translateX(155%);
          }
          100% {
            transform: translateX(-45%);
          }
        }
      `}</style>
    </div>
  );
}

function MiniCard({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold inline-flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span>{title}</span>
        </div>
      </div>

      <div className="mt-2">
        {items.length ? (
          <ul className="space-y-1.5">
            {items.slice(0, 4).map((x, idx) => (
              <li
                key={`${title}-${idx}`}
                className="text-sm text-muted-foreground leading-snug"
              >
                <span className="text-foreground/70">•</span>{" "}
                <span>{x}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export default function WorkoutAiInsight({ workoutId }: { workoutId: string }) {
  const [row, setRow] = React.useState<AiInsight | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

  // Preferences (with sensible default)
  const [tone, setTone] = React.useState<Tone>("supportive");
  const [focus, setFocus] = React.useState<Focus>("recovery");

  React.useEffect(() => {
    const t = safeGetLS(LS_TONE);
    const f = safeGetLS(LS_FOCUS);
    if (t === "supportive" || t === "tough" || t === "analyst") setTone(t);
    if (f === "recovery" || f === "performance" || f === "technique") setFocus(f);
  }, []);

  React.useEffect(() => {
    safeSetLS(LS_TONE, tone);
  }, [tone]);
  React.useEffect(() => {
    safeSetLS(LS_FOCUS, focus);
  }, [focus]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("ai_insights")
      .select("id, summary, content_md, title, created_at")
      .eq("scope", "workout")
      .eq("entity_id", workoutId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setRow(null);
    } else {
      setRow((data as any) ?? null);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  async function generate() {
    try {
      setGenerating(true);
      setErr(null);

      const res = await fetch(`/api/ai/analyze-workout`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId,
          locale: "ru",
          force: true,
          tone,
          focus
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      await load();

    } catch (e: any) {
      setErr(e?.message ?? "Не удалось сгенерировать инсайт");
    } finally {
      setGenerating(false);
    }
  }

  const hasInsight = !!row && !loading && !err;
  const parsed = React.useMemo(() => {
    if (!row) return null;
    return parseSections(row.summary ?? "", row.content_md ?? "");
  }, [row]);

  const detailsMd = React.useMemo(() => {
    if (!row) return "";
    return stripDuplicateShortSection(emojiifyMd(row.content_md ?? ""));
  }, [row]);

  return (
    <Card className="overflow-hidden">
      {/* Header: строгий, “премиальный”, без цветных заливок */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AiPulse />
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <span>AI-анализ тренировки</span>
                <Badge variant="secondary" className="rounded-full">
                  AI-coach ✨
                </Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Инсайт + рекомендации на основе метрик (и твоих заметок ✍️)
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant={row ? "secondary" : "primary"}
            onClick={generate}
            disabled={generating}
            className={cx("rounded-full")}
          >
            {generating ? (
              <span className="inline-flex items-center gap-2">
                Думаю <LoadingDots />
              </span>
            ) : row ? (
              "🔄 Обновить"
            ) : (
              "✨ Сгенерировать"
            )}
          </Button>
        </div>

        {/* Preferences (compact, no clutter) */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground mr-1">Режим:</div>
          <div className="inline-flex rounded-full border bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={tone === "supportive" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setTone("supportive")}
              disabled={generating}
            >
              ✨ Поддержка
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tone === "tough" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setTone("tough")}
              disabled={generating}
            >
              🎯 Строго
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tone === "analyst" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setTone("analyst")}
              disabled={generating}
            >
              🧠 Аналитик
            </Button>
          </div>

          <div className="ml-2 text-xs text-muted-foreground mr-1">Фокус:</div>
          <div className="inline-flex rounded-full border bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={focus === "recovery" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFocus("recovery")}
              disabled={generating}
            >
              🫀 Восст.
            </Button>
            <Button
              type="button"
              size="sm"
              variant={focus === "performance" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFocus("performance")}
              disabled={generating}
            >
              🏃 Рез-т
            </Button>
            <Button
              type="button"
              size="sm"
              variant={focus === "technique" ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFocus("technique")}
              disabled={generating}
            >
              🦶 Техн.
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
              Загружаем <LoadingDots />
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ) : err ? (
          <Alert>
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : !row ? (
          <div className="space-y-2">
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">Сделаем анализ точным ✍️</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Перед запуском напиши 2–3 строки заметки: самочувствие, сон, стресс,
                боль/дискомфорт, как дался темп. Тогда рекомендации будут “как от личного тренера”.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">📝 контекст</Badge>
                <Badge variant="outline" className="rounded-full">🎯 точнее советы</Badge>
                <Badge variant="outline" className="rounded-full">⚡ меньше общих слов</Badge>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Нажми <span className="font-medium">«Сгенерировать»</span>, когда готов ✨
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 3 колонки “скан-режим”: это реально делает виджет «в 10 раз читабельнее» */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <MiniCard
                title="Сильные моменты"
                icon="✅"
                items={parsed?.positives ?? []}
                emptyText="Всё ровно — без ярких пиков, это тоже хорошо."
              />
              <MiniCard
                title="Зона внимания"
                icon="⚠️"
                items={parsed?.risks ?? []}
                emptyText="Рисков не вижу — держи этот стиль."
              />
              <MiniCard
                title="Следующая сессия"
                icon="🏃"
                items={parsed?.next ?? []}
                emptyText="Сделай лёгкую восстановительную или Z2 по самочувствию."
              />
            </div>

            {/* Детали — аккуратно, красиво, по желанию */}
            <Accordion type="single" collapsible>
              <AccordionItem value="details" className="border-0">
                <AccordionTrigger
                  className={cx(
                    "no-underline hover:no-underline",
                    "py-2",
                    "rounded-2xl",
                    "px-3 -mx-3",
                    "hover:bg-muted/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "[&>svg]:opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border bg-background">
                      ✨
                    </span>
                    <span>Детальные рекомендации</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      (для тех, кто любит глубже)
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-2">
                  <div className="rounded-2xl border bg-card p-4">
                    <div className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {emojiifyMd(stripDuplicateShortSection(row.content_md))}
                      </ReactMarkdown>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}