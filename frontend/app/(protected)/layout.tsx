import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Shell } from "@/components/Shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");          // гость → на логин
  return <Shell>{children}</Shell>;       // авторизован — видит Shell (Sidebar/Topbar)
}