"use client";
// Adicionar / editar funcionário (upsertEmployee). Saldo é o total alocado ao funcionário, não um acréscimo.
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { EmployeeAccount, TabbitClient } from "@tabbit/sdk";
import { Card, Money } from "@/components/ui";
import { parseUsdc, usdcToInput } from "@/lib/currency";
import { hhmmToMin, minToHHMM } from "@/lib/time";
import { TxStatus, useTx } from "./tx";

interface Props {
  client: TabbitClient;
  isMock: boolean;
  unallocated: bigint;
  editing: EmployeeAccount | null; // null = novo
  onSaved: () => Promise<unknown> | void;
  onCancel: () => void;
}

export function EmployeeForm({ client, isMock, unallocated, editing, onSaved, onCancel }: Props) {
  const hasWindow = !!editing && (editing.windowStartMin !== 0 || editing.windowEndMin !== 0);
  const [wallet, setWallet] = useState(editing?.wallet.toBase58() ?? "");
  const [balance, setBalance] = useState(editing ? usdcToInput(editing.balance) : "");
  const [maxPerMeal, setMaxPerMeal] = useState(editing ? usdcToInput(editing.maxPerMeal) : "");
  const [dailyCap, setDailyCap] = useState(editing ? usdcToInput(editing.dailyCap) : "");
  const [restrict, setRestrict] = useState(hasWindow);
  const [start, setStart] = useState(hasWindow ? minToHHMM(editing!.windowStartMin) : "11:00");
  const [end, setEnd] = useState(hasWindow ? minToHHMM(editing!.windowEndMin) : "15:00");
  const tx = useTx();

  // Ao editar, o saldo atual do funcionário volta a ficar disponível para realocação.
  const available = unallocated + (editing?.balance ?? 0n);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let pk: PublicKey;
    try {
      pk = new PublicKey(wallet.trim());
    } catch {
      return tx.setError("Enter a valid Solana wallet address");
    }
    const b = parseUsdc(balance);
    const m = parseUsdc(maxPerMeal);
    const d = parseUsdc(dailyCap);
    if (b === null || m === null || d === null) return tx.setError("Enter valid amounts, e.g. 25.50");
    if (m > d) return tx.setError("Max per meal can't be above the daily cap");
    const s = restrict ? hhmmToMin(start) : 0;
    const en = restrict ? hhmmToMin(end) : 0;
    if (restrict && (Number.isNaN(s) || Number.isNaN(en) || s >= en)) return tx.setError("Meal hours: start must be before end");
    tx.run(
      () => client.upsertEmployee({ wallet: pk, balance: b, maxPerMeal: m, dailyCap: d, windowStartMin: s, windowEndMin: en }),
      async () => {
        await onSaved();
        if (!editing) { setWallet(""); setBalance(""); setMaxPerMeal(""); setDailyCap(""); }
      }
    );
  }

  return (
    <Card title={editing ? "Edit employee" : "Add employee"}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="ef-wallet">Wallet address</label>
          <input id="ef-wallet" className="input font-mono text-sm read-only:bg-ink/5" value={wallet} readOnly={!!editing}
            onChange={(e) => setWallet(e.target.value)} placeholder="Employee's Solana wallet" autoComplete="off" required />
        </div>
        <div>
          <label className="label" htmlFor="ef-balance">Balance (USDC)</label>
          <input id="ef-balance" className="input" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="200" required />
        </div>
        <div>
          <label className="label" htmlFor="ef-max">Max per meal (USDC)</label>
          <input id="ef-max" className="input" inputMode="decimal" value={maxPerMeal} onChange={(e) => setMaxPerMeal(e.target.value)} placeholder="40" required />
        </div>
        <div>
          <label className="label" htmlFor="ef-cap">Daily cap (USDC)</label>
          <input id="ef-cap" className="input" inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} placeholder="60" required />
        </div>
        <div className="sm:col-span-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />
            Restrict to meal hours
          </label>
          {restrict && (
            <div className="mt-2 flex items-center gap-2">
              <input type="time" aria-label="Meal hours start" className="input !w-auto" value={start} onChange={(e) => setStart(e.target.value)} required />
              <span>to</span>
              <input type="time" aria-label="Meal hours end" className="input !w-auto" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          )}
        </div>
        <p className="text-sm opacity-70 sm:col-span-3">
          Available to allocate: <b><Money base={available} /></b>{editing && " (including this employee's current balance)"}
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button className="btn-primary" disabled={tx.pending}>
            {tx.pending ? "…" : editing ? "Save changes" : "Add employee"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={tx.pending}>
            {editing ? "Cancel" : "Close"}
          </button>
        </div>
        <div className="sm:col-span-3"><TxStatus error={tx.error} sig={tx.sig} isMock={isMock} /></div>
      </form>
    </Card>
  );
}
