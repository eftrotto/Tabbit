import { Compare } from "@/components/landing/compare";
import { Footer, Ticker, Waitlist } from "@/components/landing/closing";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how";
import { LandingNav } from "@/components/landing/nav";
import { Personas } from "@/components/landing/personas";
import { MotionRoot } from "@/components/landing/primitives";
import { RulesPlayground } from "@/components/landing/rules";

export default function Home() {
  return (
    <MotionRoot>
      <LandingNav />
      <main className="overflow-x-clip">
        <Hero />
        <Ticker />
        <HowItWorks />
        <RulesPlayground />
        <Compare />
        <Personas />
        <Waitlist />
      </main>
      <Footer />
    </MotionRoot>
  );
}
