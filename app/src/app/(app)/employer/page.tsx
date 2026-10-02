"use client";
import { useEffect, useState } from "react";
import type { EmployeeAccount, EmployerAccount, TabbitClient } from "@tabbit/sdk";
import { Card, DemoBanner, ErrorText, Money, shortKey } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { useLoad, useTabbit } from "@/lib/tabbit";
import { EmployeeForm } from "./employee-form";
import { EmployeesCard } from "./employees";
import { CopyButton } from "../employee/shared";
import { TxStatus, useTx } from "./tx";
import { Vault } from "./vault";

const TIMEZONES = [
  { label: "Brasília (UTC-3)", min: -180 },
  { label: "New York (UTC-4)", min: -240 },
  { label: "Lisbon (UTC+1)", min: 60 },
  { label: "UTC", min: 0 },
  { label: "Madrid (UTC+2)", min: 120 },
];

function RegisterForm({ client, isMock, onDone }: { client: TabbitClient; isMock: boolean; onDone: () => Promise<unknown> | void }) {
  const [name, setName] = useState("");
  const [tz, setTz] = useState(-180);
  const tx = useTx();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > 32) return tx.setError("Company name must be 1 to 32 characters");
    tx.run(() => client.registerEmployer({ name: n, tzOffsetMinutes: tz }), onDone);
  }
  return (
    <Card title="Register your company">
      <p className="mb-4 text-sm opacity-70">
        Create your company vault. The Tabbit team reviews every company (contract and verification) before it can fund benefits; we will contact you after you register.
      </p>
      <form onSubmit={submit} className="grid max-w-md gap-4">
        <div>
          <label className="label" htmlFor="reg-name">Company name</label>
          <input id="reg-name" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
        </div>
        <div>
          <label className="label" htmlFor="reg-tz">Timezone (for daily caps and meal hours)</label>
          <select id="reg-tz" className="input" value={tz} onChange={(e) => setTz(Number(e.target.value))}>
            {TIMEZONES.map((t) => <option key={t.min} value={t.min}>{t.label}</option>)}
          </select>
        </div>
        <div><button className="btn-primary" disabled={tx.pending}>{tx.pending ? "…" : "Register company"}</button></div>
        <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
      </form>
    </Card>
  );
}

function PendingApproval({ employer }: { employer: EmployerAccount }) {
  return (
    <div role="status" className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
      <p className="text-lg font-bold text-amber-900">Waiting for Tabbit approval</p>
      <p className="mt-1 text-sm text-amber-900/80">
        {employer.name} is registered. Once our team approves it you can deposit and add employees. Share this wallet with your Tabbit contact:
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-white/70 px-3 py-2 text-xs">{employer.owner.toBase58()}</code>
        <CopyButton text={employer.owner.toBase58()} />
      </div>
    </div>
  );
}

function Dashboard({ client, employer, isMock, reloadEmployer }: {
  client: TabbitClient; employer: EmployerAccount; isMock: boolean; reloadEmployer: () => Promise<unknown>;
}) {
  const employees = useLoad(() => client.listEmployees(employer.owner), [client, employer.owner]);
  const payments = useLoad(() => client.listPayments({ employer: employer.address, limit: 10 }), [client, employer.address]);
  const [editing, setEditing] = useState<EmployeeAccount | "new" | null>(null);
  const { reload: reloadEmployees } = employees;
  const { reload: reloadPayments } = payments;
  const refresh = () => Promise.all([reloadEmployer(), reloadEmployees(), reloadPayments()]);

  // Pagamentos novos mudam saldos e gasto do dia: recarrega tudo.
  useEffect(
    () => client.onPayment(() => void Promise.all([reloadEmployer(), reloadEmployees(), reloadPayments()])),
    [client, reloadEmployer, reloadEmployees, reloadPayments]
  );

  const free = employer.totalDeposited - employer.totalAllocated;
  return (
    <div className="space-y-6">
      {!employer.approved && <PendingApproval employer={employer} />}
      <Vault client={client} employer={employer} isMock={isMock} onChanged={refresh} />

      {editing && (
        <EmployeeForm key={editing === "new" ? "new" : editing.wallet.toBase58()} client={client} isMock={isMock} unallocated={free}
          editing={editing === "new" ? null : editing} onSaved={refresh} onCancel={() => setEditing(null)} />
      )}

      <EmployeesCard client={client} employer={employer} employees={employees.data} error={employees.error} isMock={isMock}
        onChanged={refresh} onAdd={() => setEditing("new")} onEdit={(e) => setEditing(e)} />

      <Card title="Recent payments">
        {payments.error ? <ErrorText>{friendlyError(payments.error)}</ErrorText>
          : !payments.data ? <p className="text-sm opacity-60">Loading…</p>
          : payments.data.length === 0 ? <p className="text-sm opacity-70">No payments yet. They show up here the moment a worker pays a restaurant.</p>
          : (
            <ul className="divide-y divide-ink/10 text-sm">
              {payments.data.map((p) => (
                <li key={p.signature} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span>
                    <span className="font-mono">{shortKey(p.employee)}</span>
                    <span className="ml-2 opacity-60">{new Date(p.timestamp * 1000).toLocaleString()}</span>
                  </span>
                  <span>
                    <Money base={p.amount} className="font-semibold" />{" "}
                    <span className="text-xs opacity-60">fee <Money base={p.fee} /></span>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Card>
    </div>
  );
}

export default function EmployerPage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("employer");
  const employer = useLoad(() => (actor ? client.getEmployer(actor) : Promise.resolve(null)), [client, actor]);

  return (
    <div>
      <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="Acme Corp (employer)" />
      <h1 className="mb-4 text-2xl font-bold">Employer</h1>
      {!actor ? (
        <Card title="Connect your wallet"><p className="text-sm opacity-70">Connect the wallet that owns your company vault, using the button in the header.</p></Card>
      ) : employer.error ? (
        <ErrorText>{friendlyError(employer.error)}</ErrorText>
      ) : employer.data === undefined ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : employer.data === null ? (
        <RegisterForm client={client} isMock={isMock} onDone={employer.reload} />
      ) : (
        <Dashboard client={client} employer={employer.data} isMock={isMock} reloadEmployer={employer.reload} />
      )}
    </div>
  );
}
