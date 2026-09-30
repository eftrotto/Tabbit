"use client";
// Escolhe o cliente: mock (padrão) ou SDK real com NEXT_PUBLIC_USE_MOCK=false.
import { useCallback, useEffect, useMemo, useState } from "react";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { createTabbitClient, USDC_DEVNET_MINT, type TabbitClient } from "@tabbit/sdk";
import { createMockClient, DEMO } from "./mock-client";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
// Mint do benefício. O seed do Dev A usa um token de teste próprio; sem env, USDC da Circle (devnet).
export const BENEFIT_MINT = process.env.NEXT_PUBLIC_MINT ? new PublicKey(process.env.NEXT_PUBLIC_MINT) : USDC_DEVNET_MINT;

export const explorerTxUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddressUrl = (addr: PublicKey | string) =>
  `https://explorer.solana.com/address/${addr.toString()}?cluster=devnet`;

export type Role = "employer" | "employee" | "merchant";

// No mock, sem carteira conectada, cada visão age como uma persona da demo.
const PERSONA: Record<Role, PublicKey> = { employer: DEMO.employer, employee: DEMO.employee, merchant: DEMO.merchant };

export interface TabbitContext {
  client: TabbitClient;
  /** Carteira que age nesta visão: a conectada ou, no mock, a persona da demo. null = ninguém conectado. */
  actor: PublicKey | null;
  isMock: boolean;
  isDemoPersona: boolean;
}

export function useTabbit(role: Role): TabbitContext {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => {
    if (!USE_MOCK) {
      return { client: createTabbitClient({ connection, wallet }), actor: wallet?.publicKey ?? null, isMock: false, isDemoPersona: false };
    }
    const actor = wallet?.publicKey ?? PERSONA[role];
    return { client: createMockClient(actor), actor, isMock: true, isDemoPersona: !wallet };
  }, [connection, wallet, role]);
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
