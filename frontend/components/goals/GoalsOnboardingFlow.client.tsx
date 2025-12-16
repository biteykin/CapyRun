"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseBrowser";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type GoalsOnboardingFlowProps = {
  /** Режим использования:
   *  - "initial" — первый заход, приветственный текст
   *  - "add-more" — добавление новых целей позже
   */
  mode?: "initial" | "add-more";
  /** Колбэк после успешного сохранения целей */
  onFinished?: () => void;
};

type PresetId =
  | "regular"
  | "weight"
  | "race-5k"
  | "race-10k"
  | "race-hm"
  | "race-marathon"
  | "start";

type Step = 1 | 2 | 3;

const PRESETS: {
  id: PresetId;
  title: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: "regular",
    title: "Регулярные тренировки",
    emoji: "📆",
    description: "Хочу стабильно заниматься 3–4 раза в неделю и не бросать.",
  },
  {
    id: "weight",
    title: "Снижение веса",
    emoji: "⚖️",
    description: "Минус лишние килограммы без жёстких диет и перегрузок.",
  },
  {
    id: "race-5k",
    title: "Забег 5 км",
    emoji: "5️⃣",
    description: "Подготовиться к лёгкому старту на 5 км.",
  },
  {
    id: "race-10k",
    title: "Забег 10 км",
    emoji: "🔟",
    description: "Комфортно пробежать десятку, не умерев по пути.",
  },
  {
    id: "race-hm",
    title: "Полумарафон",
    emoji: "🏅",
    description: "Подготовиться к полумарафону и добежать в удовольствие.",
  },
  {
    id: "race-marathon",
    title: "Марафон",
    emoji: "🏃‍♂️",
    description: "Большая цель — марафон. Готов работать системно.",
  },
  {
    id: "start",
    title: "Просто начать",
    emoji: "✨",
    description: "Хочу сдвинуться с мёртвой точки и понять, с чего начать.",
  },
];

