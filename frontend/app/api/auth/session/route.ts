import { NextResponse } from "next/server";
import { createClientWithCookies } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClientWithCookies();

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { user: null, profile: null },
        { status: 200 }
      );
    }

    const user = userData.user;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        user: null,
        profile: null,
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
