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

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const MONTHS_RU_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сент.", "окт.", "ноя.", "дек."
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

function stripDuplicateShortSection(md: string) {
  // Убираем дублирующий блок "Кратко" в markdown (оставляем summary сверху виджета).
  // Поддерживаем варианты:
  //   ## Кратко
  //   ## ✨ Кратко
  //   ### Кратко
  // и вырезаем до следующего заголовка уровня ##/### или конца.
  const s = (md ?? "").replace(/\r/g, "");
  const re =
    /(^|\n)(#{2,3})\s*(?:✨\s*)?Кратко\s*\n([\s\S]*?)(?=\n#{2,3}\s|\s*$)/i;
  return s.replace(re, "\n").trim();
}

function emojiifyMd(md: string) {
  // Лёгкое “оживление” Markdown (теперь рендерим markdown, так что это прям будет красиво)
  return md
    .replace(/^###\s*Итог\b/gm, "### ✨ Итог")
    .replace(/^##\s*Кратко\b/gm, "## ✨ Кратко")
    .replace(/^###\s*Что было хорошо\b/gm, "### ✅ Что было хорошо")
    .replace(/^##\s*Что хорошо\b/gm, "## ✅ Что хорошо")
    .replace(/^###\s*Риски\s*\/\s*что улучшить\b/gm, "### ⚠️ Риски / что улучшить")
    .replace(/^##\s*Риски\s*\/\s*что улучшить\b/gm, "## ⚠️ Риски / что улучшить")
    .replace(/^###\s*Следующая тренировка\b/gm, "### 🏃 Следующая тренировка")
    .replace(/^##\s*Следующая тренировка\b/gm, "## 🏃 Следующая тренировка");
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
  // Лёгкая “AI-энергия” в углу
  return (
    <div className="relative h-9 w-9">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/25 via-fuchsia-500/20 to-cyan-500/20 blur-[10px]" />
      <div className="absolute inset-0 rounded-2xl border bg-background/60 backdrop-blur">
        <div className="h-full w-full grid place-items-center">
          <span className="text-sm">✨</span>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutAiInsight({ workoutId }: { workoutId: string }) {
  const [row, setRow] = React.useState<AiInsight | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

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
        body: JSON.stringify({ workoutId, locale: "ru", force: true }),
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

  return (
    <Card className="overflow-hidden">
      {/* Header: строгий, “премиальный”, без цветных заливок */}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AiPulse />
            <div className="space-y-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <span>AI-анализ тренировки</span>
                <Badge variant="secondary" className="rounded-full">
                  AI-coach ✨
                </Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground leading-snug">
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

        {/* 🔥 Главное улучшение: если есть инсайт — “кратко” прямо под подзаголовком,
            чтобы не было огромной пустоты между header и контентом */}
        {row && !loading && !err ? (
          <div className={cx("mt-2", generating && "opacity-80")}>
            <div className="text-[15px] font-semibold leading-snug">
              {row.summary}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtUpdatedRu(row.created_at)}
            </div>
            {generating ? (
              <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-2">
                AI обновляет ответ <LoadingDots />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-1">
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
              <div className="text-sm font-semibold">
                Перед стартом — дай 2–3 строки заметки ✍️
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                «Как дался темп», сон, стресс, боль/дискомфорт, настроение — это делает анализ
                точнее. Тогда я буду тренировать тебя не “в среднем”, а <span className="font-medium">лично</span>.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">📝 контекст</Badge>
                <Badge variant="outline" className="rounded-full">🎯 точность</Badge>
                <Badge variant="outline" className="rounded-full">⚡ конкретика</Badge>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Когда будешь готов — нажми <span className="font-medium">«Сгенерировать»</span> ✨
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-0">
              <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-0">
                  <AccordionTrigger
                    className={cx(
                      "no-underline hover:no-underline",
                      "py-2",
                      "rounded-xl",
                      "px-3 -mx-3",
                      "hover:bg-muted/40",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "[&>svg]:opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border bg-background">
                        ✨
                      </span>
                      <span>Детальные рекомендации</span>
                      <span className="text-xs text-muted-foreground font-normal">(раскрыть)</span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2">
                    <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {stripDuplicateShortSection(emojiifyMd(row.content_md))}
                      </ReactMarkdown>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}