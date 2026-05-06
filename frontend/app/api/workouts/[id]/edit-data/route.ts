import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteCtx = {
  params: Promise<{ id: string }>;
};

type AnyRow = Record<string, unknown>;

const SUB_FALLBACKS: Record<string, string[]> = {
  run: ["road", "trail", "treadmill", "track", "indoor"],
  ride: ["road", "gravel", "mtb", "indoor", "trainer"],
  swim: ["pool", "open_water"],
  walk: ["outdoor", "indoor", "treadmill"],
  hike: ["trail", "mountain"],
  row: ["indoor", "water"],
  strength: ["barbell", "dumbbell", "machine", "bodyweight"],
  yoga: ["hatha", "vinyasa", "yin", "ashtanga"],
  aerobics: ["step", "dance", "hi-lo"],
  crossfit: ["metcon", "amrap", "emom"],
  pilates: ["mat", "reformer"],
  other: [],
};

async function loadSubOptionsServer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sport: string
) {
  let opts: { value: string; label: string }[] = [];

  // 1) directory
  try {
    const { data } = await supabase
      .from("sport_subtypes")
      .select("*")
      .eq("sport", sport)
      .order("order", { ascending: true });
    if (Array.isArray(data) && data.length) {
      opts = data
        .map((r: AnyRow) => {
          const value =
            r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
          const label =
            r.name_ru ??
            r.label_ru ??
            r.title_ru ??
            r.label ??
            r.title ??
            r.name ??
            value;
          return value ? { value: String(value), label: String(label) } : null;
        })
        .filter((v): v is { value: string; label: string } => !!v);
    }
  } catch {}

  // 2) distinct from workouts
  if (!opts.length) {
    try {
      const { data } = await supabase
        .from("workouts")
        .select("sub_sport")
        .eq("sport", sport)
        .not("sub_sport", "is", null)
        .limit(1000);
      if (data) {
        const uniq = Array.from(
          new Set(
            (data as Array<{ sub_sport?: unknown }>)
              .map((x) => x.sub_sport)
              .filter(
                (v): v is string => typeof v === "string" && v.length > 0
              )
          )
        );
        opts = uniq.map((v) => ({ value: String(v), label: String(v) }));
      }
    } catch {}
  }

  // 3) fallback
  if (!opts.length && SUB_FALLBACKS[sport]) {
    opts = SUB_FALLBACKS[sport].map((v) => ({ value: v, label: v }));
  }

  return opts;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .select(
      `
      id,
      user_id,
      start_time,
      local_date,
      uploaded_at,
      sport,
      sub_sport,
      duration_sec,
      distance_m,
      avg_hr,
      calories_kcal,
      name,
      description,
      visibility,
      weekday_iso
    `
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }
  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const initialSubOptions = await loadSubOptionsServer(
    supabase,
    (workout.sport || "run").toLowerCase()
  );

  return NextResponse.json({ workout, initialSubOptions });
}

