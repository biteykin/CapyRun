// frontend/app/(protected)/profile/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import ProfileHeader from "@/components/profile/profile-header";
import ProfileContent from "@/components/profile/profile-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  // Получаем текущего пользователя
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // неавторизованных отправляем на логин
    return null;
  }

  // Загружаем профиль пользователя
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="w-full space-y-6 px-4 py-10">
      <ProfileHeader
        avatarUrl={profile?.avatar_url}
        displayName={profile?.display_name || user.email}
        email={user.email}
      />
      <ProfileContent
        profile={{
          age: profile?.age,
          gender: profile?.gender,
          weight: profile?.weight,
          height: profile?.height,
          max_hr: profile?.max_hr,
          hr_zones: profile?.hr_zones,
        }}
      />
    </div>
  );
}