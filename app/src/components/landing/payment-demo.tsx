"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon } from "./primitives";

const CHECKS = [
  ["Restaurant is registered", "Cantina da Vila"],
  ["Inside meal hours", "11:00 – 15:00"],
  ["Under per-meal limit", "$40.00"],
  ["Within daily cap", "$60.00"],
  ["Enough balance", "$237.60 left"],
];

// Etapas: 0 lendo QR, 1 valor, 2..6 regras, 7 pago, 8 restaurante recebeu.
const PAID = CHECKS.length + 2;
const DURATION = (step: number) => (step === 0 ? 1100 : step === 1 ? 900 : step < PAID ? 420 : step === PAID ? 1500 : 2600);

// Cartão animado que encena um pagamento: cada regra é conferida on-chain antes do dinheiro sair.
export function PaymentDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % (PAID + 2)), DURATION(step));
    return () => clearTimeout(t);
  }, [step]);

  const checked = Math.max(0, Math.min(CHECKS.length, step - 1));
  const paid = step >= PAID;

  return (
    <div className="relative w-full max-w-sm rounded-[2rem] border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.04] p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">
      <div className="rounded-[1.6rem] bg-night/80 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-lg">🍲</div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Cantina da Vila</p>
            <p className="text-xs text-white/50">Lunch · 12:31 · São Paulo</p>
          </div>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">devnet</span>
        </div>

        <div className="relative mt-6 h-16">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full items-center gap-3 text-white/70">
                <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/20">
                  <span className="grid grid-cols-3 gap-0.5 opacity-60">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 ${i % 2 ? "bg-white/30" : "bg-white"}`} />
                    ))}
                  </span>
                  <motion.span
                    className="absolute inset-x-0 h-0.5 bg-brand shadow-[0_0_8px] shadow-brand"
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                  />
                </span>
                Scanning QR code…
              </motion.div>
            ) : (
              <motion.div key="amount" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="text-xs uppercase tracking-wider text-white/50">Paying</p>
                <p className="font-display text-4xl font-black tabular-nums">
                  $12<span className="text-white/50">.40</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ul className="mt-5 space-y-2.5">
          {CHECKS.map(([label, detail], i) => {
            const ok = i < checked;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <motion.span
                  animate={ok ? { scale: [0.6, 1.15, 1], backgroundColor: "#1ee88a" } : { scale: 1, backgroundColor: "rgba(255,255,255,0.08)" }}
                  transition={{ duration: 0.35 }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink"
                >
                  {ok && <CheckIcon className="h-3 w-3" />}
                </motion.span>
                <span className={`transition-colors ${ok ? "text-white" : "text-white/40"}`}>{label}</span>
                <span className={`ml-auto text-xs tabular-nums transition-colors ${ok ? "text-white/60" : "text-white/25"}`}>{detail}</span>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-6 h-[3.25rem] overflow-hidden rounded-2xl">
          <AnimatePresence>
            {paid ? (
              <motion.div
                key="paid"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center gap-2 bg-brand font-bold text-ink"
              >
                <CheckIcon className="h-4 w-4" /> Paid · settled in 0.4s
              </motion.div>
            ) : (
              <motion.div key="wait" exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-white/5 text-sm text-white/50">
                <span className="relative mr-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Verifying on Solana
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {step === PAID + 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink shadow-xl sm:-left-10"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-deep">
              <CheckIcon className="h-4 w-4" />
            </span>
            <div className="text-sm leading-tight">
              <p className="font-bold">Restaurant received $12.30</p>
              <p className="text-xs text-ink/60">Tabbit fee $0.10 (0.8%)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
