import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST() {
  // Обновляем httpOnly-куки после любого изменения auth состояния на клиенте
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.getSession();
  return NextResponse.json({ ok: true });
}