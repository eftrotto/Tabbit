"use client";
// Resumo do cofre (depositado / alocado / livre) + formulários de depósito e retirada.
import { useState } from "react";
import type { EmployerAccount, TabbitClient } from "@tabbit/sdk";
import { Card, Money } from "@/components/ui";
import { parseUsdc } from "@/lib/currency";
import { TxStatus, useTx } from "./tx";

function AmountForm({ label, cta, hint, isMock, write, onDone, disabled }: {
  label: string; cta: string; hint?: string; isMock: boolean; disabled?: boolean;
  write: (amount: bigint) => Promise<string>; onDone: () => Promise<unknown> | void;
}) {
  const [value, setValue] = useState("");
  const tx = useTx();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseUsdc(value);
    if (amount === null || amount === 0n) return tx.setError("Enter an amount greater than zero, e.g. 100 or 25.50");
    tx.run(() => write(amount), async () => { setValue(""); await onDone(); });
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="label" htmlFor={`amt-${cta}`}>{label}</label>
      <div className="flex gap-2">
        <input id={`amt-${cta}`} className="input" inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={tx.pending || disabled}>{tx.pending ? "…" : cta}</button>
      </div>
      {hint && <p className="text-xs opacity-60">{hint}</p>}
      <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
    </form>
  );
}

export function Vault({ client, employer, isMock, onChanged }: {
  client: TabbitClient; employer: EmployerAccount; isMock: boolean; onChanged: () => Promise<unknown> | void;
}) {
  const { totalDeposited: dep, totalAllocated: alloc } = employer;
  const free = dep - alloc;
  const pct = dep > 0n ? Number((alloc * 100n) / dep) : 0;
  return (
    <Card title={`${employer.name} vault`}>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm opacity-70">Deposited</dt><dd className="text-xl font-semibold"><Money base={dep} /></dd></div>
        <div><dt className="text-sm opacity-70">Allocated to employees</dt><dd className="text-xl font-semibold"><Money base={alloc} /></dd></div>
        <div><dt className="text-sm opacity-70">Unallocated</dt><dd className="text-xl font-semibold"><Money base={free} /></dd></div>
      </dl>
      <div className="mt-4" role="img" aria-label={`${pct}% of the vault is allocated to employees`}>
        <div className="h-3 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-60">{pct}% allocated</p>
      </div>
      <div className="mt-5 grid gap-6 border-t border-ink/10 pt-5 sm:grid-cols-2">
        <AmountForm label="Deposit (USDC)" cta="Deposit" isMock={isMock} write={(a) => client.deposit(a)} onDone={onChanged}
          disabled={!employer.approved} hint={employer.approved ? undefined : "Available after Tabbit approves your company."} />
        <AmountForm label="Withdraw unallocated (USDC)" cta="Withdraw" hint="Only funds not assigned to an employee can leave the vault." isMock={isMock}
          write={(a) => client.withdrawUnallocated(a)} onDone={onChanged} />
      </div>
    </Card>
  );
}