export default function GoalsOnboardingFlow({
  mode = "initial",
  onFinished,
}: GoalsOnboardingFlowProps) {
  const [step, setStep] = React.useState<Step>(1);

  const [selectedPresets, setSelectedPresets] = React.useState<PresetId[]>([]);
  const [primaryGoal, setPrimaryGoal] = React.useState("");
  const [secondaryGoals, setSecondaryGoals] = React.useState("");

  const [gender, setGender] = React.useState<"male" | "female" | "other" | "">(
    ""
  );
  const [age, setAge] = React.useState<string>("");
  const [heightCm, setHeightCm] = React.useState<string>("");
  const [weightKg, setWeightKg] = React.useState<string>("");
  const [experience, setExperience] = React.useState<string>("");

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isInitial = mode === "initial";

  const togglePreset = (id: PresetId) => {
    setSelectedPresets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const canGoNextFromStep1 =
    selectedPresets.length > 0 || primaryGoal.trim().length > 5;

  const canSaveFromStep2 =
    canGoNextFromStep1 &&
    gender &&
    age.trim() !== "" &&
    heightCm.trim() !== "" &&
    weightKg.trim() !== "";

  async function handleSave() {
    if (isSaving || !canSaveFromStep2) return;
    setIsSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) {
        throw new Error("Пользователь не авторизован");
      }

      const today = new Date();
      const fromStr = today.toISOString().slice(0, 10);
      const to = new Date(today);
      to.setMonth(to.getMonth() + 3);
      const toStr = to.toISOString().slice(0, 10);

      const title = primaryGoal.trim() || "Мои цели на ближайшие 3 месяца";

      const targetJson = {
        primary: primaryGoal.trim() || null,
        secondary: secondaryGoals.trim() || null,
        presets: selectedPresets,
        profile: {
          gender: gender || null,
          age: age ? Number(age) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          experience: experience.trim() || null,
        },
      };

      const { error: insertErr } = await supabase.from("goals").insert({
        user_id: user.id,
        title,
        type: "custom", // из enum plan_goal_type
        sport: null, // пока не фиксируем конкретный спорт
        date_from: fromStr,
        date_to: toStr,
        status: "active", // из enum plan_status
        target_json: targetJson,
      });

      if (insertErr) throw insertErr;

      setStep(3);
      onFinished?.();
    } catch (e: any) {
      console.error("goals onboarding save error", e);
      setError(
        e?.message ||
          "Не получилось сохранить цели. Попробуй ещё раз или чуть позже."
      );
    } finally {
      setIsSaving(false);
    }
  }

  // --- Рендер шагов ---

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <CardTitle>
            {isInitial ? "Какие цели тебе ближе всего?" : "Добавим новые цели"}
          </CardTitle>
          <CardDescription>
            Выбери одну или несколько целей — или напиши свою. На основе
            этого тренер будет строить план.
          </CardDescription>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PRESETS.map((p) => {
            const active = selectedPresets.includes(p.id);

            return (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer transition-all",
                  active
                    ? "border-primary shadow-md bg-card"
                    : "hover:border-muted-foreground/40 bg-card"
                )}
                onClick={() => togglePreset(p.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-xl">{p.emoji}</div>
                    <div>
                      <CardTitle className="text-sm">{p.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {p.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryGoal">Своя формулировка цели (опционально)</Label>
          <Textarea
            id="primaryGoal"
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value)}
            rows={3}
            placeholder="Например: «Хочу к маю спокойно пробегать 10 км и чувствовать себя бодро»"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            disabled={!canGoNextFromStep1}
            onClick={() => setStep(2)}
          >
            Далее
          </Button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <CardTitle>Параметры о тебе</CardTitle>
          <CardDescription>
            Эти данные нужны, чтобы тренер подбирал адекватную нагрузку и
            темпы.
          </CardDescription>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Пол</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={gender === "male" ? "primary" : "outline"}
                size="sm"
                onClick={() => setGender("male")}
              >
                Мужской
              </Button>
              <Button
                type="button"
                variant={gender === "female" ? "primary" : "outline"}
                size="sm"
                onClick={() => setGender("female")}
              >
                Женский
              </Button>
              <Button
                type="button"
                variant={gender === "other" ? "primary" : "outline"}
                size="sm"
                onClick={() => setGender("other")}
              >
                Другое
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">Возраст</Label>
            <Input
              id="age"
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Например: 34"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Рост (см)</Label>
            <Input
              id="height"
              type="number"
              min={120}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Например: 178"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Вес (кг)</Label>
            <Input
              id="weight"
              type="number"
              min={35}
              max={200}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Например: 79"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondary">
            Есть ли уже опыт тренировок / стартов?
          </Label>
          <Textarea
            id="secondary"
            value={secondaryGoals}
            onChange={(e) => setSecondaryGoals(e.target.value)}
            rows={3}
            placeholder="Например: «Раньше бегал 5 км по выходным, сейчас выпал из режима на пару месяцев»"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience">
            Что важно учесть (график работы, здоровье, ограничения)?
          </Label>
          <Textarea
            id="experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            rows={3}
            placeholder="Например: «Сидячая работа, 2 маленьких ребёнка, колено иногда побаливает после долгих пробежек»"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500">
            {error}
          </p>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(1)}
          >
            Назад
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSaveFromStep2 || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Сохраняем…" : "Сохранить цели"}
          </Button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-4 text-center">
        <CardTitle>Готово 🎯</CardTitle>
        <CardDescription>
          Мы зафиксировали твои цели и базовые параметры. Теперь тренер
          сможет строить план и давать комментарии с учётом именно тебя.
        </CardDescription>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            Дальше ты можешь перейти к <strong>календарю тренировок</strong> или
            сразу написать <strong>тренеру</strong>.
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onFinished?.()}
          >
            Продолжить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full">
      <Card
        className={cn(
          "flex h-full flex-col border bg-card text-card-foreground shadow-sm rounded-xl"
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>
                {isInitial ? "Поможем настроить цели" : "Обновление целей"}
              </CardTitle>
              <CardDescription>
                2 коротких шага — и тренер будет лучше понимать, куда ты хочешь прийти.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all",
                    step === i
                      ? "bg-[color:var(--btn-primary-main,#E58B21)]"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="w-full">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </CardContent>

        <CardFooter className="justify-end text-[11px] text-muted-foreground">
          Цели всегда можно будет скорректировать позже.
        </CardFooter>
      </Card>
    </section>
  );
}