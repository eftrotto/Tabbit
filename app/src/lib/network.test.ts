// Números da transparência. Rodar: npm test -w app
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, type PublicKey } from "@solana/web3.js";
import type { EmployerAccount, MerchantAccount, Payment } from "@tabbit/sdk";
import { addPayment, computeStats, marketFee, statsFromJson, statsToJson } from "./network.ts";

const U = 1_000_000n;
const key = () => Keypair.generate().publicKey;
// 2026-10-02 12:00 em Brasília
const NOW = Date.UTC(2026, 9, 2, 15, 0) / 1000;
const cantina = key();
const cafe = key();

const pay = (merchant: PublicKey, amount: bigint, secondsAgo: number, sig = Math.random().toString(36)): Payment => ({
  signature: sig, employer: key(), employee: key(), merchant, amount, fee: (amount * 80n) / 10_000n, timestamp: NOW - secondsAgo,
});
const merchant = (wallet: PublicKey, name: string, active = true): MerchantAccount => ({ address: key(), wallet, name, category: "restaurant", active });
const employer = (approved: boolean, allocated: bigint): EmployerAccount => ({
  address: key(), owner: key(), name: "x", mint: key(), vault: key(), tzOffsetMinutes: -180, totalDeposited: allocated * 2n, totalAllocated: allocated, approved,
});

const base = () =>
  computeStats({
    payments: [pay(cantina, 25n * U, 60), pay(cafe, 10n * U, 3600), pay(cantina, 40n * U, 3 * 86_400), pay(cantina, 5n * U, 30 * 86_400)],
    employers: [employer(true, 100n * U), employer(false, 0n)],
    merchants: [merchant(cantina, "Cantina da Vila"), merchant(cafe, "Café Aurora"), merchant(key(), "Fechado", false)],
    vaultBalances: [200n * U, 0n],
    complete: true,
    now: NOW,
  });

test("totals, restaurants, companies and reserves", () => {
  const s = base();
  assert.equal(s.totals.volume, 80n * U);
  assert.equal(s.totals.count, 4);
  assert.equal(s.totals.fees, 640_000n); // 0,8%
  assert.equal(marketFee(s.totals.volume), 2_880_000n); // 3,6%
  assert.deepEqual([s.restaurants.active, s.restaurants.registered], [2, 3]);
  assert.equal(s.companies.approved, 1);
  assert.deepEqual(s.reserves, { inVaults: 200n * U, allocated: 100n * U });
  assert.equal(s.recent[0].amount, 25n * U); // mais novo primeiro
  assert.equal(s.restaurants.names[cantina.toBase58()], "Cantina da Vila");
});

test("daily volume covers 14 days in Brasília time and drops older payments", () => {
  const s = base();
  assert.equal(s.daily.length, 14);
  assert.equal(s.daily.at(-1)!.day, "2026-10-02");
  assert.equal(s.daily.at(-1)!.volume, 35n * U); // 25 + 10 hoje
  assert.equal(s.daily.find((d) => d.day === "2026-09-29")!.volume, 40n * U);
  assert.equal(s.daily.reduce((t, d) => t + d.volume, 0n), 75n * U); // o de 30 dias atrás fica fora do gráfico
});

test("does not expose employees or companies", () => {
  const json = statsToJson(base());
  assert.doesNotMatch(json, /employee|employer/);
});

test("live payment updates totals once", () => {
  const s = base();
  const p = pay(cafe, 12n * U, 0, "live-1");
  const once = addPayment(s, p);
  const twice = addPayment(once, p);
  assert.equal(twice.totals.count, 5);
  assert.equal(twice.totals.volume, 92n * U);
  assert.equal(twice.daily.at(-1)!.volume, 47n * U);
  assert.equal(twice.recent[0].signature, "live-1");
});

test("bigints survive the JSON round trip", () => {
  const back = statsFromJson(statsToJson(base()));
  assert.equal(back.totals.volume, 80n * U);
  assert.equal(back.daily.at(-1)!.volume, 35n * U);
});
