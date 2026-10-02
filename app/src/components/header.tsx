"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CURRENCIES, type DisplayCurrency } from "@/lib/currency";
import { motion } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEmployeeLogin } from "@/lib/employee-wallet";
import { useLoad, useTabbit } from "@/lib/tabbit";
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
  { href: "/transparency", label: "Network" },
];

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <TabbitMark className={className} id="header-mark" />;
}

/** Nas telas do funcionário com login por e-mail ligado: entrar/sair. No resto (e com Phantom conectada): botão da carteira. */
function AccountButton({ employeeView }: { employeeView: boolean }) {
  const login = useEmployeeLogin();
  const { connected } = useWallet();
  if (!employeeView || login.status === "disabled" || connected) return <WalletMultiButton />;
  if (login.status === "ready")
    return (
      <div className="flex items-center gap-2">
        {login.label && <span className="hidden max-w-[12rem] truncate text-sm font-semibold sm:inline">{login.label}</span>}
        <button className="btn-secondary !rounded-xl !px-3 !py-1.5 text-sm" onClick={() => void login.logout()}>Sign out</button>
      </div>
    );
  return (
    <button className="btn-primary !rounded-xl !px-4 !py-1.5 text-sm" disabled={login.status === "loading"} onClick={login.login}>
      Sign in
    </button>
  );
}

/** Mostra a aba Admin só para a carteira da plataforma (no modo demo, a persona da plataforma). */
function useIsPlatform() {
  const { client, actor } = useTabbit("admin");
  const { data } = useLoad(async () => (actor ? (await client.getConfig()).authority.equals(actor) : false), [client, actor]);
  return !!data;
}

export function Header() {
  const path = usePathname();
  const isPlatform = useIsPlatform();
  const nav = isPlatform ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  const { currency, setCurrency } = useCurrency();
  // No celular a barra rola de lado: mantém a aba atual à vista
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>("[aria-current=page]");
    const bar = navRef.current;
    if (el && bar) bar.scrollLeft = el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2;
  }, [path, nav.length]);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-ink/[0.07] bg-paper/75 px-3 py-2 shadow-[0_8px_30px_-12px_rgba(11,43,43,0.15)] backdrop-blur-xl sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-xl">
          <Logo className="h-8 w-auto" />
          <Wordmark />
        </Link>
        <nav ref={navRef} className="order-last flex w-full gap-1 overflow-x-auto rounded-xl bg-ink/[0.05] p-1 text-sm [scrollbar-width:none] sm:order-none sm:w-auto">
          {nav.map((n) => {
            const active = path.startsWith(n.href) || (n.href === "/employee" && path.startsWith("/pay"));
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`relative flex-1 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-center font-semibold transition sm:flex-none sm:px-3 ${active ? "text-brand" : "text-ink/60 hover:text-ink"}`}>
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
          <AccountButton employeeView={path.startsWith("/employee") || path.startsWith("/pay")} />
        </div>
      </div>
    </header>
  );
}
