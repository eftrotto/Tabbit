"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { LiveMark } from "./live-mark";
import { PaymentDemo } from "./payment-demo";

const HEADLINE = ["Meal", "benefits,", "verified", "on-chain."];

function Orb({ className, scroll, mouse, depth }: { className: string; scroll: MotionValue<number>; mouse: [MotionValue<number>, MotionValue<number>]; depth: number }) {
  const y = useTransform(scroll, [0, 1], [0, 260 * depth]);
  const mx = useTransform(mouse[0], (v) => v * 40 * depth);
  const my = useTransform(mouse[1], (v) => v * 40 * depth);
  return (
    <motion.div style={{ y }} className="pointer-events-none absolute">
      <motion.div style={{ x: mx, y: my }}>
        <div className={`animate-drift rounded-full blur-3xl ${className}`} />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mx = useSpring(useMotionValue(0), { stiffness: 40, damping: 20 });
  const my = useSpring(useMotionValue(0), { stiffness: 40, damping: 20 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  // Parallax: texto sobe mais rápido que o cartão, o mascote fica no meio.
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const cardY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const markY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const markRotate = useTransform(scrollYProgress, [0, 1], [6, 20]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-night text-white">
      <div className="bg-grid absolute inset-0 -z-10" />
      <Orb scroll={scrollYProgress} mouse={[mx, my]} depth={1} className="-left-40 -top-40 h-[36rem] w-[36rem] bg-brand/35" />
      <Orb scroll={scrollYProgress} mouse={[mx, my]} depth={-0.6} className="left-[55%] top-10 h-[30rem] w-[30rem] bg-teal-400/25" />
      <Orb scroll={scrollYProgress} mouse={[mx, my]} depth={0.5} className="left-[20%] top-[26rem] h-[26rem] w-[26rem] bg-emerald-600/30" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-night" />

      <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-14 px-5 pb-24 pt-32 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pt-24">
        <motion.div style={{ y: textY, opacity: fade }}>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white/80"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-brand" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Live on Solana devnet · paid in USDC
          </motion.p>

          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-[4.75rem]">
            {HEADLINE.map((w, i) => (
              <span key={w} className="mr-[0.22em] inline-block overflow-hidden pb-2 align-bottom last:mr-0">
                <motion.span
                  className={`inline-block ${w === "verified" ? "text-gradient" : ""}`}
                  initial={{ y: "110%", rotate: 4 }}
                  animate={{ y: 0, rotate: 0 }}
                  transition={{ delay: 0.25 + i * 0.09, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl"
          >
            Employers fund lunch in USDC and set the rules. Workers pay with a QR code. Restaurants get their money in seconds, for a{" "}
            <span className="font-semibold text-white">0.8% fee</span> instead of 3.6% and a two-week wait.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link
              href="/employer"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-brand px-6 py-3.5 font-bold text-ink shadow-[0_0_40px_-8px] shadow-brand transition hover:scale-[1.03]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition duration-700 group-hover:translate-x-full" />
              Try the live demo <span className="transition group-hover:translate-x-1">→</span>
            </Link>
            <a href="#how" className="glass inline-flex items-center rounded-2xl px-6 py-3.5 font-semibold text-white transition hover:bg-white/10">
              See how it works
            </a>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6"
          >
            {[
              ["0.8%", "fee, restaurant only"],
              ["~1s", "to settle"],
              ["100%", "auditable"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-black text-mint sm:text-3xl">{v}</dt>
                <dd className="mt-1 text-xs text-white/50">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <div className="relative mx-auto mt-32 flex w-full max-w-md justify-center sm:mt-44 lg:mt-0 lg:justify-end">
          <motion.div style={{ y: markY, rotate: markRotate }} className="absolute -top-40 right-2 w-40 sm:-top-52 sm:right-0 sm:w-52 lg:-top-[10.75rem] lg:w-44">
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: "spring", stiffness: 80, damping: 12 }}>
              <motion.div
                animate={{ y: [0, 0, -34, -34, 0], rotate: [0, 0, -5, -5, 0] }}
                transition={{ duration: 4.5, times: [0, 0.45, 0.55, 0.85, 1], repeat: Infinity, ease: "easeInOut" }}
              >
                <LiveMark className="h-auto w-full drop-shadow-[0_20px_40px_rgba(30,232,138,0.35)]" id="hero-mark" />
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.div style={{ y: cardY }} className="relative w-full [perspective:1000px]">
            <motion.div
              initial={{ opacity: 0, y: 40, rotateX: 12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="flex justify-center lg:justify-end"
            >
              <PaymentDemo />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
