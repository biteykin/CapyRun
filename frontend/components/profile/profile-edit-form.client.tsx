"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InitialProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  sex: string | null; // male/female/other/null
  birth_date: string | null; // YYYY-MM-DD
  height_cm: number | null;
  weight_kg: number | null;
  hr_rest: number | null;
  hr_max: number | null;
  country_code: string | null;
  city: string | null;
};

export default function ProfileEditForm({
  initial,
  email,
}: {
  initial: InitialProfile;
  email: string | null;
}) {
  const router = useRouter();

  const [displayName, setDisplayName] = React.useState(initial.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatar_url ?? "");
  const [sex, setSex] = React.useState(initial.sex ?? "");
  const [birthDate, setBirthDate] = React.useState(initial.birth_date ?? "");
  const [heightCm, setHeightCm] = React.useState(initial.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = React.useState(initial.weight_kg?.toString() ?? "");
  const [hrRest, setHrRest] = React.useState(initial.hr_rest?.toString() ?? "");
  const [hrMax, setHrMax] = React.useState(initial.hr_max?.toString() ?? "");
  const [countryCode, setCountryCode] = React.useState(initial.country_code ?? "");
  const [city, setCity] = React.useState(initial.city ?? "");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const toNumOrNull = (v: string) => {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        sex: sex.trim() || null,
        birth_date: birthDate.trim() || null,
        height_cm: toNumOrNull(heightCm),
        weight_kg: toNumOrNull(weightKg),
        hr_rest: toNumOrNull(hrRest),
        hr_max: toNumOrNull(hrMax),
        country_code: countryCode.trim() || null,
        city: city.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // важное: убираем NaN, чтобы Postgres не ругался
      for (const k of Object.keys(payload)) {
        if (typeof payload[k] === "number" && Number.isNaN(payload[k])) payload[k] = null;
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", initial.user_id);

      if (upErr) throw upErr;

      setSuccess("Сохранено.");
      // вернёмся на профиль и обновим серверные данные
      router.push("/profile");
      router.refresh();
    } catch (e: any) {
      console.error("profile save error", e);
      setError(e?.message ?? "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Редактирование профиля</CardTitle>
        <CardDescription>
          Обновите личные данные и базовые параметры. Email:{" "}
          <span className="font-medium">{email ?? "—"}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display_name">Имя</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Например: Иван"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar_url">Аватар (URL/путь)</Label>
            <Input
              id="avatar_url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="/avatars/male/male-01.svg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Пол</Label>
            <Input
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              placeholder="male / female / other"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">Дата рождения</Label>
            <Input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height_cm">Рост (см)</Label>
            <Input
              id="height_cm"
              type="number"
              inputMode="numeric"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="183"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight_kg">Вес (кг)</Label>
            <Input
              id="weight_kg"
              type="number"
              inputMode="numeric"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="75"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hr_rest">Пульс в покое</Label>
            <Input
              id="hr_rest"
              type="number"
              inputMode="numeric"
              value={hrRest}
              onChange={(e) => setHrRest(e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hr_max">Макс. пульс</Label>
            <Input
              id="hr_max"
              type="number"
              inputMode="numeric"
              value={hrMax}
              onChange={(e) => setHrMax(e.target.value)}
              placeholder="199"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country_code">Страна (код)</Label>
            <Input
              id="country_code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              placeholder="RU"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Город</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Москва"
            />
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {success && <div className="text-sm text-emerald-700">{success}</div>}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/profile")}>
            Отмена
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

