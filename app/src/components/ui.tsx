"use client";
import { useState, type ReactNode } from "react";
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
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand/15 px-4 py-2 text-sm">
      <span>
        Demo mode (simulated chain){isDemoPersona ? <> · acting as <b>{persona}</b></> : " · using your connected wallet"}
      </span>
      <button
        className="underline"
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
