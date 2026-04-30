import { NextRequest, NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

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

export async function GET(req: NextRequest) {
  const supabase = await createClientWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sport = (new URL(req.url).searchParams.get("sport") || "run").toLowerCase();
  let items: Array<{ value: string; label: string }> = [];

  const { data: refRows } = await supabase
    .from("sport_subtypes")
    .select("*")
    .eq("sport", sport)
    .order("order", { ascending: true });

  if (Array.isArray(refRows) && refRows.length) {
    items = refRows
      .map((r: any) => {
        const value = r.code ?? r.key ?? r.value ?? r.sub_sport ?? r.slug ?? r.id ?? "";
        const label = r.name_ru ?? r.label_ru ?? r.title_ru ?? r.label ?? r.title ?? r.name ?? value;
        return value ? { value: String(value), label: String(label) } : null;
      })
      .filter(Boolean) as Array<{ value: string; label: string }>;
  }

  if (!items.length) {
    const { data } = await supabase
      .from("workouts")
      .select("sub_sport")
      .eq("user_id", user.id)
      .eq("sport", sport)
      .not("sub_sport", "is", null)
      .limit(1000);

    const uniq = Array.from(new Set((data ?? []).map((x: any) => x.sub_sport).filter(Boolean)));
    items = uniq.map((v) => ({ value: String(v), label: String(v) }));
  }

  if (!items.length) {
    items = (SUB_FALLBACKS[sport] || []).map((v) => ({ value: v, label: v }));
  }

  return NextResponse.json({ items });
}
