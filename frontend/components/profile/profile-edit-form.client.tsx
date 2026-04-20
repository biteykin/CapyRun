"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HeartPulse,
  MapPin,
  PersonStanding,
  Ruler,
  Save,
  User,
  Weight,
} from "lucide-react";

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

  const avatarSrc = avatarUrl.trim() || "/avatars/default-1.svg";
  const displayNameFallback = (displayName.trim()[0] ?? "U").toUpperCase();
  const sexSelectValue =
    sex === "male" || sex === "female" || sex === "other" ? sex : "unspecified";

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
      const payload: Record<string, unknown> = {
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

      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (typeof v === "number" && Number.isNaN(v)) payload[k] = null;
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", initial.user_id);

      if (upErr) throw upErr;

      setSuccess("Сохранено.");
      router.push("/profile");
      router.refresh();
    } catch (e: unknown) {
      console.error("profile save error", e);
      setError(e instanceof Error ? e.message : "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Профиль спортсмена</div>
          <h1 className="text-2xl font-extrabold">Редактировать профиль</h1>
        </div>
        <Button type="button" variant="secondary" onClick={() => router.push("/profile")}>
          Назад к профилю
        </Button>
      </div>

      <Card className="w-full overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-sm">
              <AvatarImage src={avatarSrc} alt="Profile avatar" />
              <AvatarFallback className="text-xl">{displayNameFallback}</AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <CardTitle>Данные профиля</CardTitle>
              <CardDescription>
                Обновите личные данные и базовые параметры. Email:{" "}
                <span className="font-medium">{email ?? "—"}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <FormSection
            title="Основное"
            description="Имя, аватар и базовая информация о пользователе"
            icon={<User className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Имя" htmlFor="display_name">
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Например: Иван"
                />
              </FieldBlock>

              <FieldBlock label="Аватар (URL/путь)" htmlFor="avatar_url">
                <Input
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="/avatars/male/male-01.svg"
                />
              </FieldBlock>

              <FieldBlock label="Пол" htmlFor="sex">
                <Select
                  value={sexSelectValue}
                  onValueChange={(v) => setSex(v === "unspecified" ? "" : v)}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Выберите пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Не указывать</SelectItem>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                    <SelectItem value="other">Другой</SelectItem>
                  </SelectContent>
                </Select>
              </FieldBlock>

              <FieldBlock label="Дата рождения" htmlFor="birth_date">
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Параметры тела"
            description="Эти значения помогают точнее считать показатели и строить рекомендации"
            icon={<PersonStanding className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Рост (см)" htmlFor="height_cm" icon={<Ruler className="size-4" />}>
                <Input
                  id="height_cm"
                  type="number"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="183"
                />
              </FieldBlock>

              <FieldBlock label="Вес (кг)" htmlFor="weight_kg" icon={<Weight className="size-4" />}>
                <Input
                  id="weight_kg"
                  type="number"
                  inputMode="decimal"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="75"
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Пульс"
            description="Используется для зон, нагрузки и тренировочных рекомендаций"
            icon={<HeartPulse className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Пульс в покое" htmlFor="hr_rest">
                <Input
                  id="hr_rest"
                  type="number"
                  inputMode="numeric"
                  value={hrRest}
                  onChange={(e) => setHrRest(e.target.value)}
                  placeholder="50"
                />
              </FieldBlock>

              <FieldBlock label="Макс. пульс" htmlFor="hr_max">
                <Input
                  id="hr_max"
                  type="number"
                  inputMode="numeric"
                  value={hrMax}
                  onChange={(e) => setHrMax(e.target.value)}
                  placeholder="199"
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Локация"
            description="Нужно для локального контекста и будущих сценариев по времени и региону"
            icon={<MapPin className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Страна (код)" htmlFor="country_code">
                <Input
                  id="country_code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="RU"
                  maxLength={2}
                />
              </FieldBlock>

              <FieldBlock label="Город" htmlFor="city">
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Москва"
                />
              </FieldBlock>
            </div>
          </FormSection>

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={() => router.push("/profile")}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              <Save className="mr-2 size-4" />
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          <span>{title}</span>
        </div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {children}
    </section>
  );
}

function FieldBlock({
  label,
  htmlFor,
  icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-2xl border bg-muted/10 p-4">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </Label>
      {children}
    </div>
  );
}
