//frontend/components/profile/profile-edit-form.client.tsx

"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import Cropper from "react-easy-crop";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  ChevronsUpDown,
  Minus,
  MapPin,
  PersonStanding,
  Plus,
  Ruler,
  Save,
  User,
  Weight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  findCountryCodeByLabel,
  getCountryLabel,
  getCountryOptions,
} from "@/components/profile/country-options";
import {
  ALL_PRESET_AVATARS,
  DEFAULT_AVATAR,
  FEMALE_AVATARS,
  MALE_AVATARS,
} from "@/components/profile/avatar-presets";

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
  mode = "profile",
  onSaved,
}: {
  initial: InitialProfile;
  email: string | null;
  mode?: "profile" | "onboarding";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const isOnboarding = mode === "onboarding";
  const countryOptions = React.useMemo(() => getCountryOptions(), []);
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [avatarPanel, setAvatarPanel] = React.useState<"none" | "presets" | "upload">("none");

  const [displayName, setDisplayName] = React.useState(initial.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatar_url ?? "");
  const [sex, setSex] = React.useState(initial.sex ?? "");
  const [birthDate, setBirthDate] = React.useState(initial.birth_date ?? "");
  const [age, setAge] = React.useState(() => {
    if (!initial.birth_date) return "";
    const d = new Date(initial.birth_date);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const hadBirthday =
      now.getMonth() > d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
    if (!hadBirthday) years -= 1;
    return years > 0 ? String(years) : "";
  });
  const [heightCm, setHeightCm] = React.useState(initial.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = React.useState(initial.weight_kg?.toString() ?? "");
  const [countryInput, setCountryInput] = React.useState(getCountryLabel(initial.country_code));
  const [countryCode, setCountryCode] = React.useState(initial.country_code?.toUpperCase() ?? "");
  const [city, setCity] = React.useState(initial.city ?? "");

  const [saving, setSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropImageSrc, setCropImageSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<AreaPixels | null>(null);

  const avatarSrc = avatarUrl.trim() || DEFAULT_AVATAR;
  const displayNameFallback = (displayName.trim()?.[0] ?? "U").toUpperCase();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const normalizedInitialCountryCode = (initial.country_code ?? "").toUpperCase();
  const normalizedCurrentCountryCode =
    findCountryCodeByLabel(countryInput) ?? (countryCode ? countryCode.toUpperCase() : "");

  const isDirty = React.useMemo(() => {
    return (
      (displayName.trim() || "") !== (initial.display_name ?? "") ||
      (avatarUrl.trim() || "") !== (initial.avatar_url ?? "") ||
      (sex.trim() || "") !== (initial.sex ?? "") ||
      (birthDate.trim() || "") !== (initial.birth_date ?? "") ||
      (heightCm.trim() || "") !==
        (initial.height_cm != null ? String(initial.height_cm) : "") ||
      (weightKg.trim() || "") !==
        (initial.weight_kg != null ? String(initial.weight_kg) : "") ||
      normalizedCurrentCountryCode !== normalizedInitialCountryCode ||
      (city.trim() || "") !== (initial.city ?? "")
    );
  }, [
    avatarUrl,
    birthDate,
    city,
    displayName,
    heightCm,
    initial.avatar_url,
    initial.birth_date,
    initial.city,
    initial.display_name,
    initial.height_cm,
    initial.sex,
    initial.weight_kg,
    normalizedCurrentCountryCode,
    normalizedInitialCountryCode,
    sex,
    weightKg,
  ]);

  const presetAvatars = React.useMemo(() => {
    if (sex === "female") {
      return {
        recommended: FEMALE_AVATARS,
        others: MALE_AVATARS,
      };
    }
    if (sex === "male") {
      return {
        recommended: MALE_AVATARS,
        others: FEMALE_AVATARS,
      };
    }
    return {
      recommended: ALL_PRESET_AVATARS.filter((src) => src !== DEFAULT_AVATAR),
      others: [] as string[],
    };
  }, [sex]);

  const toNumOrNull = (v: string) => {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  function deriveBirthDateFromAge(ageValue: string, prevBirthDate?: string | null) {
    const ageNum = Number(ageValue);
    if (!Number.isFinite(ageNum) || ageNum <= 0) return null;

    const now = new Date();
    const year = now.getFullYear() - ageNum;

    let month = 1;
    let day = 1;

    if (prevBirthDate) {
      const prev = new Date(prevBirthDate);
      if (!Number.isNaN(prev.getTime())) {
        month = prev.getMonth() + 1;
        day = prev.getDate();
      }
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  async function onUploadAvatar(file: File) {
    if (!file) return;
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      setError("Файл слишком большой. Максимум 2 MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Поддерживаются только JPG, PNG и WEBP.");
      return;
    }

    setError(null);
    if (success) setSuccess(null);
    setUploadingAvatar(true);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${initial.user_id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${safeExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("Не удалось получить ссылку на аватар.");

      setAvatarUrl(publicUrl);
      if (success) setSuccess(null);
      setAvatarPanel("upload");
      setSuccess("Новый аватар загружен. Не забудьте сохранить профиль.");
    } catch (e: unknown) {
      console.error("avatar upload error", e);
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось загрузить аватар. Проверьте, что в Supabase Storage создан bucket avatars."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function openCropper(file: File) {
    const MAX_SIZE = 2 * 1024 * 1024;
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Поддерживаются только JPG, PNG и WEBP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Файл слишком большой. Максимум 2 MB.");
      return;
    }

    setError(null);
    if (success) setSuccess(null);

    const src = await readFileAsDataUrl(file);
    setCropImageSrc(src);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropOpen(true);
  }

  async function confirmCropAndUpload() {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      setUploadingAvatar(true);
      setError(null);
      const croppedFile = await createCroppedAvatarFile(cropImageSrc, croppedAreaPixels);
      setCropOpen(false);
      await onUploadAvatar(croppedFile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось обработать изображение.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSave() {
    if (saving || (!isDirty && !isOnboarding)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const normalizedCountryCode =
        findCountryCodeByLabel(countryInput) ??
        (countryCode ? countryCode.toUpperCase() : null);

      const resolvedBirthDate = isOnboarding
        ? deriveBirthDateFromAge(age, initial.birth_date)
        : birthDate.trim() || null;

      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null;

      const payload: Record<string, unknown> = {
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        sex: sex.trim() || null,
        birth_date: resolvedBirthDate,
        height_cm: toNumOrNull(heightCm),
        weight_kg: toNumOrNull(weightKg),
        country_code: normalizedCountryCode,
        city: city.trim() || null,
        timezone,
        updated_at: new Date().toISOString(),
      };

      if (isOnboarding) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("onboarding")
          .eq("user_id", initial.user_id)
          .maybeSingle();

        payload.onboarding = {
          ...((currentProfile?.onboarding as Record<string, any> | null) ?? {}),
          status: "in_progress",
          step: "goal",
          profile_done: true,
          completed_steps: ["profile"],
          updated_at: new Date().toISOString(),
        };
      }

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

      if (isOnboarding) {
        onSaved?.();
        router.push("/onboarding?step=goal");
        router.refresh();
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch (e: unknown) {
      console.error("profile save error", e);
      setError(e instanceof Error ? e.message : "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  }

  async function skipOnboarding() {
    if (!isOnboarding || saving) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("onboarding")
        .eq("user_id", initial.user_id)
        .maybeSingle();

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          onboarding_completed_at: now,
          onboarding: {
            ...((currentProfile?.onboarding as Record<string, any> | null) ?? {}),
            status: "skipped",
            skipped_at: now,
            completed_at: now,
            updated_at: now,
          },
          updated_at: now,
        })
        .eq("user_id", initial.user_id);

      if (upErr) throw upErr;

      router.push("/home");
      router.refresh();
    } catch (e: unknown) {
      console.error("onboarding skip error", e);
      setError(e instanceof Error ? e.message : "Не удалось пропустить онбординг.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {isOnboarding ? "Расскажите о себе" : "Редактировать профиль"}
          </h1>
          {isOnboarding ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Эти данные нужны AI-тренеру, чтобы учитывать ваш возраст, параметры и локацию при подборе нагрузки, восстановлении и составлении программы тренировок.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isOnboarding ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void skipOnboarding()}
              disabled={saving}
            >
              Пропустить
            </Button>
          ) : null}
          {!isOnboarding ? (
            <Button type="button" variant="secondary" onClick={() => router.push("/profile")}>
              Назад к профилю
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || (!isDirty && !isOnboarding)}
          >
            {!isOnboarding ? <Save className="mr-2 size-4" /> : null}
            {saving ? "Сохраняем…" : isOnboarding ? "Далее" : "Сохранить"}
          </Button>
        </div>
      </div>

      <Card className="w-full overflow-hidden">
        <CardContent className="space-y-6">
          <section className="space-y-4">
            <div className="rounded-2xl border bg-muted/10 p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="h-16 w-16 shrink-0 ring-2 ring-background shadow-sm">
                    <AvatarImage src={avatarSrc} alt="Profile avatar preview" />
                    <AvatarFallback className="text-lg">{displayNameFallback}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">
                      {displayName.trim() || "Без имени"}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {email ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={avatarPanel === "presets" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() =>
                      setAvatarPanel((prev) => (prev === "presets" ? "none" : "presets"))
                    }
                  >
                    Готовые аватары
                  </Button>
                  <Button
                    type="button"
                    variant={avatarPanel === "upload" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setAvatarPanel("upload");
                      fileInputRef.current?.click();
                    }}
                  >
                    Загрузить свой
                  </Button>
                </div>
              </div>
            </div>

            {avatarPanel === "presets" ? (
              <div className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Выбор аватара</div>
                    <div className="text-sm text-muted-foreground">
                      Можно выбрать один из стандартных аватаров CapyRun
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAvatarPanel("none")}
                  >
                    Скрыть
                  </Button>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Базовый</div>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
                    <AvatarPresetItem
                      src={DEFAULT_AVATAR}
                      selected={avatarUrl === DEFAULT_AVATAR || !avatarUrl}
                      onSelect={setAvatarUrl}
                      fallback={displayNameFallback}
                    />
                  </div>
                </div>

                {presetAvatars.recommended.length > 0 ? (
                  <div className="mb-4">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Рекомендуемые</div>
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
                      {presetAvatars.recommended.map((src) => (
                        <AvatarPresetItem
                          key={src}
                          src={src}
                          selected={avatarUrl === src}
                          onSelect={setAvatarUrl}
                          fallback={displayNameFallback}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {presetAvatars.others.length > 0 ? (
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Другие</div>
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
                      {presetAvatars.others.map((src) => (
                        <AvatarPresetItem
                          key={src}
                          src={src}
                          selected={avatarUrl === src}
                          onSelect={setAvatarUrl}
                          fallback={displayNameFallback}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void openCropper(file);
                e.currentTarget.value = "";
              }}
            />
          </section>

          <FormSection
            title="Основное"
            description="Базовая информация о пользователе"
            icon={<User className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Имя" htmlFor="display_name">
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => {
                    if (success) setSuccess(null);
                    setDisplayName(e.target.value);
                  }}
                  placeholder="Например: Иван"
                />
              </FieldBlock>

              <FieldBlock label="Email" htmlFor="email">
                <Input
                  id="email"
                  value={email ?? ""}
                  readOnly
                  disabled
                  placeholder="Email не указан"
                />
              </FieldBlock>

              <FieldBlock label="Пол" htmlFor="sex">
                <Select
                  value={sex || "unspecified"}
                  onValueChange={(v) => {
                    if (success) setSuccess(null);
                    setSex(v === "unspecified" ? "" : v);
                  }}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Выберите пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Не указывать</SelectItem>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                  </SelectContent>
                </Select>
              </FieldBlock>

              {isOnboarding ? (
                <FieldBlock label="Возраст" htmlFor="age">
                  <Input
                    id="age"
                    type="number"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(e) => {
                      if (success) setSuccess(null);
                      setAge(e.target.value);
                    }}
                    placeholder="Например: 34"
                  />
                </FieldBlock>
              ) : (
                <FieldBlock label="Дата рождения" htmlFor="birth_date">
                  <Input
                    id="birth_date"
                    type="date"
                    value={birthDate}
                    onChange={(e) => {
                      if (success) setSuccess(null);
                      setBirthDate(e.target.value);
                    }}
                  />
                </FieldBlock>
              )}
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
                  onChange={(e) => {
                    if (success) setSuccess(null);
                    setHeightCm(e.target.value);
                  }}
                  placeholder="183"
                />
              </FieldBlock>

              <FieldBlock label="Вес (кг)" htmlFor="weight_kg" icon={<Weight className="size-4" />}>
                <Input
                  id="weight_kg"
                  type="number"
                  inputMode="decimal"
                  value={weightKg}
                  onChange={(e) => {
                    if (success) setSuccess(null);
                    setWeightKg(e.target.value);
                  }}
                  placeholder="75"
                />
              </FieldBlock>
            </div>
          </FormSection>

          <FormSection
            title="Локация"
            description="Часовой пояс точнее определяется по городу, а страна помогает с локализацией"
            icon={<MapPin className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldBlock label="Страна" htmlFor="country_code">
                <div className="space-y-2">
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="country_code"
                        type="button"
                        variant="secondary"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {countryInput || "Выберите страну"}
                        </span>
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Введите страну..." />
                        <CommandList>
                          <CommandEmpty>Страна не найдена</CommandEmpty>
                          <CommandGroup>
                            {countryOptions.map((country) => (
                              <CommandItem
                                key={country.code}
                                value={`${country.name} ${country.code}`}
                                onSelect={() => {
                                  if (success) setSuccess(null);
                                  setCountryInput(country.name);
                                  setCountryCode(country.code);
                                  setCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    countryCode === country.code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{country.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="text-xs text-muted-foreground">
                    Сохраним как код страны{countryCode ? `: ${countryCode}` : ""}
                  </div>
                </div>
              </FieldBlock>

              <FieldBlock label="Город" htmlFor="city">
                <div className="space-y-2">
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => {
                      if (success) setSuccess(null);
                      setCity(e.target.value);
                    }}
                    placeholder="Москва"
                  />
                  <div className="text-xs text-muted-foreground">
                    Для определения локального времени город полезнее, чем одна только страна
                  </div>
                </div>
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

          <div className="flex items-center justify-end gap-2 pt-4">
            {isOnboarding ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void skipOnboarding()}
                disabled={saving}
              >
                Пропустить
              </Button>
            ) : null}
            {!isOnboarding ? (
              <Button type="button" variant="secondary" onClick={() => router.push("/profile")}>
                Отмена
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || (!isDirty && !isOnboarding)}
            >
              {!isOnboarding ? <Save className="mr-2 size-4" /> : null}
              {saving ? "Сохраняем…" : isOnboarding ? "Далее" : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {cropOpen && cropImageSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="text-base font-semibold">Обрезать аватар</div>
                <div className="text-sm text-muted-foreground">
                  Выберите квадратную область. В профиль загрузится уже готовый аватар.
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCropOpen(false);
                  setCropImageSrc(null);
                }}
              >
                Закрыть
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="relative h-[420px] overflow-hidden rounded-2xl bg-black">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={true}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Minus className="size-4 text-muted-foreground" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
                <Plus className="size-4 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCropOpen(false);
                    setCropImageSrc(null);
                  }}
                >
                  Отмена
                </Button>
                <Button type="button" onClick={() => void confirmCropAndUpload()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? "Сохраняем…" : "Обрезать и загрузить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AreaPixels = {
  width: number;
  height: number;
  x: number;
  y: number;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать файл.")));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение."));
    image.src = src;
  });
}

async function createCroppedAvatarFile(imageSrc: string, crop: AreaPixels) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas не поддерживается.");

  const OUTPUT_SIZE = 512;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );

  if (!blob) throw new Error("Не удалось подготовить аватар.");

  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
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

function AvatarPresetItem({
  src,
  selected,
  onSelect,
  fallback,
}: {
  src: string;
  selected: boolean;
  onSelect: (src: string) => void;
  fallback: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(src)}
      className={cn(
        "group rounded-2xl border p-2 transition",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-background hover:bg-muted/20"
      )}
    >
      <Avatar className="mx-auto h-14 w-14">
        <AvatarImage src={src} alt="Preset avatar" />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
    </button>
  );
}
