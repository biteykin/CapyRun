import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import GoalsOnboarding from "@/components/goals/GoalsOnboarding.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GoalRow = {
  id: string;
  title: string;
  type: string;
  sport: string | null;
  date_from: string;
  date_to: string;
  status: string;
  target_json: any | null;
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeLabel(type: string) {
  switch (type) {
    case "10k":
      return "Забег 10 км";
    case "HM":
      return "Полумарафон";
    case "M":
      return "Марафон";
    case "trail":
      return "Трейл / горный старт";
    case "ride":
      return "Вело";
    case "swim":
      return "Плавание";
    case "strength":
      return "Силовая / ОФП";
    case "weight":
      return "Цель по весу";
    case "vo2max":
      return "Выносливость / VO₂max";
    case "custom":
    default:
      return "Другая цель";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "active":
      return "Активна";
    case "paused":
      return "На паузе";
    case "completed":
      return "Завершена";
    case "canceled":
      return "Отменена";
    default:
      return status || "—";
  }
}

function sportLabel(sport: string | null) {
  switch (sport) {
    case "run":
      return "Бег";
    case "ride":
      return "Вело";
    case "swim":
      return "Плавание";
    case "walk":
      return "Ходьба";
    case "hike":
      return "Походы";
    case "row":
      return "Гребля";
    case "strength":
      return "Силовые";
    case "yoga":
      return "Йога";
    case "aerobics":
      return "Аэробика";
    case "crossfit":
      return "Кроссфит";
    case "pilates":
      return "Пилатес";
    case "other":
      return "Другое";
    default:
      return sport ?? "—";
  }
}

export default async function GoalsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent("/goals")}`
      );
    }
    redirect("/login");
  }

  const { data: rows, error } = await supabase
    .from("goals")
    .select(
      `
        id,
        title,
        type,
        sport,
        date_from,
        date_to,
        status,
        target_json
      `
    )
    .eq("user_id", user.id)
    .order("date_from", { ascending: true });

  if (error) {
    console.error("goals error", error);
  }

  const goals: GoalRow[] = rows ?? [];

  return (
    <main className="w-full space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold">Цели</h1>
        <p className="text-sm text-muted-foreground">
          Расскажите, к чему хотите прийти — тренировки и планы будут строиться вокруг ваших целей.
        </p>
      </header>

      {goals.length === 0 && (
        <section className="space-y-4">
          <div className="rounded-xl border bg-muted/30 px-4 py-4">
            <h2 className="text-base font-semibold mb-1">
              Давайте выберем ваши цели
            </h2>
            <p className="text-sm text-muted-foreground">
              Можно выбрать готовые варианты (регулярные тренировки, снижение веса,
              подготовка к старту) или задать свои параметры для гонки.
            </p>
          </div>
          <GoalsOnboarding />
        </section>
      )}

      {goals.length > 0 && (
        <section className="space-y-3">
          {goals.map((g) => (
            <article
              key={g.id}
              className="rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold leading-tight">
                    {g.title || typeLabel(g.type)}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{typeLabel(g.type)}</span>
                    {g.sport && <span>• {sportLabel(g.sport)}</span>}
                    <span>• {statusLabel(g.status)}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground text-right sm:mt-0">
                  <div>
                    {formatDate(g.date_from)} – {formatDate(g.date_to)}
                  </div>
                </div>
              </div>

              {g.target_json && (
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  {"distance_km" in g.target_json && (
                    <div>
                      Дистанция: {g.target_json.distance_km} км
                    </div>
                  )}
                  {"race_date" in g.target_json && (
                    <div>
                      Старт: {formatDate(g.target_json.race_date)}
                    </div>
                  )}
                  {"target_time_s" in g.target_json && (
                    <div>
                      Целевое время:{" "}
                      {(() => {
                        const sec = g.target_json.target_time_s as number;
                        if (!sec || sec <= 0) return "—";
                        const h = Math.floor(sec / 3600);
                        const m = Math.floor((sec % 3600) / 60);
                        const s = sec % 60;
                        const pad = (n: number) =>
                          String(n).padStart(2, "0");
                        return h > 0
                          ? `${h}:${pad(m)}:${pad(s)}`
                          : `${m}:${pad(s)}`;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}