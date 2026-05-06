//frontend/app/(protected)/profile/edit/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import ProfileEditForm from "@/components/profile/profile-edit-form.client";
import { apiGet } from "@/lib/server/apiFetch";

export default async function ProfileEditPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await apiGet<{
    email: string | null;
    initial: React.ComponentProps<typeof ProfileEditForm>["initial"];
  }>("/api/profile/edit-state");

  return (
    <main className="w-full space-y-4">
      <ProfileEditForm initial={data.initial} email={data.email} />
    </main>
  );
}

