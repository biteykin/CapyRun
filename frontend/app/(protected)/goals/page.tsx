// app/(protected)/goals/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import GoalsListWithAdd from "@/components/goals/GoalsListWithAdd.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const jar = await cookies();
    const legacy = jar.get("capyrun.auth")?.value;
    if (legacy) {
      redirect(
        `/api/auth/upgrade?returnTo=${encodeURIComponent(`/goals`)}`
      );
    }
    redirect("/login");
  }

  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("goals fetch error", error);
  }

  return (
    <main className="w-full space-y-6">
      <section className="w-full">
        <GoalsListWithAdd
          goals={goals ?? []}
          created={searchParams?.created === "1"}
        />
      </section>
    </main>
  );
}