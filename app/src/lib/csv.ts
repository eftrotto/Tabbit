// Planilha de funcionários (importar e exportar). Aceita "," ou ";" como separador; com ";"
// (Excel em português) os valores podem usar vírgula decimal. Valores em USDC, horários em HH:MM.
import { PublicKey } from "@solana/web3.js";
import type { EmployeeAccount, UpsertEmployeeInput } from "@tabbit/sdk";
import { parseUsdc, usdcToInput } from "./currency.ts";
import type { DirectoryEntry, DirectoryUpdate } from "./directory.ts";

export const CSV_COLUMNS = ["wallet", "balance", "max_per_meal", "daily_cap", "meal_start", "meal_end"] as const;
/** Opcionais: vão para o diretório (fora da blockchain), não para o programa. */
export const PEOPLE_COLUMNS = ["name", "email", "employee_id"] as const;
export const CSV_TEMPLATE = "wallet,name,email,employee_id,balance,max_per_meal,daily_cap,meal_start,meal_end\nPASTE_WALLET_ADDRESS,Maria Souza,maria@company.com,ACM-001,200,40,60,11:00,15:00\n";

export interface CsvResult {
  rows: UpsertEmployeeInput[];
  /** Nome/e-mail/matrícula das linhas válidas que trazem essas colunas (célula vazia = manter). */
  people: DirectoryUpdate[];
  errors: { line: number; message: string }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Divide uma linha respeitando campos entre aspas ("Silva, Maria" ou "" dentro de aspas). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const quote = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

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
  if (headerAt < 0) return { rows: [], people: [], errors: [{ line: 1, message: "The file is empty" }] };
  const sep = lines[headerAt].includes(";") ? ";" : ",";
  const header = splitLine(lines[headerAt], sep).map((h) => h.toLowerCase());
  const col = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof CSV_COLUMNS)[number], number>;
  const missing = (["wallet", "balance", "max_per_meal", "daily_cap"] as const).filter((c) => col[c] < 0);
  if (missing.length) return { rows: [], people: [], errors: [{ line: headerAt + 1, message: `Missing columns: ${missing.join(", ")}` }] };
  const peopleCol = Object.fromEntries(PEOPLE_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof PEOPLE_COLUMNS)[number], number>;
  const hasPeople = PEOPLE_COLUMNS.some((c) => peopleCol[c] >= 0);
  const people: DirectoryUpdate[] = [];

  const rows: UpsertEmployeeInput[] = [];
  const errors: CsvResult["errors"] = [];
  const seen = new Set<string>();
  lines.forEach((raw, i) => {
    if (i <= headerAt || raw.length === 0) return;
    const line = i + 1;
    const cells = splitLine(raw, sep);
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
    const person = (c: (typeof PEOPLE_COLUMNS)[number]) => (peopleCol[c] >= 0 ? cells[peopleCol[c]] || undefined : undefined);
    const email = person("email");
    if (email && !EMAIL.test(email)) return fail(`Invalid email "${email}"`);
    seen.add(wallet.toBase58());
    rows.push({ wallet, balance, maxPerMeal, dailyCap, windowStartMin, windowEndMin });
    if (hasPeople) people.push({ wallet: wallet.toBase58(), name: person("name"), email, employeeId: person("employee_id") });
  });
  return { rows, people, errors };
}

/** Com `names` (diretório liberado), inclui nome, e-mail e matrícula. A planilha volta pela importação. */
export function employeesToCsv(employees: EmployeeAccount[], names?: Map<string, DirectoryEntry>): string {
  const head = ["wallet", ...(names ? PEOPLE_COLUMNS : []), ...CSV_COLUMNS.slice(1), "spent_today", "status"].join(",");
  const body = employees.map((e) => {
    const hasWindow = !(e.windowStartMin === 0 && e.windowEndMin === 0);
    const who = names?.get(e.wallet.toBase58());
    return [
      e.wallet.toBase58(),
      ...(names ? [who?.name ?? "", who?.email ?? "", who?.employeeId ?? ""] : []),
      usdcToInput(e.balance),
      usdcToInput(e.maxPerMeal),
      usdcToInput(e.dailyCap),
      hasWindow ? fromMinutes(e.windowStartMin) : "",
      hasWindow ? fromMinutes(e.windowEndMin) : "",
      usdcToInput(e.spentToday),
      e.active ? "active" : "revoked",
    ]
      .map(quote)
      .join(",");
  });
  return [head, ...body].join("\n") + "\n";
}
