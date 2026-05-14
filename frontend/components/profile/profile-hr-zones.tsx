// frontend/components/profile/profile-hr-zones.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, PencilLine, Sparkles, Save, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_HR_MAX, buildDefaultHrZones, estimateHrMax } from "@/lib/training/hr-zones";

type Zone = {
  key: string; // Z1..Z5
  name: string;
  min: number;
  max: number;
};

const ZONE_THEME: Record<string, { color: string; bg: string }> = {
  Z1: { color: "#59229F", bg: "#D1C1E4" },
  Z2: { color: "#3AAAEF", bg: "#C5E8FF" },
  Z3: { color: "#1A9E3A", bg: "#C5EDD0" },
  Z4: { color: "#FFD600", bg: "#FFF5B0" },
  Z5: { color: "#E60012", bg: "#FFCCCC" },
};

const ZONE_HELP: Record<string, { title: string; body: string }> = {
  Z1: {
    title: "Z1 · Восстановление",
    body:
      "Очень лёгкая интенсивность. Помогает восстановлению, улучшает кровоток и снижает накопленную усталость. В этой зоне хорошо делать разминку, заминку и восстановительные пробежки после тяжёлых дней.",
  },
  Z2: {
    title: "Z2 · Аэробная база",
    body:
      "Основная зона для развития выносливости. Организм активно использует жиры как источник энергии, укрепляется сердечно-сосудистая система и растёт митохондриальная база. Для любителя большая часть спокойного бега должна проходить именно здесь.",
  },
  Z3: {
    title: "Z3 · Темповая",
    body:
      "Умеренно тяжёлая зона между лёгким бегом и пороговой работой. Развивает устойчивость к длительной нагрузке, но быстрее накапливает усталость. Полезна дозированно, но не должна незаметно заменять все лёгкие пробежки.",
  },
  Z4: {
    title: "Z4 · Пороговая",
    body:
      "Интенсивная работа около анаэробного порога. Помогает бежать быстрее и дольше без резкого закисления. Используется для темповых отрезков и специальных тренировок, обычно 1–2 раза в неделю при хорошем восстановлении.",
  },
  Z5: {
    title: "Z5 · VO₂max / Спурт",
    body:
      "Очень высокая интенсивность. Развивает максимальное потребление кислорода, скорость и мощность, но сильно нагружает нервную систему, мышцы и восстановление. Использовать редко и короткими отрезками.",
  },
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inputNumberValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "";
  return String(value);
}

/**
 * Пытаемся распарсить hr_zones из БД максимально “терпимо”:
 * - массив [{min,max,name?}, ...]
 * - объект { z1:{min,max}, z2:{...} } или {Z1:{...}}
 * - если не получилось: fallback по % от HRmax
 */
