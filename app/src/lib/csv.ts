// Planilha de funcionários (importar e exportar). Aceita "," ou ";" como separador; com ";"
// (Excel em português) os valores podem usar vírgula decimal. Valores em USDC, horários em HH:MM.
import { PublicKey } from "@solana/web3.js";
import type { EmployeeAccount, UpsertEmployeeInput } from "@tabbit/sdk";
import { parseUsdc, usdcToInput } from "./currency.ts";

export const CSV_COLUMNS = ["wallet", "balance", "max_per_meal", "daily_cap", "meal_start", "meal_end"] as const;
export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}\nPASTE_WALLET_ADDRESS,200,40,60,11:00,15:00\n`;

export interface CsvResult {
  rows: UpsertEmployeeInput[];
  errors: { line: number; message: string }[];
}

const toMinutes = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[1]) <= 24 && Number(m[2]) < 60 && min <= 1440 ? min : null;
};
const fromMinutes = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function parseEmployeesCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim());
  const headerAt = lines.findIndex((l) => l.length > 0);
  if (headerAt < 0) return { rows: [], errors: [{ line: 1, message: "The file is empty" }] };
  const sep = lines[headerAt].includes(";") ? ";" : ",";
  const header = lines[headerAt].split(sep).map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof CSV_COLUMNS)[number], number>;
  const missing = (["wallet", "balance", "max_per_meal", "daily_cap"] as const).filter((c) => col[c] < 0);
  if (missing.length) return { rows: [], errors: [{ line: headerAt + 1, message: `Missing columns: ${missing.join(", ")}` }] };

  const rows: UpsertEmployeeInput[] = [];
  const errors: CsvResult["errors"] = [];
  const seen = new Set<string>();
  lines.forEach((raw, i) => {
    if (i <= headerAt || raw.length === 0) return;
    const line = i + 1;
    const cells = raw.split(sep).map((c) => c.trim());
    const get = (c: (typeof CSV_COLUMNS)[number]) => (col[c] >= 0 ? cells[col[c]] ?? "" : "");
    const fail = (message: string) => errors.push({ line, message });

    let wallet: PublicKey;
    try {
      wallet = new PublicKey(get("wallet"));
    } catch {
      return fail(`Invalid wallet address "${get("wallet")}"`);
    }
    if (seen.has(wallet.toBase58())) return fail("Wallet appears twice in the file");

    const balance = parseUsdc(get("balance"));
    const maxPerMeal = parseUsdc(get("max_per_meal"));
    const dailyCap = parseUsdc(get("daily_cap"));
    if (balance === null) return fail("Invalid balance");
    if (!maxPerMeal) return fail("Max per meal must be greater than zero");
    if (!dailyCap) return fail("Daily cap must be greater than zero");

    const start = get("meal_start");
    const end = get("meal_end");
    let windowStartMin = 0;
    let windowEndMin = 0;
    if (start || end) {
      const s = toMinutes(start);
      const e = toMinutes(end);
      if (s === null || e === null || s >= e) return fail("Meal hours must be HH:MM with start before end");
      windowStartMin = s;
      windowEndMin = e;
    }
    seen.add(wallet.toBase58());
    rows.push({ wallet, balance, maxPerMeal, dailyCap, windowStartMin, windowEndMin });
  });
  return { rows, errors };
}

export function employeesToCsv(employees: EmployeeAccount[]): string {
  const head = [...CSV_COLUMNS, "spent_today", "status"].join(",");
  const body = employees.map((e) => {
    const hasWindow = !(e.windowStartMin === 0 && e.windowEndMin === 0);
    return [
      e.wallet.toBase58(),
      usdcToInput(e.balance),
      usdcToInput(e.maxPerMeal),
      usdcToInput(e.dailyCap),
      hasWindow ? fromMinutes(e.windowStartMin) : "",
      hasWindow ? fromMinutes(e.windowEndMin) : "",
      usdcToInput(e.spentToday),
      e.active ? "active" : "revoked",
    ].join(",");
  });
  return [head, ...body].join("\n") + "\n";
}
