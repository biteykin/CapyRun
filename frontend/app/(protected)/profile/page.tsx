export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import ProfileHeader from "@/components/profile/profile-header";
import ProfileContent from "@/components/profile/profile-content";
import { differenceInYears } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // тянем профиль текущего пользователя
  const { data: prof } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_url, sex, birth_date, weight_kg, height_cm, hr_max, hr_zones"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // заголовок (аватар/имя/email)
  const displayName =
    (prof?.display_name && String(prof.display_name)) ||
    (user.user_metadata?.full_name && String(user.user_metadata.full_name)) ||
    "Спортивная Капибара";

  const avatarUrl =
    (prof?.avatar_url && String(prof.avatar_url)) ||
    (user.user_metadata?.avatar_url && String(user.user_metadata.avatar_url)) ||
    "/avatars/default-1.svg";

  // маппинг под ProfileContent
  const age =
    prof?.birth_date ? differenceInYears(new Date(), new Date(prof.birth_date)) : null;
  const profileData = {
    age,
    gender: prof?.sex ?? null,
    weight: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
    height: prof?.height_cm != null ? Number(prof.height_cm) : null,
    max_hr: prof?.hr_max ?? null,
    hr_zones: prof?.hr_zones ?? null,
  };

  // ---- НОРМАЛИЗАЦИЯ ЗОН (серверный расчёт, без хуков) ----
  type HrZone = { z: number; min?: number; max?: number };
  const zonesRaw: HrZone[] = Array.isArray((prof as any)?.hr_zones?.zones)
    ? (prof as any).hr_zones.zones
    : [];
  const hrMax: number | null =
    prof?.hr_max ??
    (zonesRaw.length ? Math.max(...zonesRaw.map((z) => Number(z.max ?? 0))) || null : null);

  const zonesNorm =
    hrMax && zonesRaw.length
      ? zonesRaw
          .filter((z) => typeof z.z === "number" && (z.min != null || z.max != null))
          .map((z) => {
            const min = Math.max(0, Math.min(Number(z.min ?? 0), Number(z.max ?? hrMax)));
            const max = Math.max(min, Math.min(Number(z.max ?? hrMax), Number(hrMax)));
            const pctMin = Math.round((min / hrMax) * 100);
            const pctMax = Math.round((max / hrMax) * 100);
            const widthPct = Math.max(2, pctMax - pctMin); // чтобы узкие зоны были видимы
            return { z: z.z, min, max, pctMin, pctMax, widthPct };
          })
          .sort((a, b) => a.z - b.z)
      : [];

  const palette = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-purple-500",
  ];

  return (
    <main className="space-y-6 px-4 py-10">
      <ProfileHeader
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={user.email ?? null}
      />
      <ProfileContent profile={profileData} />

      {/* Аккуратная карточка зон — рендерим только если зоны валидны */}
      {zonesNorm.length > 0 && hrMax && (
        <Card>
          <CardHeader>
            <CardTitle>Пульсовые зоны</CardTitle>
            <CardDescription>
              Модель: <span className="font-medium">{(prof as any)?.hr_zones?.model ?? "default-5"}</span>{" "}
              • Max HR: <span className="font-medium">{hrMax} bpm</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Полоса-сегменты */}
            <div className="w-full rounded-md border p-3">
              <div className="h-8 w-full rounded bg-muted relative overflow-hidden">
                {zonesNorm.map((z, idx) => (
                  <div
                    key={z.z}
                    className={`absolute top-0 h-full ${palette[idx % palette.length]}`}
                    style={{ left: `${z.pctMin}%`, width: `${z.widthPct}%` }}
                    title={`Z${z.z}: ${z.min}–${z.max} bpm (${z.pctMin}–${z.pctMax}% HRmax)`}
                    aria-label={`Зона Z${z.z}`}
                  />
                ))}
                <div className="absolute inset-0 flex justify-between text-[10px] text-muted-foreground px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Табличка */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {zonesNorm.map((z, idx) => (
                <div key={z.z} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded ${palette[idx % palette.length]}`} />
                    <div className="text-sm">
                      <div className="font-medium">Z{z.z}</div>
                      <div className="text-muted-foreground text-xs">
                        {z.min}–{z.max} bpm
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {z.pctMin}%–{z.pctMax}% HRmax
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}