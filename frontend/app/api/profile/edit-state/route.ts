import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof, error } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, avatar_url, sex, birth_date, height_cm, weight_kg, hr_rest, hr_max, country_code, city"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    email: user.email ?? null,
    initial: {
      user_id: user.id,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      sex: prof?.sex ?? null,
      birth_date: prof?.birth_date ?? null,
      height_cm: prof?.height_cm != null ? Number(prof.height_cm) : null,
      weight_kg: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
      hr_rest: prof?.hr_rest ?? null,
      hr_max: prof?.hr_max ?? null,
      country_code: prof?.country_code ?? null,
      city: prof?.city ?? null,
    },
  });
}

