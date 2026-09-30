"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, CrossIcon, Eyebrow, Reveal } from "./primitives";

// Mesmas regras e mesma ordem do programa (programs/tabbit/src/instructions/pay.rs).
const RULES = { maxPerMeal: 40, dailyCap: 60, balance: 237.6, windowStart: 11 * 60, windowEnd: 15 * 60, feeBps: 80 };

const money = (n: number) => `$${n.toFixed(2)}`;
const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function Slider({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-white/60">{label}</span>
        <span className="font-display text-2xl font-black tabular-nums text-white">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-brand"
        style={{ background: `linear-gradient(to right, #1ee88a ${pct}%, rgba(255,255,255,0.12) ${pct}%)` }}
      />
    </label>
  );
}

export function RulesPlayground() {
  const [amount, setAmount] = useState(18);
  const [time, setTime] = useState(12 * 60 + 30);
  const [spent, setSpent] = useState(25);

  const checks = [
    { label: "Under per-meal limit", detail: `max ${money(RULES.maxPerMeal)}`, ok: amount <= RULES.maxPerMeal, error: "ExceedsMaxPerMeal" },
    { label: "Enough balance", detail: `${money(RULES.balance)} left`, ok: amount <= RULES.balance, error: "InsufficientBalance" },
    { label: "Within daily cap", detail: `${money(spent)} of ${money(RULES.dailyCap)} used`, ok: spent + amount <= RULES.dailyCap, error: "ExceedsDailyCap" },
    { label: "Inside meal hours", detail: `${clock(RULES.windowStart)} – ${clock(RULES.windowEnd)}`, ok: time >= RULES.windowStart && time < RULES.windowEnd, error: "OutsideTimeWindow" },
  ];
  const failed = checks.find((c) => !c.ok);
  const fee = Math.floor(amount * RULES.feeBps) / 10_000;

  return (
    <section id="rules" className="scroll-mt-24 px-3 sm:px-5">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-night px-5 py-16 text-white sm:px-12 sm:py-20">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-drift absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow dark>Try to break the rules</Eyebrow>
            <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              The program says no, <span className="text-gradient">so nobody else has to.</span>
            </h2>
            <p className="mt-5 max-w-md text-lg text-white/60">
              Drag the sliders. These are the same checks, in the same order, that run inside every Tabbit payment on Solana.
            </p>
            <div className="mt-10 space-y-8">
              <Slider label="Meal price" value={amount} display={money(amount)} min={1} max={80} step={0.5} onChange={setAmount} />
              <Slider label="Time of payment" value={time} display={clock(time)} min={6 * 60} max={23 * 60 + 45} step={15} onChange={setTime} />
              <Slider label="Already spent today" value={spent} display={money(spent)} min={0} max={60} step={1} onChange={setSpent} />
            </div>
          </Reveal>

          <Reveal delay={0.15} className="lg:pt-10">
            <div className="glass rounded-3xl p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">pay({money(amount)}) · Cantina da Vila</p>
              <ul className="mt-6 space-y-4">
                {checks.map((c, i) => {
                  const skipped = failed && checks.indexOf(failed) < i;
                  return (
                    <li key={c.label} className={`flex items-center gap-4 transition-opacity ${skipped ? "opacity-30" : ""}`}>
                      <motion.span
                        key={String(c.ok)}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          c.ok ? "bg-brand text-ink" : "bg-red-500/90 text-white shadow-[0_0_20px] shadow-red-500/50"
                        }`}
                      >
                        {c.ok ? <CheckIcon /> : <CrossIcon />}
                      </motion.span>
                      <div className="min-w-0">
                        <p className="font-semibold">{c.label}</p>
                        <p className="text-sm text-white/50">{c.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 border-t border-white/10 pt-6">
                <AnimatePresence mode="wait">
                  {failed ? (
                    <motion.div key={failed.error} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [-8, 6, -4, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                      <p className="font-display text-2xl font-black text-red-400">Payment rejected</p>
                      <p className="mt-1 font-mono text-sm text-white/50">Error: {failed.error}. No money moved.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <p className="font-display text-2xl font-black text-brand">Approved in one transaction</p>
                      <p className="mt-1 text-sm text-white/60">
                        Restaurant gets <span className="font-semibold text-white">{money(amount - fee)}</span> now · fee {money(fee)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
