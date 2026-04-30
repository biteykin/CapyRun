"use client";

import ProfileEditForm from "@/components/profile/profile-edit-form.client";
import OnboardingStepHeader from "@/components/onboarding/OnboardingStepHeader";

type InitialProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  hr_rest: number | null;
  hr_max: number | null;
  country_code: string | null;
  city: string | null;
};

export default function OnboardingProfileStep({
  initial,
  email,
}: {
  initial: InitialProfile;
  email: string | null;
}) {
  return (
    <section className="w-full space-y-4">
      <div>
        <OnboardingStepHeader
          step={1}
          total={4}
        />
      </div>

      <ProfileEditForm initial={initial} email={email} mode="onboarding" />
    </section>
  );
}
