"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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

function emojiifyMd(md: string) {
  // Лёгкое “оживление” Markdown без ломания смысла
  // (безопасно: мы всё равно рендерим как текст)
  return md
    .replace(/^###\s*Итог\b/gm, "### 🧠 Итог")
    .replace(/^##\s*Кратко\b/gm, "## 🧠 Кратко")
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId, locale: "ru" }),
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
      {/* AI header (особенный виджет) */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10" />
        <div className="absolute inset-0 [mask-image:radial-gradient(60%_60%_at_10%_0%,black,transparent)] bg-gradient-to-b from-white/10 to-transparent" />

        <CardHeader className="relative pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AiPulse />
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>AI-анализ тренировки</span>
                  <Badge variant="secondary" className="rounded-full">
                    ⚡ AI coach
                  </Badge>
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  Инсайт + рекомендации на основе метрик (и твоих заметок ✍️)
                </div>
              </div>
            </div>

            <Button size="sm" variant="primary" onClick={generate} disabled={generating}>
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  Генерируем <LoadingDots />
                </span>
              ) : row ? (
                "🔄 Обновить"
              ) : (
                "✨ Сгенерировать"
              )}
            </Button>
          </div>
        </CardHeader>
      </div>

      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-3">
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
          <div className="space-y-3">
            <div className="rounded-2xl border bg-card/40 p-4">
              <div className="text-sm font-semibold">Перед генерацией — добавь заметку ✍️</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Лучше всего AI работает, когда ты пишешь пару строк: самочувствие, сон, стресс,
                боль/дискомфорт, как дался темп. Тогда рекомендации будут точнее.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">📝 заметки → лучше контекст</Badge>
                <Badge variant="outline" className="rounded-full">🎯 рекомендации → точнее</Badge>
                <Badge variant="outline" className="rounded-full">🧩 меньше “общих слов”</Badge>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Пока нет инсайта для этой тренировки. Нажми <span className="font-medium">«Сгенерировать»</span>.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold inline-flex items-center gap-2">
                <span>🧠</span>
                <span>{row.summary}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {row.created_at ? `🕒 ${new Date(row.created_at).toLocaleString()}` : null}
              </div>
            </div>

            <div
              className={cx(
                "rounded-2xl border bg-card/30 p-4",
                generating && "opacity-80"
              )}
            >
              {generating && (
                <div className="mb-3 text-xs text-muted-foreground inline-flex items-center gap-2">
                  AI готовит ответ <LoadingDots />
                </div>
              )}
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {emojiifyMd(row.content_md)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}