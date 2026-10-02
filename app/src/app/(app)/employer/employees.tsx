"use client";
// Lista de funcionários pensada para empresas grandes: busca, filtro, paginação,
// importação de planilha, recarga em massa e exportação.
import { useMemo, useState } from "react";
import type { EmployeeAccount, EmployerAccount, TabbitClient, UpsertEmployeeInput } from "@tabbit/sdk";
import { Card, ErrorText, Money, shortKey } from "@/components/ui";
import { CSV_TEMPLATE, employeesToCsv, parseEmployeesCsv, type CsvResult } from "@/lib/csv";
import { parseUsdc } from "@/lib/currency";
import { friendlyError } from "@/lib/errors";
import { formatWindow } from "@/lib/time";
import { explorerAddressUrl } from "@/lib/tabbit";
import { TxStatus, useTx } from "./tx";

const PAGE = 20;
type Filter = "all" | "active" | "revoked" | "low";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "low", label: "Low balance" },
  { value: "revoked", label: "Revoked" },
];
type Panel = null | "import" | "topup";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function EmployeesCard({ client, employer, employees, error, isMock, onChanged, onAdd, onEdit }: {
  client: TabbitClient;
  employer: EmployerAccount;
  employees: EmployeeAccount[] | undefined;
  error: unknown;
  isMock: boolean;
  onChanged: () => Promise<unknown>;
  onAdd: () => void;
  onEdit: (e: EmployeeAccount) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const revokeTx = useTx();
  const free = employer.totalDeposited - employer.totalAllocated;
  const disabled = !employer.approved;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (employees ?? [])
      .filter((e) => !q || e.wallet.toBase58().toLowerCase().includes(q))
      .filter((e) =>
        filter === "active" ? e.active : filter === "revoked" ? !e.active : filter === "low" ? e.active && e.balance < e.maxPerMeal : true
      )
      .sort((a, b) => Number(b.active) - Number(a.active) || (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  }, [employees, query, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);

  function revoke(e: EmployeeAccount) {
    if (!confirm(`Revoke ${shortKey(e.wallet)}? They will no longer be able to pay with Tabbit.`)) return;
    void revokeTx.run(() => client.revokeEmployee(e.wallet), onChanged);
  }

  const active = (employees ?? []).filter((e) => e.active);
  return (
    <Card title={`Employees${employees ? ` (${active.length} active)` : ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={disabled} onClick={onAdd}>Add employee</button>
        <button className="btn-secondary" disabled={disabled} onClick={() => setPanel(panel === "import" ? null : "import")}>Import spreadsheet</button>
        <button className="btn-secondary" disabled={disabled || active.length === 0} onClick={() => setPanel(panel === "topup" ? null : "topup")}>Top up everyone</button>
        <button className="btn-secondary" disabled={!employees?.length} onClick={() => download("tabbit-employees.csv", employeesToCsv(employees ?? []))}>Export CSV</button>
      </div>

      {panel === "import" && (
        <ImportPanel client={client} employees={employees ?? []} free={free} isMock={isMock} onDone={async () => { setPanel(null); await onChanged(); }} />
      )}
      {panel === "topup" && (
        <TopUpPanel client={client} active={active} free={free} isMock={isMock} onDone={async () => { setPanel(null); await onChanged(); }} />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="emp-search">Search</label>
        <input id="emp-search" className="input !w-auto min-w-0 flex-1 text-sm" placeholder="Search by wallet address" value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        <div className="flex gap-1 rounded-xl bg-ink/[0.05] p-1 text-sm" role="group" aria-label="Filter employees">
          {FILTERS.map((f) => (
            <button key={f.value} aria-pressed={filter === f.value}
              className={`rounded-lg px-3 py-1 font-semibold ${filter === f.value ? "bg-ink text-brand" : "text-ink/60 hover:text-ink"}`}
              onClick={() => { setFilter(f.value); setPage(0); }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <TxStatus error={revokeTx.error} sig={revokeTx.sig} isMock={isMock} />

      {error ? <ErrorText>{friendlyError(error)}</ErrorText>
        : !employees ? <p className="text-sm opacity-60">Loading…</p>
        : employees.length === 0 ? <p className="text-sm opacity-70">No employees yet. Add one, or import a spreadsheet to add your whole team at once.</p>
        : filtered.length === 0 ? <p className="text-sm opacity-70">No employees match this search.</p>
        : (
          <>
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
                  {shown.map((e) => (
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
                        <button className="underline disabled:opacity-50" disabled={disabled} onClick={() => onEdit(e)}>{e.active ? "Edit" : "Reactivate"}</button>
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
            {pages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="opacity-60">{current * PAGE + 1}–{Math.min((current + 1) * PAGE, filtered.length)} of {filtered.length}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary !px-3 !py-1" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
                  <button className="btn-secondary !px-3 !py-1" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
    </Card>
  );
}

function ImportPanel({ client, employees, free, isMock, onDone }: {
  client: TabbitClient; employees: EmployeeAccount[]; free: bigint; isMock: boolean; onDone: () => Promise<unknown>;
}) {
  const [parsed, setParsed] = useState<(CsvResult & { file: string }) | null>(null);
  const tx = useTx();

  // Quanto a mais sai do saldo livre: saldo novo menos o que cada um já tinha
  const current = new Map(employees.map((e) => [e.wallet.toBase58(), e.balance]));
  const extra = (parsed?.rows ?? []).reduce((s, r) => s + r.balance - (current.get(r.wallet.toBase58()) ?? 0n), 0n);
  const updates = (parsed?.rows ?? []).filter((r) => current.has(r.wallet.toBase58())).length;

  return (
    <div className="mb-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4">
      <p className="text-sm font-semibold">Import a spreadsheet</p>
      <p className="mt-1 text-sm opacity-70">
        CSV with columns <code>wallet, balance, max_per_meal, daily_cap</code> and optional <code>meal_start, meal_end</code> (HH:MM).
        Excel files saved as CSV with <code>;</code> work too. Employees already on the list are updated.{" "}
        <button className="underline" onClick={() => download("tabbit-template.csv", CSV_TEMPLATE)}>Download template</button>
      </p>
      <input className="mt-3 block text-sm" type="file" accept=".csv,text/csv" aria-label="Spreadsheet file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          tx.setError(undefined);
          setParsed(f ? { ...parseEmployeesCsv(await f.text()), file: f.name } : null);
        }} />
      {parsed && (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <b>{parsed.rows.length}</b> employees ready ({parsed.rows.length - updates} new, {updates} updated) ·
            needs <b><Money base={extra > 0n ? extra : 0n} /></b> of <Money base={free} /> unallocated
          </p>
          {parsed.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-lg bg-red-50 p-2 text-red-700">
              {parsed.errors.map((er) => <li key={er.line}>Line {er.line}: {er.message}</li>)}
            </ul>
          )}
          {extra > free && <ErrorText>Not enough unallocated funds. Deposit more or lower the balances.</ErrorText>}
          <button className="btn-primary" disabled={tx.pending || parsed.rows.length === 0 || extra > free}
            onClick={() => void tx.run(async () => (await client.upsertEmployees(parsed.rows)).at(-1) ?? "", onDone)}>
            {tx.pending ? "Saving…" : `Save ${parsed.rows.length} employees`}
          </button>
          <p className="text-xs opacity-60">Your wallet asks for one approval; employees are saved in batches of 8 per transaction.</p>
        </div>
      )}
      <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
    </div>
  );
}

function TopUpPanel({ client, active, free, isMock, onDone }: {
  client: TabbitClient; active: EmployeeAccount[]; free: bigint; isMock: boolean; onDone: () => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  const tx = useTx();
  const amount = parseUsdc(value);
  const total = amount ? amount * BigInt(active.length) : 0n;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!amount) return tx.setError("Enter an amount greater than zero, e.g. 300");
    if (total > free) return tx.setError("Not enough unallocated funds. Deposit more first.");
    const inputs: UpsertEmployeeInput[] = active.map((e) => ({
      wallet: e.wallet, balance: e.balance + amount, maxPerMeal: e.maxPerMeal, dailyCap: e.dailyCap,
      windowStartMin: e.windowStartMin, windowEndMin: e.windowEndMin,
    }));
    void tx.run(async () => (await client.upsertEmployees(inputs)).at(-1) ?? "", async () => { setValue(""); await onDone(); });
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4">
      <p className="text-sm font-semibold">Monthly top-up</p>
      <p className="mt-1 text-sm opacity-70">Adds the same amount to every active employee&apos;s balance, keeping their limits.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="topup">Amount per employee (USDC)</label>
        <input id="topup" className="input !w-40" inputMode="decimal" placeholder="Per employee" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-primary" disabled={tx.pending}>{tx.pending ? "Saving…" : `Top up ${active.length} employees`}</button>
        {amount ? <span className="text-sm opacity-70">Total <Money base={total} /> of <Money base={free} /> unallocated</span> : null}
      </div>
      <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
    </form>
  );
}
