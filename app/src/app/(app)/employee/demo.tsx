"use client";
// "Try it as an employee": oferta de benefício de demonstração (só na devnet, via /api/demo).
import { useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { Card, ErrorText, Money } from "@/components/ui";

interface DemoInfo {
  enabled: boolean;
  company?: string | null;
  employer?: string | null;
  balance?: string;
}

let info: Promise<DemoInfo> | null = null;
export function useDemo(enabled: boolean): DemoInfo | null {
  const [demo, setDemo] = useState<DemoInfo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    info ??= fetch("/api/demo")
      .then((r) => (r.ok ? (r.json() as Promise<DemoInfo>) : { enabled: false }))
      .catch(() => ({ enabled: false }));
    info.then((d) => alive && setDemo(d));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? demo : null;
}

function useEnroll(wallet: PublicKey, onDone: () => unknown) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.toBase58() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not create the demo benefit");
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the demo benefit");
    } finally {
      setPending(false);
    }
  };
  return { pending, error, run };
}

/** Para quem entrou e ainda não tem benefício: recebe um saldo de teste na empresa de demo. */
export function DemoOffer({ demo, wallet, onEnrolled }: { demo: DemoInfo; wallet: PublicKey; onEnrolled: () => unknown }) {
  const { pending, error, run } = useEnroll(wallet, onEnrolled);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-night p-6 text-paper">
      <div aria-hidden className="animate-drift pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-semibold text-brand">Try it as an employee</p>
        <h2 className="mt-1 text-2xl font-black">Get a demo meal benefit</h2>
        <p className="mt-2 text-sm opacity-80">
          {demo.company ?? "A demo company"} will give you <b className="text-brand">{demo.balance ? <Money base={BigInt(demo.balance)} /> : "a test balance"}</b> to
          pay any restaurant below. It runs on Solana devnet with test money: no wallet app, no SOL, nothing real is charged.
        </p>
        <button className="btn-primary mt-5 w-full !py-3.5 text-lg" disabled={pending} onClick={() => void run()}>
          {pending ? "Creating your benefit on Solana…" : "Get my demo benefit"}
        </button>
        <ErrorText>{error}</ErrorText>
      </div>
    </section>
  );
}

/** Para quem já é da empresa de demo e gastou o saldo. */
export function DemoRefill({ wallet, onRefilled }: { wallet: PublicKey; onRefilled: () => unknown }) {
  const { pending, error, run } = useEnroll(wallet, onRefilled);
  return (
    <Card>
      <p className="text-sm opacity-70">Your demo balance is almost gone.</p>
      <button className="btn-secondary mt-3 w-full" disabled={pending} onClick={() => void run()}>
        {pending ? "Refilling…" : "Refill my demo balance"}
      </button>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
