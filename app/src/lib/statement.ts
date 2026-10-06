// Extrato mensal (funcionário e empresa): período do mês no horário de Brasília, totais,
// resumo por funcionário e CSV para a contabilidade do PAT.
import type { Payment, Refund } from "@tabbit/sdk";
import { usdcToInput } from "./currency.ts";

const TZ_MINUTES = -180;

/** "2026-10" → [início, fim) em unix, no horário de Brasília. */
export function monthRange(month: string): { since: number; until: number } {
  const [y, m] = month.split("-").map(Number);
  const offset = TZ_MINUTES * 60;
  return { since: Date.UTC(y, m - 1, 1) / 1000 - offset, until: Date.UTC(y, m, 1) / 1000 - offset };
}

/** Os últimos `n` meses ("2026-10", "2026-09", …), do atual para trás. */
export function recentMonths(n: number, now = Date.now() / 1000): string[] {
  const local = new Date((now + TZ_MINUTES * 60) * 1000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export interface StatementRow {
  kind: "payment" | "refund";
  signature: string;
  timestamp: number;
  employee: string;
  merchant: string;
  amount: bigint;
  fee: bigint; // taxa paga pelo restaurante (0 em estornos)
}

export interface EmployeeSummary {
  employee: string;
  payments: number;
  spent: bigint;
  refunded: bigint;
  net: bigint;
}

export interface Statement {
  rows: StatementRow[]; // mais antigas primeiro, como um extrato
  totals: { payments: number; spent: bigint; refunded: bigint; net: bigint; restaurantFees: bigint };
  byEmployee: EmployeeSummary[]; // quem mais gastou primeiro
}

export function buildStatement(payments: Payment[], refunds: Refund[]): Statement {
  const rows: StatementRow[] = [
    ...payments.map((p) => ({ kind: "payment" as const, signature: p.signature, timestamp: p.timestamp, employee: p.employee.toBase58(), merchant: p.merchant.toBase58(), amount: p.amount, fee: p.fee })),
    ...refunds.map((r) => ({ kind: "refund" as const, signature: r.signature, timestamp: r.timestamp, employee: r.employee.toBase58(), merchant: r.merchant.toBase58(), amount: r.amount, fee: 0n })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const by = new Map<string, EmployeeSummary>();
  for (const r of rows) {
    const s = by.get(r.employee) ?? { employee: r.employee, payments: 0, spent: 0n, refunded: 0n, net: 0n };
    if (r.kind === "payment") {
      s.payments += 1;
      s.spent += r.amount;
    } else s.refunded += r.amount;
    s.net = s.spent - s.refunded;
    by.set(r.employee, s);
  }

  const spent = payments.reduce((t, p) => t + p.amount, 0n);
  const refunded = refunds.reduce((t, r) => t + r.amount, 0n);
  return {
    rows,
    totals: { payments: payments.length, spent, refunded, net: spent - refunded, restaurantFees: payments.reduce((t, p) => t + p.fee, 0n) },
    byEmployee: [...by.values()].sort((a, b) => (b.net > a.net ? 1 : b.net < a.net ? -1 : 0)),
  };
}

const iso = (unix: number) => new Date((unix + TZ_MINUTES * 60) * 1000).toISOString().slice(0, 16).replace("T", " ");
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV do extrato. Horário de Brasília; valores em USDC; estornos com valor negativo. */
export function statementCsv(rows: StatementRow[], merchantNames: Record<string, string>): string {
  const head = ["date_brt", "type", "employee_wallet", "restaurant", "amount_usdc", "restaurant_fee_usdc", "transaction"];
  const body = rows.map((r) =>
    [
      iso(r.timestamp),
      r.kind,
      r.employee,
      merchantNames[r.merchant] ?? r.merchant,
      (r.kind === "refund" ? "-" : "") + usdcToInput(r.amount),
      usdcToInput(r.fee),
      r.signature,
    ]
      .map(csvCell)
      .join(",")
  );
  return [head.join(","), ...body].join("\n") + "\n";
}
