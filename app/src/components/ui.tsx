"use client";
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import type { PublicKey } from "@solana/web3.js";
import { formatUsdc } from "@/lib/currency";
import { resetMockStore } from "@/lib/mock-client";
import { useCurrency } from "./providers";

/** Valor em moeda local (grande) + USDC (pequeno). */
export function Money({ base, className = "" }: { base: bigint; className?: string }) {
  const { fiat } = useCurrency();
  return (
    <span className={className}>
      {fiat(base)} <span className="text-xs font-normal opacity-60">{formatUsdc(base)}</span>
    </span>
  );
}

export function shortKey(key: PublicKey | string) {
  const s = key.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="mb-4 text-xl font-extrabold">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="text-sm font-medium text-red-700">{children}</p> : null;
}

/** Aviso de modo demo (mock): mostra a persona e permite resetar os dados. */
export function DemoBanner({ isMock, isDemoPersona, persona }: { isMock: boolean; isDemoPersona: boolean; persona: string }) {
  const [done, setDone] = useState(false);
  if (!isMock) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-brand" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
      <span>
        Demo mode{isDemoPersona ? <> · acting as <b>{persona}</b></> : " · using your connected wallet"}
      </span>
      <button
        className="ml-auto rounded-lg px-2 py-0.5 font-semibold text-deep transition hover:bg-brand/20"
        onClick={() => {
          resetMockStore();
          setDone(true);
          location.reload();
        }}
      >
        {done ? "Resetting…" : "Reset demo data"}
      </button>
    </div>
  );
}

/** Ícone animado de resultado: check que "salta" (ok) ou X que treme (bloqueado). */
export function ResultIcon({ ok }: { ok: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: ok ? -30 : 0 }}
      animate={ok ? { scale: 1, rotate: 0 } : { scale: 1, x: [0, -8, 8, -5, 5, 0] }}
      transition={ok ? { type: "spring", stiffness: 260, damping: 14 } : { duration: 0.5 }}
      className={`relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${ok ? "bg-brand text-ink shadow-[0_0_40px_-6px] shadow-brand" : "bg-red-600 text-white"}`}
      aria-hidden
    >
      {ok && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-brand"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        />
      )}
      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d={ok ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        />
      </svg>
    </motion.div>
  );
}
