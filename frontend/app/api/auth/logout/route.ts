import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClientWithCookies();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
