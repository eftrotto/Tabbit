"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
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

// Moeda escolhida fica no localStorage; useSyncExternalStore evita divergência de hidratação.
const CURRENCY_KEY = "tabbit-currency";
const currencyListeners = new Set<() => void>();
function readCurrency(): DisplayCurrency {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY) as DisplayCurrency | null;
    if (saved && CURRENCIES.includes(saved)) return saved;
  } catch {}
  return "BRL";
}
function subscribeCurrency(cb: () => void) {
  currencyListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    currencyListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useSyncExternalStore(subscribeCurrency, readCurrency, () => "BRL" as DisplayCurrency);
  const setCurrency = (c: DisplayCurrency) => {
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {}
    currencyListeners.forEach((cb) => cb());
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
