"use client";
import { useEffect, useState } from "react";
import type { EmployeeAccount, EmployerAccount, TabbitClient } from "@tabbit/sdk";
import { Card, DemoBanner, ErrorText, Money, shortKey } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatWindow } from "@/lib/time";
import { BENEFIT_MINT, explorerAddressUrl, useLoad, useTabbit } from "@/lib/tabbit";
import { EmployeeForm } from "./employee-form";
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
    tx.run(() => client.registerEmployer({ name: n, mint: BENEFIT_MINT, tzOffsetMinutes: tz }), onDone);
  }
  return (
    <Card title="Register your company">
      <p className="mb-4 text-sm opacity-70">Create your vault to start funding meal benefits for your team.</p>
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

function Dashboard({ client, employer, isMock, reloadEmployer }: {
  client: TabbitClient; employer: EmployerAccount; isMock: boolean; reloadEmployer: () => Promise<unknown>;
}) {
  const employees = useLoad(() => client.listEmployees(employer.owner), [client, employer.owner]);
  const payments = useLoad(() => client.listPayments({ employer: employer.address, limit: 10 }), [client, employer.address]);
  const [editing, setEditing] = useState<EmployeeAccount | "new" | null>(null);
  const revokeTx = useTx();
  const { reload: reloadEmployees } = employees;
  const { reload: reloadPayments } = payments;
  const refresh = () => Promise.all([reloadEmployer(), reloadEmployees(), reloadPayments()]);

  // Pagamentos novos mudam saldos e gasto do dia: recarrega tudo.
  useEffect(
    () => client.onPayment(() => void Promise.all([reloadEmployer(), reloadEmployees(), reloadPayments()])),
    [client, reloadEmployer, reloadEmployees, reloadPayments]
  );

  function revoke(e: EmployeeAccount) {
    if (!confirm(`Revoke ${shortKey(e.wallet)}? They will no longer be able to pay with Tabbit.`)) return;
    revokeTx.run(() => client.revokeEmployee(e.wallet), refresh);
  }

  const free = employer.totalDeposited - employer.totalAllocated;
  return (
    <div className="space-y-6">
      <Vault client={client} employer={employer} isMock={isMock} onChanged={refresh} />

      {editing && (
        <EmployeeForm key={editing === "new" ? "new" : editing.wallet.toBase58()} client={client} isMock={isMock} unallocated={free}
          editing={editing === "new" ? null : editing} onSaved={refresh} onCancel={() => setEditing(null)} />
      )}

      <Card title="Employees">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => setEditing("new")}>Add employee</button>
          <TxStatus error={revokeTx.error} sig={revokeTx.sig} isMock={isMock} />
        </div>
        {employees.error ? <ErrorText>{friendlyError(employees.error)}</ErrorText>
          : !employees.data ? <p className="text-sm opacity-60">Loading…</p>
          : employees.data.length === 0 ? <p className="text-sm opacity-70">No employees yet. Add one to start allocating meal benefits.</p>
          : (
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-ink/10 text-xs opacity-70">
                  <tr>
                    {["Wallet", "Balance", "Max / meal", "Daily cap", "Spent today", "Meal hours", "Status", ""].map((h, i) => (
                      <th key={i} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.data.map((e) => (
                    <tr key={e.address.toBase58()} className="border-b border-ink/5 align-top last:border-0">
                      <td className="px-2 py-2.5 font-mono">
                        <a className="underline decoration-ink/30 hover:decoration-ink" href={explorerAddressUrl(e.wallet)} target="_blank" rel="noreferrer">{shortKey(e.wallet)}</a>
                      </td>
                      <td className="px-2 py-2.5"><Money base={e.balance} /></td>
                      <td className="px-2 py-2.5"><Money base={e.maxPerMeal} /></td>
                      <td className="px-2 py-2.5"><Money base={e.dailyCap} /></td>
                      <td className="px-2 py-2.5"><Money base={e.spentToday} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5">{formatWindow(e.windowStartMin, e.windowEndMin)}</td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.active ? "bg-brand/25" : "bg-red-100 text-red-700"}`}>
                          {e.active ? "Active" : "Revoked"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">
                        <button className="underline" onClick={() => setEditing(e)}>{e.active ? "Edit" : "Reactivate"}</button>
                        {e.active && (
                          <button className="ml-3 text-red-700 underline disabled:opacity-50" disabled={revokeTx.pending} onClick={() => revoke(e)}>
                            {revokeTx.pending ? "…" : "Revoke"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

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
