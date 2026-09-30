"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CURRENCIES, type DisplayCurrency } from "@/lib/currency";
import { TabbitMark } from "./brand";
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
    <header className="border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Logo /> Tabbit
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={path.startsWith(n.href) ? "font-semibold underline decoration-brand decoration-2 underline-offset-4" : "opacity-70 hover:opacity-100"}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="currency">Display currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
            className="input !w-auto py-1"
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
