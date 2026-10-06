// Extrato mensal. Rodar: npm test -w app
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, type PublicKey } from "@solana/web3.js";
import type { Payment, Refund } from "@tabbit/sdk";
import { buildStatement, monthRange, recentMonths, statementCsv } from "./statement.ts";

const U = 1_000_000n;
const key = () => Keypair.generate().publicKey;
const ana = key();
const bia = key();
const cantina = key();
const T = (iso: string) => Date.parse(iso) / 1000;

const pay = (employee: PublicKey, amount: bigint, at: string, signature: string): Payment => ({
  signature, employer: key(), employee, merchant: cantina, amount, fee: (amount * 80n) / 10_000n, timestamp: T(at),
});
const refund = (employee: PublicKey, amount: bigint, at: string, reference: string): Refund => ({
  signature: "r-" + reference, employer: key(), employee, merchant: cantina, amount, reference, timestamp: T(at),
});

test("month range is Brasília time", () => {
  const { since, until } = monthRange("2026-10");
  assert.equal(since, T("2026-10-01T03:00:00Z")); // 00:00 em Brasília
  assert.equal(until, T("2026-11-01T03:00:00Z"));
  assert.deepEqual(monthRange("2026-12").until, T("2027-01-01T03:00:00Z"));
});

test("recent months go back across the year", () => {
  assert.deepEqual(recentMonths(3, T("2026-01-15T12:00:00Z")), ["2026-01", "2025-12", "2025-11"]);
  // 31/10 às 23h em Brasília ainda é outubro, mesmo já sendo novembro em UTC
  assert.equal(recentMonths(1, T("2026-11-01T02:00:00Z"))[0], "2026-10");
});

test("totals and per-employee summary net out refunds", () => {
  const s = buildStatement(
    [pay(ana, 30n * U, "2026-10-02T15:00:00Z", "p1"), pay(ana, 20n * U, "2026-10-05T15:00:00Z", "p2"), pay(bia, 10n * U, "2026-10-03T15:00:00Z", "p3")],
    [refund(ana, 20n * U, "2026-10-05T16:00:00Z", "p2")]
  );
  assert.deepEqual(s.totals, { payments: 3, spent: 60n * U, refunded: 20n * U, net: 40n * U, restaurantFees: 480_000n });
  assert.equal(s.byEmployee[0].employee, ana.toBase58());
  assert.equal(s.byEmployee[0].net, 30n * U);
  assert.equal(s.byEmployee[0].payments, 2);
  assert.equal(s.rows[0].signature, "p1"); // mais antiga primeiro
  assert.equal(s.rows.at(-1)!.kind, "refund");
});

test("CSV has Brasília dates, negative refunds and restaurant names", () => {
  const s = buildStatement([pay(ana, 12_500_000n, "2026-10-02T15:30:00Z", "p1")], [refund(ana, 2n * U, "2026-10-02T16:00:00Z", "p1")]);
  const lines = statementCsv(s.rows, { [cantina.toBase58()]: "Cantina, da Vila" }).trim().split("\n");
  assert.equal(lines[0], "date_brt,type,employee_wallet,restaurant,amount_usdc,restaurant_fee_usdc,transaction");
  assert.match(lines[1], /^2026-10-02 12:30,payment,/);
  assert.match(lines[1], /"Cantina, da Vila",12\.5,0\.1,p1$/);
  assert.match(lines[2], /,refund,.*,-2,0,r-p1$/);
});