function buildZones(hrMax: number | null, hrZonesRaw: unknown): Zone[] {
  const fallback = (max: number): Zone[] => {
    const bands = [
      { key: "Z1", name: "Восстановление", p1: 0.5, p2: 0.6 },
      { key: "Z2", name: "Аэробная база", p1: 0.6, p2: 0.7 },
      { key: "Z3", name: "Темповая", p1: 0.7, p2: 0.8 },
      { key: "Z4", name: "Пороговая", p1: 0.8, p2: 0.9 },
      { key: "Z5", name: "VO₂ / Спурт", p1: 0.9, p2: 1.0 },
    ];
    return bands.map((b) => ({
      key: b.key,
      name: b.name,
      min: Math.round(max * b.p1),
      max: Math.round(max * b.p2),
    }));
  };

  if (!hrMax || !Number.isFinite(hrMax) || hrMax <= 0) return [];

  const raw = hrZonesRaw as Record<string, unknown> | unknown[] | null;

  // 1) array
  if (Array.isArray(raw) && raw.length) {
    const zones: Zone[] = raw
      .map((z: unknown, i: number) => {
        const row = z as { min?: unknown; max?: unknown; key?: unknown; name?: unknown };
        const min = asNumber(row?.min);
        const max = asNumber(row?.max);
        if (min == null || max == null) return null;

        const key = row?.key ? String(row.key) : `Z${i + 1}`;
        const name = row?.name ? String(row.name) : `Зона ${i + 1}`;
        return { key, name, min, max };
      })
      .filter(Boolean) as Zone[];

    if (zones.length) return zones;
  }

  // 2) object keyed zones
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const hrZonesRaw = raw as Record<string, { min?: unknown; max?: unknown; name?: unknown }>;
    const pick = (k: string) =>
      hrZonesRaw[k] ?? hrZonesRaw[k.toLowerCase()] ?? hrZonesRaw[k.toUpperCase()];

    const keys = ["z1", "z2", "z3", "z4", "z5", "Z1", "Z2", "Z3", "Z4", "Z5"];
    const found: Zone[] = [];
    const used = new Set<string>();

    for (const k of keys) {
      const kk = k.toUpperCase();
      if (used.has(kk)) continue;
      const v = pick(k);
      if (!v) continue;

      const min = asNumber(v?.min);
      const max = asNumber(v?.max);
      if (min == null || max == null) continue;

      used.add(kk);
      found.push({
        key: kk,
        name: v?.name ? String(v.name) : kk,
        min,
        max,
      });
    }

    if (found.length) {
      found.sort((a, b) => a.key.localeCompare(b.key));
      return found;
    }
  }

  return fallback(hrMax);
}

function buildSuggestedZones(
  hrMax: number | null,
  age: number | null,
  workoutsCount: number | null
): Zone[] {
  if (!hrMax) {
    return Object.entries(buildDefaultHrZones(DEFAULT_HR_MAX)).map(([key, z]) => ({
      key,
      name: z.name,
      min: z.min,
      max: z.max,
    }));
  }

  const level =
    workoutsCount != null && workoutsCount >= 80
      ? "trained"
      : workoutsCount != null && workoutsCount >= 20
      ? "regular"
      : "novice";

  let bands: Array<{ key: string; name: string; p1: number; p2: number }>;

  if (level === "novice") {
    bands = [
      { key: "Z1", name: "Восстановление", p1: 0.5, p2: 0.62 },
      { key: "Z2", name: "Аэробная база", p1: 0.62, p2: 0.74 },
      { key: "Z3", name: "Темповая", p1: 0.74, p2: 0.84 },
      { key: "Z4", name: "Пороговая", p1: 0.84, p2: 0.92 },
      { key: "Z5", name: "VO₂ / Спурт", p1: 0.92, p2: 1.0 },
    ];
  } else if (level === "regular") {
    bands = [
      { key: "Z1", name: "Восстановление", p1: 0.5, p2: 0.6 },
      { key: "Z2", name: "Аэробная база", p1: 0.6, p2: 0.7 },
      { key: "Z3", name: "Темповая", p1: 0.7, p2: 0.8 },
      { key: "Z4", name: "Пороговая", p1: 0.8, p2: 0.9 },
      { key: "Z5", name: "VO₂ / Спурт", p1: 0.9, p2: 1.0 },
    ];
  } else {
    bands = [
      { key: "Z1", name: "Восстановление", p1: 0.5, p2: 0.58 },
      { key: "Z2", name: "Аэробная база", p1: 0.58, p2: 0.7 },
      { key: "Z3", name: "Темповая", p1: 0.7, p2: 0.82 },
      { key: "Z4", name: "Пороговая", p1: 0.82, p2: 0.91 },
      { key: "Z5", name: "VO₂ / Спурт", p1: 0.91, p2: 1.0 },
    ];
  }

  // Чуть более консервативная схема для старшего возраста
  if (age != null && age >= 45) {
    bands = bands.map((b, i) => {
      if (i <= 1) return b;
      return {
        ...b,
        p1: Math.max(0, b.p1 - 0.01),
        p2: Math.max(0, b.p2 - (i === bands.length - 1 ? 0 : 0.01)),
      };
    });

    // держим непрерывность диапазонов
    bands = bands.map((b, i, arr) => {
      if (i === 0) return b;
      return { ...b, p1: arr[i - 1]!.p2 };
    });
    const last = bands.length - 1;
    bands[last] = {
      ...bands[last]!,
      p2: 1.0,
    };
  }

  return bands.map((b) => ({
    key: b.key,
    name: b.name,
    min: Math.round(hrMax * b.p1),
    max: Math.round(hrMax * b.p2),
  }));
}

