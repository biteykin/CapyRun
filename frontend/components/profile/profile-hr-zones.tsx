// frontend/components/profile/profile-hr-zones.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Zone = {
  key: string; // Z1..Z5
  name: string;
  min: number;
  max: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function asNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Пытаемся распарсить hr_zones из БД максимально “терпимо”:
 * - массив [{min,max,name?}, ...]
 * - объект { z1:{min,max}, z2:{...} } или {Z1:{...}}
 * - если не получилось: fallback по % от HRmax
 */
function buildZones(hrMax: number | null, hrZonesRaw: any): Zone[] {
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

  // 1) array
  if (Array.isArray(hrZonesRaw) && hrZonesRaw.length) {
    const zones: Zone[] = hrZonesRaw
      .map((z: any, i: number) => {
        const min = asNumber(z?.min);
        const max = asNumber(z?.max);
        if (min == null || max == null) return null;

        const key = z?.key ? String(z.key) : `Z${i + 1}`;
        const name = z?.name ? String(z.name) : `Зона ${i + 1}`;
        return { key, name, min, max };
      })
      .filter(Boolean) as Zone[];

    if (zones.length) return zones;
  }

  // 2) object keyed zones
  if (hrZonesRaw && typeof hrZonesRaw === "object") {
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

export default function ProfileHrZones({
  maxHr,
  hrZones,
}: {
  maxHr?: number | null;
  hrZones?: unknown | null;
}) {
  const hrMax = maxHr != null ? Number(maxHr) : null;
  const zones = buildZones(hrMax, hrZones);
  const maxForBars = hrMax && hrMax > 0 ? hrMax : 200;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пульсовые зоны</CardTitle>
        <CardDescription>
          Диапазоны в BPM. Если зоны не заданы — считаем от HRmax.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hrMax ? (
          <div className="text-sm text-muted-foreground">
            Не задан HRmax — зоны не посчитать. Заполни «Макс. пульс» в профиле.
          </div>
        ) : zones.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Зоны отсутствуют и не удалось построить fallback.
          </div>
        ) : (
          <div className="space-y-2">
            {zones.map((z) => {
              const left = clamp((z.min / maxForBars) * 100, 0, 100);
              const right = clamp((z.max / maxForBars) * 100, 0, 100);
              const width = clamp(right - left, 0, 100);

              return (
                <div key={z.key} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {z.key} · {z.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {z.min}–{z.max} bpm
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {Math.round((z.min / hrMax) * 100)}–{Math.round((z.max / hrMax) * 100)}%
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ marginLeft: `${left}%`, width: `${width}%` }}
                      aria-label={`${z.key} range`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}