"use client";
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Eyebrow, Reveal } from "./primitives";

const TABBIT_FEE = 0.008;
const INCUMBENT_FEE = 0.036; // teto de MDR do Decreto 12.712/2025

function Bar({ label, value, width, tabbit }: { label: string; value: string; width: string; tabbit?: boolean }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-4">
      <span className={`text-sm font-semibold ${tabbit ? "text-ink" : "text-ink/50"}`}>{label}</span>
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: tabbit ? 0.3 : 0 }}
          className={`h-9 min-w-2 rounded-xl ${tabbit ? "bg-gradient-to-r from-brand to-mint shadow-[0_0_24px_-6px] shadow-brand" : "bg-ink/10"}`}
        />
        <span className="whitespace-nowrap font-display text-lg font-black">{value}</span>
      </div>
    </div>
  );
}

function Counter({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `$${Math.round(v).toLocaleString("en-US")}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.5, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span>{text}</motion.span>;
}

export function Compare() {
  const [volume, setVolume] = useState(20_000);
  const saved = volume * (INCUMBENT_FEE - TABBIT_FEE);
  const pct = ((volume - 2_000) / (100_000 - 2_000)) * 100;

  return (
    <section id="restaurants" className="scroll-mt-24 px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>For restaurants</Eyebrow>
          <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Cheaper for restaurants. <span className="text-ink/40">Faster, too.</span>
          </h2>
          <p className="mt-5 text-lg text-ink/70">
            Meal-card networks can charge up to 3.6% and take up to 15 days to pay. Tabbit charges 0.8% and settles in the same transaction.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="space-y-10 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-sm sm:p-10">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Fee per payment</p>
              <Bar label="Tabbit" value="0.8%" width="22%" tabbit />
              <Bar label="Incumbents" value="up to 3.6%" width="100%" />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">Time until the restaurant is paid</p>
              <Bar label="Tabbit" value="seconds" width="2%" tabbit />
              <Bar label="Incumbents" value="up to 15 days" width="100%" />
            </div>
            <p className="border-t border-ink/10 pt-5 text-sm text-ink/60">Every rule check and every payment is public and auditable on Solana.</p>
          </Reveal>

          <Reveal delay={0.1} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-[#2af09a] to-mint p-6 text-ink sm:p-10">
            <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/30 blur-2xl" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">Savings calculator</p>
            <label className="relative mt-6 block">
              <span className="text-sm text-ink/70">Monthly meal-benefit sales</span>
              <span className="mt-1 block font-display text-3xl font-black tabular-nums">${volume.toLocaleString("en-US")}</span>
              <input
                type="range"
                min={2_000}
                max={100_000}
                step={1_000}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full accent-ink"
                style={{ background: `linear-gradient(to right, #0b2b2b ${pct}%, rgba(11,43,43,0.15) ${pct}%)` }}
              />
            </label>
            <div className="relative mt-10">
              <p className="text-sm text-ink/70">The restaurant keeps, every month</p>
              <p className="font-display text-6xl font-black tabular-nums tracking-tight sm:text-7xl">
                <Counter value={saved} />
              </p>
              <p className="mt-2 text-sm text-ink/60">vs. a 3.6% fee, and the cash arrives the same day.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
