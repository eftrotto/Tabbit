"use client";
// Extrato mensal: usado pelo funcionário (/employee/statement) e pela empresa (/employer/statement).
import { useState } from "react";
import Link from "next/link";
import { ThinkingOrb } from "thinking-orbs";
import type { HistoryFilter, TabbitClient } from "@tabbit/sdk";
import { Card, ErrorText, Money, shortKey } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { buildStatement, monthRange, recentMonths, statementCsv } from "@/lib/statement";
import { explorerTxUrl, useLoad } from "@/lib/tabbit";

const MONTHS = recentMonths(6);
const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

export function StatementView({ client, filter, title, back, byEmployee, fileName, isMock }: {
  client: TabbitClient;
  /** Quem: { employee } ou { employer } (PDA). O período vem do mês escolhido. */
  filter: Pick<HistoryFilter, "employee" | "employer">;
  title: string;
  back: string;
  byEmployee: boolean;
  fileName: string;
  isMock: boolean;
}) {
  const [month, setMonth] = useState(MONTHS[0]);
  const key = filter.employee?.toBase58() ?? filter.employer?.toBase58();
  const { data, error, loading } = useLoad(async () => {
    const range = monthRange(month);
    const [payments, refunds, merchants] = await Promise.all([
      client.listPayments({ ...filter, ...range }),
      client.listRefunds({ ...filter, ...range }),
      client.listMerchants(),
    ]);
    return { statement: buildStatement(payments, refunds), names: Object.fromEntries(merchants.map((m) => [m.wallet.toBase58(), m.name])) };
  }, [client, key, month]);

  function downloadCsv() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([statementCsv(data.statement.rows, data.names)], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `${fileName}-${month}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="text-sm underline">← Back</Link>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="month">Month</label>
          <select id="month" className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button className="btn-secondary" disabled={!data?.statement.rows.length} onClick={downloadCsv}>Download CSV</button>
          <button className="btn-secondary" disabled={!data} onClick={() => print()}>Print</button>
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm opacity-70">{monthLabel(month)} · Brasília time · every line links to the Solana transaction</p>
      </header>

      {error ? <ErrorText>{friendlyError(error)}</ErrorText>
        : loading || !data ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-16 text-center">
            <ThinkingOrb state="solving" size={64} theme="light" color="#07574f" style={{ width: 96, height: 96 }} aria-label="Loading statement" />
            <p className="font-semibold">Reading {monthLabel(month)} from Solana…</p>
            <p className="max-w-sm text-sm opacity-60">Every line comes from the chain. On the public devnet the first read of a month can take a little while.</p>
          </div>
        )
        : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Meals paid" value={<Money base={data.statement.totals.spent} />} />
              <Tile label="Refunded" value={<Money base={data.statement.totals.refunded} />} />
              <Tile label="Net spent" value={<Money base={data.statement.totals.net} />} strong />
              <Tile label="Payments" value={data.statement.totals.payments} />
            </div>

            {byEmployee && data.statement.byEmployee.length > 0 && (
              <Card title="By employee">
                <div className="-mx-2 overflow-x-auto px-2">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="border-b border-ink/10 text-xs opacity-70">
                      <tr>{["Employee wallet", "Payments", "Paid", "Refunded", "Net"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.statement.byEmployee.map((e) => (
                        <tr key={e.employee} className="border-b border-ink/5 last:border-0">
                          <td className="px-2 py-2 font-mono">{shortKey(e.employee)}</td>
                          <td className="px-2 py-2">{e.payments}</td>
                          <td className="px-2 py-2"><Money base={e.spent} /></td>
                          <td className="px-2 py-2"><Money base={e.refunded} /></td>
                          <td className="px-2 py-2 font-semibold"><Money base={e.net} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card title="Transactions">
              {data.statement.rows.length === 0 ? (
                <p className="text-sm opacity-60">Nothing in {monthLabel(month)}.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {data.statement.rows.map((r) => (
                    <li key={r.signature} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.kind === "refund" && <span className="mr-1.5 rounded-full bg-brand/25 px-2 py-0.5 text-xs font-semibold">Refund</span>}
                          {data.names[r.merchant] ?? "Restaurant"}
                          {byEmployee && <span className="ml-2 font-mono text-xs opacity-60">{shortKey(r.employee)}</span>}
                        </p>
                        <p className="text-xs opacity-60">
                          {new Date(r.timestamp * 1000).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {!isMock && <>{" · "}<a className="underline print:no-underline" href={explorerTxUrl(r.signature)} target="_blank" rel="noreferrer">{shortKey(r.signature)}</a></>}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">{r.kind === "refund" ? "+ " : "− "}<Money base={r.amount} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
    </div>
  );
}

function Tile({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${strong ? "bg-brand/25" : "bg-ink/5"}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
