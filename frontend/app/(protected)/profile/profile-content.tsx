// frontend/components/profile/profile-content.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Допускаем как «готовые» поля (age/gender/...) так и «сырые» из БД (birth_date/sex/...)
// чтобы компонент работал с разными вариантами page.tsx.
type ProfileInput = {
  // «готовые»
  age?: number | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  max_hr?: number | null;
  hr_zones?: any | null;

  // «сырые» из public.profiles
  birth_date?: string | null;
  sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  hr_max?: number | null;
};

type HRZoneObj = { z: number; min: number; max: number };
type HRZonesNormalized = { model: string; zones: HRZoneObj[] };

function computeAge(birthDate?: string | null) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(+d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function normalizeHrZones(raw: any): HRZonesNormalized | null {
  if (!raw) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.zones)) return null;
  const zones = obj.zones
    .map((z: any) => ({
      z: Number(z?.z),
      min: Number(z?.min),
      max: Number(z?.max),
    }))
    .filter((z: HRZoneObj) => Number.isFinite(z.z) && Number.isFinite(z.min) && Number.isFinite(z.max))
    .sort((a: HRZoneObj, b: HRZoneObj) => a.z - b.z);

  if (!zones.length) return null;
  return { model: String(obj.model || "default-5"), zones };
}

function pct(val: number, max?: number | null) {
  if (!max) return null;
  return Math.round((val / max) * 100);
}

function zoneWidth(min: number, max: number, top: number) {
  const span = Math.max(0, Math.min(top, max) - Math.max(0, min));
  if (top <= 0) return 0;
  return (span / top) * 100;
}

const ZONE_CLASSES = [
  "bg-emerald-400/80",
  "bg-teal-400/80",
  "bg-sky-400/80",
  "bg-indigo-400/80",
  "bg-fuchsia-500/80",
  "bg-rose-500/80",
  "bg-orange-500/80",
];

export default function ProfileContent({ profile }: { profile: ProfileInput }) {
  // Готовим данные: работаем и с готовыми, и с «сырыми» полями
  const age = profile.age ?? computeAge(profile.birth_date);
  const gender = profile.gender ?? profile.sex ?? null;
  const weight = profile.weight ?? profile.weight_kg ?? null;
  const height = profile.height ?? profile.height_cm ?? null;
  const maxHr = profile.max_hr ?? profile.hr_max ?? null;
  const zonesNorm = normalizeHrZones(profile.hr_zones);
  const topMax = maxHr ?? (zonesNorm ? Math.max(...zonesNorm.zones.map((z) => z.max)) : 0);

  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
        <TabsTrigger value="personal">Личные данные</TabsTrigger>
        <TabsTrigger value="account">Выход</TabsTrigger>
      </TabsList>

      {/* Личные данные */}
      <TabsContent value="personal">
        <Card>
          <CardHeader>
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Ваши персональные данные</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Label className="text-sm text-muted-foreground">Возраст</Label>
                <p className="text-base font-medium">{age ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Пол</Label>
                <p className="text-base font-medium">{gender ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Вес (кг)</Label>
                <p className="text-base font-medium">{weight ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Рост (см)</Label>
                <p className="text-base font-medium">{height ?? "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Макс. пульс</Label>
                <p className="text-base font-medium">{maxHr ?? "—"}</p>
              </div>

              {/* Пульсовые зоны — визуализация */}
              <div className="md:col-span-2">
                <Label className="text-sm text-muted-foreground">Пульсовые зоны</Label>
                {!zonesNorm ? (
                  <p className="text-base font-medium">—</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Модель: <span className="font-medium">{zonesNorm.model}</span>
                      {topMax ? <> · ЧССмакс: <span className="font-medium">{topMax}</span></> : null}
                    </div>

                    {/* ГОРИЗОНТАЛЬНЫЙ СТЕК */}
                    <div className="rounded-lg border p-3">
                      <div className="relative mb-2 h-4 w-full overflow-hidden rounded bg-muted">
                        <div className="absolute inset-0 flex">
                          {zonesNorm.zones.map((z) => {
                            const width = Math.max(0, Math.min(100, zoneWidth(z.min, z.max, topMax)));
                            const p1 = pct(z.min, topMax);
                            const p2 = pct(z.max, topMax);
                            const hint =
                              `Z${z.z}: ${z.min}–${z.max} уд/мин` +
                              (p1 != null && p2 != null ? ` (${p1}–${p2}%)` : "");
                            return (
                              <div
                                key={z.z}
                                className={[
                                  "h-full border-r last:border-r-0 border-border",
                                  ZONE_CLASSES[(z.z - 1) % ZONE_CLASSES.length],
                                ].join(" ")}
                                style={{ width: `${width}%` }}
                                title={hint}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0</span>
                        <span>{topMax}</span>
                      </div>
                    </div>

                    {/* ЛЕГЕНДА */}
                    <div className="rounded-lg border">
                      <div className="grid grid-cols-1 gap-0.5 p-3 sm:grid-cols-2">
                        {zonesNorm.zones.map((z) => {
                          const p1 = pct(z.min, topMax);
                          const p2 = pct(z.max, topMax);
                          const colorClass = ZONE_CLASSES[(z.z - 1) % ZONE_CLASSES.length];
                          return (
                            <div key={z.z} className="flex items-center gap-2 py-1">
                              <span className={`inline-block size-2 rounded-sm ${colorClass}`} />
                              <span className="text-sm font-medium">Z{z.z}</span>
                              <Separator orientation="vertical" className="mx-1 h-4" />
                              <span className="text-sm">
                                {z.min}–{z.max} уд/мин
                                {p1 != null && p2 != null ? (
                                  <span className="text-muted-foreground"> ({p1}–{p2}%)</span>
                                ) : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Выход */}
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Выход</CardTitle>
            <CardDescription>Завершите сессию и вернитесь на главную</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                const { createServerClient } = await import("@supabase/ssr");
                const { cookies } = await import("next/headers");
                const { redirect } = await import("next/navigation");

                const cookieStore = await cookies();
                const supabase = createServerClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                  {
                    cookies: {
                      getAll() {
                        return cookieStore.getAll();
                      },
                      setAll(cookiesToSet) {
                        try {
                          cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                          );
                        } catch {}
                      },
                    },
                  }
                );

                await supabase.auth.signOut();
                redirect("/");
              }}
            >
              <Button type="submit">Выйти из аккаунта</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}