"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, PlusCircle, Sparkles, HeartPulse, Activity, LineChart } from "lucide-react";

interface WorkoutsEmptyStateProps {
  demoWorkoutId: string | null;
}

export default function WorkoutsEmptyState({ demoWorkoutId }: WorkoutsEmptyStateProps) {
  return (
    <main className="mx-auto max-w-3xl space-y-8">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Пока нет тренировок — давайте начнём! ✨</CardTitle>
          <CardDescription>
            Загрузите .fit/.gpx файл или добавьте тренировку вручную — и получите графики, метрики и инсайты уже через минуту.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="gap-1">
              <Activity className="h-3.5 w-3.5" /> Автосводка метрик
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <LineChart className="h-3.5 w-3.5" /> Графики темпа и ЧСС
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <HeartPulse className="h-3.5 w-3.5" /> Время по HR-зонам
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Заметки и файлы
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Загрузить файл</CardTitle>
                <CardDescription>.fit, .gpx и др.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Автоматически распознаём дистанцию, темп, пульс, круги — и строим визуализации.
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="gap-2">
                  <Link href="/workouts/upload">
                    <UploadCloud className="h-4 w-4" /> Загрузить файл
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Добавить вручную</CardTitle>
                <CardDescription>Без файла</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Быстрый ввод: вид спорта, время, дистанция, заметка — хватит, чтобы увидеть аналитику.
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="secondary" className="gap-2">
                  <Link href="/workouts/new">
                    <PlusCircle className="h-4 w-4" /> Добавить тренировку
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Показываем демо-блок только если есть демо-тренировка */}
          {demoWorkoutId && (
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    Хотите посмотреть, как всё выглядит?
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Откройте демо-тренировку с полным набором метрик.
                  </div>
                </div>
                <Button asChild variant="ghost">
                  <Link href={`/workouts/${demoWorkoutId}`}>
                    Посмотреть демо
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}