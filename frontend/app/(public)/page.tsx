import PHTrack from '@/components/analytics/PHTrack';
import Hero from '@/components/marketing/Hero';
import Features from '@/components/marketing/Features';
import Steps from '@/components/marketing/Steps';
import Logos from '@/components/marketing/Logos';
import CTA from '@/components/marketing/CTA';
import Footer from '@/components/marketing/Footer';

export default function LandingPage() {
  return (
    <main>
      <PHTrack event="landing_viewed" />
      <Hero />
      <Features />
      <Steps />
      <Logos />
      <CTA />
      <Footer />
    </main>
  );
}
