import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-svh bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  );
}

