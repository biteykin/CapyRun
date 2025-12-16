export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServerApp";
import ProfileEditForm from "@/components/profile/profile-edit-form.client";

export default async function ProfileEditPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: prof, error } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, avatar_url, sex, birth_date, height_cm, weight_kg, hr_rest, hr_max, country_code, city"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("profiles fetch error (edit)", error);
  }

  return (
    <main className="w-full space-y-6">
      <ProfileEditForm
        initial={{
          user_id: user.id,
          display_name: prof?.display_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
          sex: prof?.sex ?? null,
          birth_date: prof?.birth_date ?? null,
          height_cm: prof?.height_cm != null ? Number(prof.height_cm) : null,
          weight_kg: prof?.weight_kg != null ? Number(prof.weight_kg) : null,
          hr_rest: prof?.hr_rest ?? null,
          hr_max: prof?.hr_max ?? null,
          country_code: prof?.country_code ?? null,
          city: prof?.city ?? null,
        }}
        email={user.email ?? null}
      />
    </main>
  );
}

