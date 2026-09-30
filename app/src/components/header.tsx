"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CURRENCIES, type DisplayCurrency } from "@/lib/currency";
import { motion } from "motion/react";
import { TabbitMark, Wordmark } from "./brand";
import { useCurrency } from "./providers";

// Botão da carteira só no cliente (evita divergência de hidratação).
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const NAV = [
  { href: "/employer", label: "Employer" },
  { href: "/employee", label: "Employee" },
  { href: "/merchant", label: "Restaurant" },
];

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <TabbitMark className={className} id="header-mark" />;
}

export function Header() {
  const path = usePathname();
  const { currency, setCurrency } = useCurrency();
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-ink/[0.07] bg-paper/75 px-3 py-2 shadow-[0_8px_30px_-12px_rgba(11,43,43,0.15)] backdrop-blur-xl sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-xl">
          <Logo className="h-8 w-auto" />
          <Wordmark />
        </Link>
        <nav className="order-last flex w-full gap-1 rounded-xl bg-ink/[0.05] p-1 text-sm sm:order-none sm:w-auto">
          {NAV.map((n) => {
            const active = path.startsWith(n.href) || (n.href === "/employee" && path.startsWith("/pay"));
            return (
              <Link key={n.href} href={n.href} className={`relative flex-1 rounded-lg px-3 py-1.5 text-center font-semibold transition sm:flex-none ${active ? "text-brand" : "text-ink/60 hover:text-ink"}`}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="currency">Display currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
            className="input !w-auto !rounded-xl !py-1.5 text-sm font-semibold"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
