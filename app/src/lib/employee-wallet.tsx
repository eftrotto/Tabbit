"use client";
// Login do funcionário com e-mail, Google ou SMS (Privy): a carteira Solana é criada no login e
// assina por baixo, sem extensão nem SOL (o fee payer paga a taxa). Empresa e restaurante seguem na Phantom.
// Sem NEXT_PUBLIC_PRIVY_APP_ID (ou no mock), nada disto carrega e o app funciona como antes.
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useExportWallet, useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { AnchorWallet } from "@tabbit/sdk";
import { RPC_URL, USE_MOCK } from "./config";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const EMPLOYEE_LOGIN_ENABLED = !!PRIVY_APP_ID && !USE_MOCK;
const CHAIN = "solana:devnet";

type Status = "disabled" | "loading" | "signed-out" | "creating-wallet" | "ready";

export interface EmployeeLogin {
  status: Status;
  /** Carteira embutida do funcionário, no formato que o SDK usa. null até estar pronta. */
  wallet: AnchorWallet | null;
  /** E-mail ou telefone de quem entrou, para mostrar no cabeçalho. */
  label: string | null;
  login(): void;
  logout(): Promise<void>;
  exportKey(): Promise<void>;
}

const noop = async () => {};
const DISABLED: EmployeeLogin = { status: "disabled", wallet: null, label: null, login: () => {}, logout: noop, exportKey: noop };
const Ctx = createContext<EmployeeLogin>(DISABLED);

export const useEmployeeLogin = () => useContext(Ctx);

export function EmployeeLoginProvider({ children }: { children: ReactNode }) {
  if (!EMPLOYEE_LOGIN_ENABLED) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "google", "sms"],
        appearance: { walletChainType: "solana-only", theme: "light", accentColor: "#1EE88A" },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          ethereum: { createOnLogin: "off" },
          // O app já tem a própria tela de confirmação do pagamento
          showWalletUIs: false,
        },
        solana: {
          rpcs: {
            [CHAIN]: {
              rpc: createSolanaRpc(RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(RPC_URL.replace(/^http/, "ws")),
            },
          },
        },
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { exportWallet } = useExportWallet();

  const privyWallet = wallets[0] ?? null;
  const address = privyWallet?.address ?? null;

  // A função de assinatura do hook muda a cada render; a carteira só muda quando muda o endereço,
  // senão o cliente do SDK seria recriado (e os dados recarregados) a cada render.
  const latest = useRef({ signTransaction, privyWallet });
  useEffect(() => {
    latest.current = { signTransaction, privyWallet };
  });

  const wallet = useMemo<AnchorWallet | null>(() => {
    if (!address) return null;
    const sign = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      const { signTransaction: signWithPrivy, privyWallet: w } = latest.current;
      if (!w) throw new Error("Wallet not ready");
      // O SDK usa web3.js v1; o Privy assina bytes
      const bytes = tx instanceof VersionedTransaction ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await signWithPrivy({ transaction: bytes, wallet: w, chain: CHAIN });
      return (tx instanceof VersionedTransaction ? VersionedTransaction.deserialize(signedTransaction) : Transaction.from(signedTransaction)) as T;
    };
    return {
      publicKey: new PublicKey(address),
      signTransaction: sign,
      signAllTransactions: (txs) => Promise.all(txs.map(sign)),
    };
  }, [address]);

  const status: Status = !ready || !walletsReady ? "loading" : !authenticated ? "signed-out" : address ? "ready" : "creating-wallet";
  const label = user?.email?.address ?? user?.google?.email ?? user?.phone?.number ?? null;

  const value = useMemo<EmployeeLogin>(
    () => ({
      status,
      wallet,
      label,
      login: () => login(),
      logout,
      exportKey: () => (address ? exportWallet({ address }) : Promise.resolve()),
    }),
    [status, wallet, label, login, logout, exportWallet, address]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
