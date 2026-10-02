"use client";
// Escolhe o cliente: mock (padrão) ou SDK real com NEXT_PUBLIC_USE_MOCK=false.
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { createTabbitClient, type TabbitClient } from "@tabbit/sdk";
import { createMockClient, DEMO } from "./mock-client";
import { fetchSponsorKey, sponsorFor } from "./sponsor";
import { useEmployeeLogin } from "./employee-wallet";
import { RPC_URL, USE_MOCK } from "./config";

export { RPC_URL, USE_MOCK };


export const explorerTxUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddressUrl = (addr: PublicKey | string) =>
  `https://explorer.solana.com/address/${addr.toString()}?cluster=devnet`;

export type Role = "employer" | "employee" | "merchant" | "admin";

// No mock, sem carteira conectada, cada visão age como uma persona da demo.
const PERSONA: Record<Role, PublicKey> = { employer: DEMO.employer, employee: DEMO.employee, merchant: DEMO.merchant, admin: DEMO.platform };

export interface TabbitContext {
  client: TabbitClient;
  /** Carteira que age nesta visão: a conectada ou, no mock, a persona da demo. null = ninguém conectado. */
  actor: PublicKey | null;
  isMock: boolean;
  isDemoPersona: boolean;
}

export function useTabbit(role: Role): TabbitContext {
  const { connection } = useConnection();
  const adapterWallet = useAnchorWallet();
  const employeeLogin = useEmployeeLogin();
  // Funcionário logado por e-mail/Google usa a carteira embutida; o resto, a Phantom
  const wallet = (role === "employee" && employeeLogin.wallet) || adapterWallet;
  const sponsorKey = useSponsorKey(role === "employee");
  return useMemo(() => {
    if (!USE_MOCK) {
      // Só o funcionário é patrocinado: empresa e plataforma pagam as próprias taxas
      const sponsor = sponsorKey ? sponsorFor(sponsorKey) : undefined;
      return { client: createTabbitClient({ connection, wallet, sponsor }), actor: wallet?.publicKey ?? null, isMock: false, isDemoPersona: false };
    }
    const actor = wallet?.publicKey ?? PERSONA[role];
    return { client: createMockClient(actor), actor, isMock: true, isDemoPersona: !wallet };
  }, [connection, wallet, role, sponsorKey]);
}

/** Chave do fee payer (null no mock, fora da visão do funcionário ou sem patrocinador no servidor). */
function useSponsorKey(enabled: boolean): PublicKey | null {
  const [key, setKey] = useState<PublicKey | null>(null);
  useEffect(() => {
    if (USE_MOCK || !enabled) return;
    let alive = true;
    fetchSponsorKey().then((k) => alive && setKey(k));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? key : null;
}

/** Carrega dados assíncronos. `loading` só no primeiro carregamento; `reload()` recarrega mantendo os dados atuais. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ data }),
      (error) => alive && setState((s) => ({ ...s, error }))
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => {
    setTick((t) => t + 1);
    return Promise.resolve();
  }, []);
  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error, reload };
}
