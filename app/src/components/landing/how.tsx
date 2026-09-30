"use client";
import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Eyebrow, Reveal } from "./primitives";

const STEPS = [
  {
    title: "The employer funds a vault",
    text: "One USDC deposit. It sits in a Solana vault only the company controls, and unallocated money can be withdrawn anytime.",
    icon: "M4 10h16M6 10V7l6-3 6 3v3M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16",
  },
  {
    title: "Rules are written on-chain",
    text: "Per worker: balance, max per meal, daily cap and optional meal hours. No manager, card network or app can bend them.",
    icon: "M9 12l2 2 4-4M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z",
  },
  {
    title: "The worker scans a QR code",
    text: "At any registered restaurant. The program checks every rule in the same transaction, before a single cent moves.",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2",
  },
  {
    title: "The restaurant is paid in seconds",
    text: "Straight to its wallet, minus 0.8%. No settlement cycle, no chargebacks, and a public receipt for every meal.",
    icon: "M13 3L4 14h7l-1 7 9-11h-7l1-7z",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const line = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });

  return (
    <section id="how" className="relative scroll-mt-24 px-5 py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Four steps. <br />
            <span className="text-ink/40">No middleman required.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg text-ink/70">
            Meal cards today depend on a company in the middle holding the money and the rules. Tabbit puts both in a program anyone can
            audit.
          </p>
        </Reveal>

        <div ref={ref} className="relative space-y-6 pl-14">
          <div className="absolute bottom-6 left-[1.2rem] top-6 w-0.5 rounded bg-ink/10" />
          <motion.div style={{ scaleY: line }} className="absolute bottom-6 left-[1.2rem] top-6 w-0.5 origin-top rounded bg-gradient-to-b from-brand to-deep" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <article className="group relative rounded-3xl border border-ink/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/10">
                <span className="absolute -left-14 top-6 flex h-10 w-10 items-center justify-center rounded-full border-4 border-paper bg-ink font-display text-sm font-black text-brand">
                  {i + 1}
                </span>
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-deep transition group-hover:bg-brand group-hover:text-ink">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={s.icon} />
                    </svg>
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-extrabold">{s.title}</h3>
                    <p className="mt-1.5 text-ink/65">{s.text}</p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
