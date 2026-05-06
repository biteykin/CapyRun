import { NextRequest, NextResponse } from "next/server";
import { differenceInYears } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goalId = req.nextUrl.searchParams.get("id");

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("sex, birth_date, height_cm, weight_kg")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) console.error("goals onboarding profile fetch error", profErr);

  const { data: editGoal, error: editGoalErr } = goalId
    ? await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", goalId)
        .maybeSingle()
    : { data: null, error: null };

  if (editGoalErr) console.error("goal edit fetch error", editGoalErr);

  return NextResponse.json({
    initialProfile: {
      sex: prof?.sex ?? null,
      age: prof?.birth_date
        ? differenceInYears(new Date(), new Date(prof.birth_date))
        : null,
      birth_date: prof?.birth_date ?? null,
      height_cm: prof?.height_cm != null ? Number(prof.height_cm) : null,
      weight_kg: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
    },
    editGoal: editGoal ?? null,
  });
}