export default function ProfileHrZones({
  userId,
  age,
  gender,
  workoutsCount,
  maxHr,
  hrZones,
}: {
  userId: string;
  age?: number | null;
  gender?: string | null;
  workoutsCount?: number | null;
  maxHr?: number | null;
  hrZones?: unknown | null;
}) {
  const router = useRouter();
  const hrMax = maxHr != null ? Number(maxHr) : null;
  const zones = React.useMemo(() => buildZones(hrMax, hrZones), [hrMax, hrZones]);
  const hasHrMax = hrMax != null && Number.isFinite(hrMax) && hrMax > 0;
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Zone[]>(zones);
  const [draftHrMax, setDraftHrMax] = React.useState<number>(
    hasHrMax && hrMax != null ? hrMax : DEFAULT_HR_MAX
  );

  const effectiveHrMax =
    Number.isFinite(draftHrMax) && draftHrMax > 0
      ? draftHrMax
      : hasHrMax
        ? hrMax
        : DEFAULT_HR_MAX;

  const maxForBars = effectiveHrMax;

  React.useEffect(() => {
    setDraft(zones);
    setDraftHrMax(hasHrMax && hrMax != null ? hrMax : DEFAULT_HR_MAX);
  }, [zones, hasHrMax, hrMax]);

  function updateZone(index: number, field: "min" | "max", value: string) {
    const n = Number(value);
    const nextValue = Number.isFinite(n) ? n : 0;

    setDraft((prev) => {
      const next = prev.map((z) => ({ ...z }));
      const zone = next[index];
      if (!zone) return prev;

      zone[field] = nextValue;

      // Если меняем верх текущей зоны — тянем низ следующей
      // кроме последней зоны (Z5), у которой нет смежной сверху
      if (field === "max" && index < next.length - 1) {
        next[index + 1].min = nextValue;
      }

      if (field === "max" && index === next.length - 1) {
        setDraftHrMax(nextValue);
      }

      // Если меняем низ текущей зоны — тянем верх предыдущей
      // кроме первой зоны (Z1), у которой нет смежной снизу
      if (field === "min" && index > 0) {
        next[index - 1].max = nextValue;
      }

      return next;
    });
  }

  async function saveZones() {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = Object.fromEntries(
        draft.map((z) => [
          z.key,
          {
            name: z.name,
            min: z.min,
            max: z.max,
          },
        ])
      );

      const res = await fetch("/api/profile/hr-zones", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hr_max: draftHrMax,
          hr_zones: payload,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      setSuccess("Пульсовые зоны сохранены");
      setEditing(false);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось сохранить зоны";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function applySuggestedZones() {
    const baseHrMax = draftHrMax && draftHrMax > 0 ? draftHrMax : DEFAULT_HR_MAX;

    const suggested = buildSuggestedZones(
      baseHrMax,
      age ?? null,
      workoutsCount ?? null
    );
    setDraft(suggested);
    setDraftHrMax(baseHrMax);
    setEditing(true);
    setError(null);
    setSuccess("Подобрали зоны автоматически. Проверьте и сохраните");
  }

  function applySuggestedHrMax() {
    const nextHrMax = estimateHrMax(age ?? null, gender ?? null);
    setDraftHrMax(nextHrMax);
    setDraft(buildSuggestedZones(nextHrMax, age ?? null, workoutsCount ?? null));
    setEditing(true);
    setError(null);
  }

  function updateDraftHrMax(value: string) {
    if (value === "") {
      setDraftHrMax(0);
      return;
    }

    const nextHrMax = Number(value);
    if (!Number.isFinite(nextHrMax)) return;

    setDraftHrMax(nextHrMax);

    if (nextHrMax >= 120 && nextHrMax <= 230) {
      setDraft(buildSuggestedZones(nextHrMax, age ?? null, workoutsCount ?? null));
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Пульсовые зоны</CardTitle>
            <CardDescription className="mt-1.5">
              Диапазоны в BPM. Если зоны не заданы — считаем от HRmax.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={applySuggestedZones}>
              <Sparkles className="mr-2 size-4" />
              Подобрать зоны
            </Button>
            {!editing ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft(
                    zones.length ? zones : buildSuggestedZones(null, age ?? null, workoutsCount ?? null)
                  );
                  if (zones.length) {
                    setDraftHrMax(hasHrMax && hrMax != null ? hrMax : DEFAULT_HR_MAX);
                  }
                  setEditing(true);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <PencilLine className="mr-2 size-4" />
                Редактировать зоны
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(zones);
                    setDraftHrMax(hasHrMax && hrMax != null ? hrMax : DEFAULT_HR_MAX);
                    setEditing(false);
                    setError(null);
                  }}
                >
                  <X className="mr-2 size-4" />
                  Отмена
                </Button>
                <Button type="button" size="sm" onClick={saveZones} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {saving ? "Сохраняем…" : "Сохранить"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-2xl border bg-muted/15 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Максимальная частота пульса</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={120}
                max={230}
                disabled={!editing}
                value={inputNumberValue(draftHrMax)}
                onChange={(e) => updateDraftHrMax(e.target.value)}
                className="w-32"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!editing}
              onClick={applySuggestedHrMax}
            >
              <Sparkles className="mr-2 size-4" />
              Рассчитать по возрасту
            </Button>
          </div>


          {success ? <div className="mt-3 text-sm text-emerald-700">{success}</div> : null}
        </div>

        {zones.length === 0 && !editing ? (
          <EmptyZoneState
            emoji="📉"
            title="Зоны пока не настроены"
            description="Можно подобрать базовые зоны автоматически или задать их вручную"
          />
        ) : (
          <>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <div className="space-y-3">
              {(editing ? draft : zones).map((z, idx) => {
                const left = clamp((z.min / maxForBars) * 100, 0, 100);
                const right = clamp((z.max / maxForBars) * 100, 0, 100);
                const width = clamp(right - left, 0, 100);
                const theme = ZONE_THEME[z.key] ?? { color: "#2565f9", bg: "#C5E8FF" };

                return (
                  <div key={z.key} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-3 w-3 rounded-full"
                            style={{ background: theme.color }}
                            aria-hidden
                          />
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            <span>
                              {z.key} · {z.name}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex rounded-full text-muted-foreground transition hover:text-foreground"
                                  aria-label={`Описание зоны ${z.key}`}
                                >
                                  <Info className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="start"
                                className="max-w-xs bg-popover px-3 py-2 text-popover-foreground shadow-md"
                              >
                                <div className="space-y-1.5">
                                  <div className="font-semibold">
                                    {ZONE_HELP[z.key]?.title ?? z.key}
                                  </div>
                                  <div className="leading-relaxed text-muted-foreground">
                                    {ZONE_HELP[z.key]?.body ?? "Описание зоны пока не задано."}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {z.min}–{z.max} bpm · {Math.round((z.min / maxForBars) * 100)}–{Math.round((z.max / maxForBars) * 100)}%
                        </div>
                      </div>

                      {editing ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={inputNumberValue(draft[idx]?.min ?? z.min)}
                            onChange={(e) => updateZone(idx, "min", e.target.value)}
                            className="w-28"
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={inputNumberValue(draft[idx]?.max ?? z.max)}
                            onChange={(e) => updateZone(idx, "max", e.target.value)}
                            className="w-28"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 h-3 w-full rounded-full bg-muted">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          marginLeft: `${left}%`,
                          width: `${width}%`,
                          background: `linear-gradient(90deg, ${theme.bg}, ${theme.color})`,
                        }}
                        aria-label={`${z.key} range`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function EmptyZoneState({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full border bg-background text-3xl shadow-sm">
          {emoji}
        </div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
