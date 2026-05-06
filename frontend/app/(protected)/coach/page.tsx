//frontend/app/(protected)/coach/page.tsx

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import CoachChat from "@/components/coach/CoachChat.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function apiUrl(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

export default async function CoachPage() {
  const h = await headers();
  const res = await fetch(await apiUrl("/api/coach/bootstrap"), {
    cache: "no-store",
    headers: { cookie: h.get("cookie") ?? "" },
  });

  if (res.status === 401) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(`/api/auth/upgrade?returnTo=${encodeURIComponent(`/coach`)}`);
    }
    redirect("/login");
  }

  if (!res.ok) throw new Error("Не удалось загрузить диалог с тренером");

  const data = await res.json();

  return (
    <main className="flex h-[calc(100svh-4rem-2rem)] min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CoachChat
          threadId={data.thread.id}
          initialMessages={data.messages ?? []}
          initialHasMoreMessages={!!data.hasMoreMessages}
          currentUserId={data.user.id}
          initialUnreadCount={Number(data.unreadCount ?? 0)}
        />
      </section>
    </main>
  );
}