// frontend/app/(protected)/profile/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileHeader from "@/components/profile/profile-header";
import ProfileContent from "@/components/profile/profile-content";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/server/apiFetch";

export default async function Page() {
  const { displayName, avatarUrl, email, stats, profileData } = await apiGet<{
    displayName: string;
    avatarUrl: string;
    email: string | null;
    stats: {
      workoutsCount: number | null;
      totalKm: number | null;
      totalHours: number | null;
      lastWorkoutAt: string | null;
      primarySport: string | null;
      updatedAt: string | null;
    };
    profileData: {
      userId: string;
      age: number | null;
      workoutsCount: number | null;
      gender: string | null;
      weight: number | null;
      height: number | null;
      max_hr: number | null;
      hr_zones: unknown;
      country_code: string | null;
      city: string | null;
    };
  }>("/api/profile/summary").catch(() => redirect("/login"));

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Мой профиль</h1>
        </div>
        <Link href="/profile/edit" className="inline-flex">
          <Button variant="secondary" size="sm" type="button">
            Редактировать профиль
          </Button>
        </Link>
      </div>

      <ProfileHeader
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={email}
        stats={{
          workoutsCount: stats.workoutsCount,
          totalKm: stats.totalKm,
          totalHours: stats.totalHours,
          lastWorkoutAt: stats.lastWorkoutAt ? new Date(stats.lastWorkoutAt) : null,
          primarySport: stats.primarySport,
          updatedAt: stats.updatedAt ? new Date(stats.updatedAt) : null,
        }}
      />

      <ProfileContent profile={profileData} />
    </main>
  );
}