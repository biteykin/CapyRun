// frontend/components/goals/GoalsEmptyState.tsx
"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, Flag, Target } from "lucide-react";

import logo from "@/app/icon-512.png";
import { Card, CardContent } from "@/components/ui/card";

export default function GoalsEmptyState() {
  return (
    <Card className="relative overflow-hidden border-dashed">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-200/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:32px_32px]"
        aria-hidden="true"
      />

      <CardContent className="relative flex min-h-[560px] flex-col items-center justify-center px-6 py-14 text-center">
        <div className="group relative mb-6">
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-gradient-to-br from-yellow-200 to-orange-300 opacity-60 blur-2xl"
            aria-hidden="true"
          />
          <div className="rounded-[28px] bg-background p-2 shadow-xl transition-transform duration-300 group-hover:scale-105">
            <Image
              src={logo}
              alt="CapyRun"
              width={112}
              height={112}
              priority
              className="-rotate-3 rounded-[22px] transition-transform duration-300 group-hover:rotate-0"
            />
          </div>
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Цель в прицеле
        </div>

        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          Пока ни одной цели
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Капибара уже разминается на старте. Поставьте цель — забег, регулярную форму или что-то своё — и план тренировок выстроится вокруг неё.
        </p>

        <div className="mt-8 grid w-full max-w-3xl gap-3 md:grid-cols-3">
          <EmptyAction
            href="/goals/onboarding?preset=race-5k"
            icon={<Flag className="h-5 w-5" />}
            title="Подготовка к забегу"
            description="10 км, полумарафон, марафон или трейл."
          />
          <EmptyAction
            href="/goals/onboarding?preset=vo2max"
            icon={<Activity className="h-5 w-5" />}
            title="Регулярная форма"
            description="Выносливость, сила, контроль веса."
          />
          <EmptyAction
            href="/goals/onboarding?preset=custom"
            icon={<Target className="h-5 w-5" />}
            title="Своя цель"
            description="Опишите цель словами — план подстроится."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-background/75 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-background hover:shadow-md"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-muted/30 transition group-hover:scale-110 group-hover:border-yellow-300 group-hover:bg-yellow-100">
        {icon}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </Link>
  );
}