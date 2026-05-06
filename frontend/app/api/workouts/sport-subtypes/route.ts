import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = (searchParams.get("sport") || "run").toLowerCase();

  const supabase = await createSupabaseServerClient();

  let items: Array<{ value: string; label: string }> = [];

  const { data } = await supabase
    .from("sport_subtypes")
    .select("*")
    .eq("sport", sport)
    .order("order", { ascending: true });

  if (Array.isArray(data) && data.length) {
    items = data
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

  if (!items.length) {
    const fallback = SUB_FALLBACKS[sport] ?? [];
    items = fallback.map((v) => ({ value: v, label: v }));
  }

  return NextResponse.json({ items });
}
