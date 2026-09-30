"use client";
import Link from "next/link";
import type { PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { Eyebrow, Reveal, RevealItem, Stagger } from "./primitives";

const DEMOS = [
  {
    href: "/employer",
    who: "Employer",
    title: "Fund lunch for your team",
    text: "Deposit once, set limits per person and revoke anytime. Unused money stays yours.",
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01",
  },
  {
    href: "/employee",
    who: "Worker",
    title: "Pay for lunch with a QR",
    text: "See today's balance, scan the restaurant's code and get a receipt on the spot.",
    icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  },
  {
    href: "/merchant",
    who: "Restaurant",
    title: "Get paid in seconds",
    text: "Show your QR code and watch each sale land in your wallet, live.",
    icon: "M3 9l1.5-5h15L21 9M3 9h18M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 12v9h14v-9",
  },
];

function TiltCard({ d }: { d: (typeof DEMOS)[number] }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(300px circle at ${gx}% ${gy}%, rgba(30,232,138,0.22), transparent 70%)`;

  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 12);
    rx.set((0.5 - py) * 12);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }} className="h-full">
      <Link
        href={d.href}
        onPointerMove={onMove}
        onPointerLeave={reset}
        className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-7 shadow-sm transition-shadow hover:shadow-2xl hover:shadow-brand/15"
      >
        <motion.div style={{ background: glow }} className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-brand transition group-hover:scale-110 group-hover:rotate-[-6deg]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={d.icon} />
          </svg>
        </span>
        <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">{d.who}</p>
        <h3 className="relative mt-1 font-display text-2xl font-black">{d.title}</h3>
        <p className="relative mt-2 flex-1 text-ink/65">{d.text}</p>
        <span className="relative mt-8 inline-flex items-center gap-2 font-bold text-deep">
          Open the demo <span className="transition group-hover:translate-x-1.5">→</span>
        </span>
      </Link>
    </motion.div>
  );
}

export function Personas() {
  return (
    <section className="px-5 pb-28 sm:pb-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow>Live demo</Eyebrow>
            <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">Pick a side of the table.</h2>
          </div>
          <p className="max-w-sm text-ink/60">Each demo is the working app, not a mockup. Open it as an employer, a worker or a restaurant.</p>
        </Reveal>
        <Stagger className="grid gap-5 md:grid-cols-3" gap={0.12}>
          {DEMOS.map((d) => (
            <RevealItem key={d.href} className="h-full">
              <TiltCard d={d} />
            </RevealItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
