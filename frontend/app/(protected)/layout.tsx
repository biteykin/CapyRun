import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const isOnboardingDone = !!profile?.onboarding_completed_at;

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  return <Shell>{children}</Shell>;
}