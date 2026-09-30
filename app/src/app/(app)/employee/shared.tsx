"use client";
// Pequenos helpers compartilhados por /employee, /pay e /merchant.
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Category, EmployeeAccount } from "@tabbit/sdk";
import { Card } from "@/components/ui";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function ConnectCard({ what }: { what: string }) {
  return (
    <Card title="Connect your wallet">
      <p className="mb-4 text-sm opacity-70">{what}</p>
      <WalletMultiButton />
    </Card>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-secondary !px-3 !py-1.5 text-sm"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** Carteira sem cadastro: mostra o endereço para enviar a quem cadastra. */
export function NotLinked({ title, hint, address }: { title: string; hint: string; address: string }) {
  return (
    <Card title={title}>
      <p className="mb-3 text-sm opacity-70">{hint}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-ink/5 px-3 py-2 text-xs">{address}</code>
        <CopyButton text={address} />
      </div>
    </Card>
  );
}

const CATEGORY_LABEL: Record<Category, string> = { restaurant: "Restaurant", cafe: "Café", grocery: "Grocery", other: "Other" };
export function CategoryBadge({ category }: { category: Category }) {
  return <span className="rounded-full bg-brand/25 px-2 py-0.5 text-xs font-medium">{CATEGORY_LABEL[category]}</span>;
}

/** Disponível hoje = min(saldo, teto diário − gasto hoje), nunca negativo. */
export function availableToday(e: EmployeeAccount): bigint {
  const left = e.dailyCap > e.spentToday ? e.dailyCap - e.spentToday : 0n;
  return e.balance < left ? e.balance : left;
}

export const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
