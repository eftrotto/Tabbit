"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { CURRENCIES, formatFiat, type DisplayCurrency } from "@/lib/currency";
import { RPC_URL } from "@/lib/tabbit";

interface CurrencyCtx {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  fiat: (base: bigint) => string;
}
const CurrencyContext = createContext<CurrencyCtx | null>(null);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency outside <Providers>");
  return ctx;
}

function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("BRL");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tabbit-currency") as DisplayCurrency | null;
      if (saved && CURRENCIES.includes(saved)) setCurrencyState(saved);
    } catch {}
  }, []);
  const setCurrency = (c: DisplayCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("tabbit-currency", c);
    } catch {}
  };
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fiat: (b) => formatFiat(b, currency) }}>
      {children}
    </CurrencyContext.Provider>
  );
}

// Phantom se registra sozinho via Wallet Standard, por isso a lista de adapters é vazia.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
