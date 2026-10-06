"use client";
// Diretório de funcionários (nome, e-mail, matrícula) do lado do app.
// Real: /api/directory, provando com uma assinatura da carteira da empresa (vale 12 h nesta aba).
// Demo: localStorage, já com nomes para as personas.
import { useCallback, useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { findEmployerPda } from "@tabbit/sdk";
import { AUTH_HEADER, AUTH_VALID_SECONDS, authMessage, encodeAuth } from "./directory-auth";
import { DEMO } from "./mock-client";

export interface DirectoryEntry {
  wallet: string;
  name: string | null;
  email: string | null;
  employeeId: string | null;
}

/** Para gravar: campo ausente mantém, "" apaga. */
export type DirectoryUpdate = { wallet: string } & Partial<Omit<DirectoryEntry, "wallet">>;

export type DirectoryStatus = "off" | "checking" | "locked" | "loading" | "ready" | "error";

export interface Directory {
  status: DirectoryStatus;
  /** carteira → dados */
  entries: Map<string, DirectoryEntry>;
  error: string | null;
  /** Pede a assinatura da carteira e carrega os nomes. */
  unlock(): Promise<void>;
  save(updates: DirectoryUpdate[]): Promise<void>;
}

const MOCK_KEY = "tabbit-mock-directory-v1";
const MOCK_SEED: DirectoryEntry[] = [
  { wallet: DEMO.employee.toBase58(), name: "João Silva", email: "joao@acme.example", employeeId: "ACM-001" },
  { wallet: DEMO.employee2.toBase58(), name: "Maria Souza", email: "maria@acme.example", employeeId: "ACM-002" },
];

function readMock(employer: string): DirectoryEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(MOCK_KEY) ?? "null") as Record<string, DirectoryEntry[]> | null;
    if (all) return all[employer] ?? [];
  } catch {}
  return employer === findEmployerPda(DEMO.employer).toBase58() ? MOCK_SEED : [];
}

function writeMock(employer: string, list: DirectoryEntry[]) {
  try {
    const all = (JSON.parse(localStorage.getItem(MOCK_KEY) ?? "null") as Record<string, DirectoryEntry[]> | null) ?? {};
    localStorage.setItem(MOCK_KEY, JSON.stringify({ ...all, [employer]: list }));
  } catch {}
}

/** Mesma regra do servidor: ausente mantém, "" apaga. */
function merge(current: DirectoryEntry | undefined, u: DirectoryUpdate): DirectoryEntry {
  const pick = (next: string | null | undefined, prev: string | null | undefined) => (next === undefined || next === null ? prev ?? null : next.trim() || null);
  return { wallet: u.wallet, name: pick(u.name, current?.name), email: pick(u.email?.toLowerCase(), current?.email), employeeId: pick(u.employeeId, current?.employeeId) };
}

const tokenKey = (owner: string) => `tabbit-directory-auth:${owner}`;
function storedToken(owner: string): string | null {
  try {
    const raw = sessionStorage.getItem(tokenKey(owner));
    if (!raw) return null;
    const { token, issuedAt } = JSON.parse(raw) as { token: string; issuedAt: number };
    return Date.now() / 1000 - issuedAt < AUTH_VALID_SECONDS - 600 ? token : null;
  } catch {
    return null;
  }
}

export function useDirectory(owner: PublicKey | null, isMock: boolean): Directory {
  const { signMessage } = useWallet();
  const [status, setStatus] = useState<DirectoryStatus>(owner ? "checking" : "off");
  const [entries, setEntries] = useState<Map<string, DirectoryEntry>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const ownerKey = owner?.toBase58() ?? null;
  const employer = owner ? findEmployerPda(owner).toBase58() : null;

  const load = useCallback(
    async (token: string) => {
      setStatus("loading");
      const res = await fetch("/api/directory", { headers: { [AUTH_HEADER]: token } });
      const body = (await res.json().catch(() => ({}))) as { entries?: DirectoryEntry[]; error?: string };
      if (res.status === 401 && ownerKey) {
        sessionStorage.removeItem(tokenKey(ownerKey));
        setStatus("locked");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not load names");
      setEntries(new Map((body.entries ?? []).map((e) => [e.wallet, e])));
      setStatus("ready");
    },
    [ownerKey]
  );

  useEffect(() => {
    if (!ownerKey || !employer) return;
    let alive = true;
    (async () => {
      if (isMock) {
        if (alive) {
          setEntries(new Map(readMock(employer).map((e) => [e.wallet, e])));
          setStatus("ready");
        }
        return;
      }
      const token = storedToken(ownerKey);
      if (token) return load(token);
      // Sem banco configurado o servidor responde 503: a função some sem atrapalhar
      const probe = await fetch("/api/directory").catch(() => null);
      if (alive) setStatus(probe?.status === 401 ? "locked" : "off");
    })().catch((e) => alive && (setError(e instanceof Error ? e.message : String(e)), setStatus("error")));
    return () => {
      alive = false;
    };
  }, [ownerKey, employer, isMock, load]);

  const unlock = useCallback(async () => {
    if (!ownerKey) return;
    if (!signMessage) {
      setError("This wallet can't sign messages");
      return;
    }
    setError(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signMessage(new TextEncoder().encode(authMessage(ownerKey, issuedAt)));
      const token = encodeAuth(ownerKey, issuedAt, signature);
      sessionStorage.setItem(tokenKey(ownerKey), JSON.stringify({ token, issuedAt }));
      await load(token);
    } catch (e) {
      setError(e instanceof Error && /reject/i.test(e.message) ? "Signature cancelled" : e instanceof Error ? e.message : String(e));
      setStatus("locked");
    }
  }, [ownerKey, signMessage, load]);

  const save = useCallback(
    async (updates: DirectoryUpdate[]) => {
      if (!ownerKey || !employer || updates.length === 0) return;
      if (isMock) {
        const next = new Map(entries);
        for (const u of updates) next.set(u.wallet, merge(next.get(u.wallet), u));
        writeMock(employer, [...next.values()]);
        setEntries(next);
        return;
      }
      const token = storedToken(ownerKey);
      if (!token) throw new Error("Sign in again to save names");
      const res = await fetch("/api/directory", {
        method: "PUT",
        headers: { "Content-Type": "application/json", [AUTH_HEADER]: token },
        body: JSON.stringify({ entries: updates }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save names");
      await load(token);
    },
    [ownerKey, employer, isMock, entries, load]
  );

  return { status, entries, error, unlock, save };
}
