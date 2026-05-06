//frontend/app/(public)/page.tsx

import PHTrack from "@/components/analytics/PHTrack";
import Landing from "@/components/marketing/Landing";

export default function LandingPage() {
  return (
    <main>
      <PHTrack event="landing_viewed" />
      <Landing />
    </main>
  );
}