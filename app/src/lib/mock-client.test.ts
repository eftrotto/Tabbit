// Regras de negócio do mock (espelham a seção 4.3). Rodar: npm test -w app
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { createMockClient, DEMO, resetMockStore } from "./mock-client.ts";
import { parseUsdc, usdcToInput } from "./currency.ts";

const U = 1_000_000n;
// 2026-10-01 12:00 em Brasília (UTC-3) = 15:00 UTC
const NOON_BRT = Date.UTC(2026, 9, 1, 15, 0) / 1000;
const code = (c: string) => (e: unknown) => (e as { code?: string }).code === c;

test("happy path: pay charges 0.8% fee and notifies listeners", async () => {
  resetMockStore();
  const joao = createMockClient(DEMO.employee, { now: () => NOON_BRT });
  const seen: bigint[] = [];
  const off = joao.onPayment((p) => seen.push(p.amount));
  await joao.pay({ merchant: DEMO.merchant, amount: 25n * U });
  off();
  const [p] = await joao.listPayments({ merchant: DEMO.merchant });
  assert.equal(p.fee, 200_000n); // 25 * 0.008
  assert.deepEqual(seen, [25n * U]);
  const me = (await joao.getEmployeeByWallet(DEMO.employee))!;
  assert.equal(me.balance, 175n * U);
  assert.equal(me.spentToday, 25n * U);
  const emp = (await joao.getEmployer(DEMO.employer))!;
  assert.equal(emp.totalAllocated, 325n * U);
  assert.equal(emp.totalDeposited, 975n * U);
});

test("pay enforces per-meal, daily cap, reset next day, window, inactive", async () => {
  resetMockStore();
  let t = NOON_BRT;
  const joao = createMockClient(DEMO.employee, { now: () => t });
  await assert.rejects(joao.pay({ merchant: DEMO.merchant, amount: 41n * U }), code("ExceedsMaxPerMeal"));
  await assert.rejects(joao.pay({ merchant: DEMO.merchant, amount: 0n }), code("InvalidAmount"));
  await joao.pay({ merchant: DEMO.merchant, amount: 40n * U });
  await assert.rejects(joao.pay({ merchant: DEMO.merchant, amount: 21n * U }), code("ExceedsDailyCap"));
  t += 86400; // dia seguinte: teto reseta
  assert.equal((await joao.getEmployeeByWallet(DEMO.employee))!.spentToday, 0n);
  await joao.pay({ merchant: DEMO.merchant, amount: 21n * U });

  // Maria só pode 11:00–15:00 em Brasília
  const maria = (at: number) => createMockClient(DEMO.employee2, { now: () => at });
  await maria(NOON_BRT).pay({ merchant: DEMO.merchant, amount: 10n * U });
  await assert.rejects(maria(NOON_BRT + 4 * 3600).pay({ merchant: DEMO.merchant, amount: 10n * U }), code("OutsideTimeWindow"));

  const platform = createMockClient(DEMO.platform);
  await platform.setMerchantActive(DEMO.merchant, false);
  await assert.rejects(joao.pay({ merchant: DEMO.merchant, amount: 1n * U }), code("MerchantInactive"));
  await assert.rejects(joao.pay({ merchant: Keypair.generate().publicKey, amount: 1n * U }), code("MerchantInactive"));
  await assert.rejects(createMockClient(DEMO.employee).setMerchantActive(DEMO.merchant, true), code("Unauthorized"));

  const acme = createMockClient(DEMO.employer);
  await acme.revokeEmployee(DEMO.employee);
  await assert.rejects(joao.pay({ merchant: DEMO.merchant2, amount: 1n * U }), code("EmployeeInactive"));
});

test("employer: over-allocation, withdraw limit, window validation, register", async () => {
  resetMockStore();
  const acme = createMockClient(DEMO.employer);
  const w = Keypair.generate().publicKey;
  // depositado 1000, alocado 350 → sobram 650
  await assert.rejects(acme.upsertEmployee({ wallet: w, balance: 651n * U, maxPerMeal: U, dailyCap: U }), code("OverAllocated"));
  await acme.upsertEmployee({ wallet: w, balance: 650n * U, maxPerMeal: U, dailyCap: U });
  await acme.upsertEmployee({ wallet: w, balance: 100n * U, maxPerMeal: U, dailyCap: U }); // edita: devolve 550
  assert.equal((await acme.getEmployer(DEMO.employer))!.totalAllocated, 450n * U);
  await assert.rejects(acme.withdrawUnallocated(551n * U), code("OverAllocated"));
  await acme.withdrawUnallocated(550n * U);
  await assert.rejects(
    acme.upsertEmployee({ wallet: w, balance: 0n, maxPerMeal: U, dailyCap: U, windowStartMin: 900, windowEndMin: 600 }),
    code("InvalidWindow")
  );

  const newCo = createMockClient(Keypair.generate().publicKey);
  await assert.rejects(newCo.deposit(U), code("Unauthorized"));
  await assert.rejects(newCo.registerEmployer({ name: "x".repeat(33), tzOffsetMinutes: 0 }), code("NameTooLong"));
  await newCo.registerEmployer({ name: "NewCo", tzOffsetMinutes: 0 });
  await createMockClient(DEMO.platform).setEmployerApproved((await newCo.listEmployers()).at(-1)!.owner, true);
  await newCo.deposit(5n * U);
  await assert.rejects(createMockClient(null).deposit(U), code("Unauthorized"));
});

test("currency parsing round-trips", () => {
  assert.equal(parseUsdc("12.5"), 12_500_000n);
  assert.equal(parseUsdc("12,50"), 12_500_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
  assert.equal(parseUsdc("1.0000001"), null);
  assert.equal(parseUsdc("-1"), null);
  assert.equal(parseUsdc("abc"), null);
  assert.equal(usdcToInput(12_500_000n), "12.5");
  assert.equal(usdcToInput(40n * U), "40");
});

test("company starts pending: cannot deposit until the platform approves", async () => {
  resetMockStore();
  const boss = Keypair.generate().publicKey;
  const asBoss = createMockClient(boss);
  await asBoss.registerEmployer({ name: "Newco", tzOffsetMinutes: -180 });
  assert.equal((await asBoss.getEmployer(boss))!.approved, false);
  await assert.rejects(asBoss.deposit(10n * U), code("EmployerNotApproved"));
  await assert.rejects(asBoss.setEmployerApproved(boss, true), code("Unauthorized"));
  await createMockClient(DEMO.platform).setEmployerApproved(boss, true);
  await asBoss.deposit(10n * U);
  assert.equal((await asBoss.getEmployer(boss))!.totalDeposited, 10n * U);
});

test("company with its own token is rejected", async () => {
  resetMockStore();
  const asBoss = createMockClient(Keypair.generate().publicKey);
  await assert.rejects(
    asBoss.registerEmployer({ name: "Scam", mint: Keypair.generate().publicKey, tzOffsetMinutes: 0 }),
    code("InvalidMint")
  );
});

test("suspended company cannot pay", async () => {
  resetMockStore();
  await createMockClient(DEMO.platform).setEmployerApproved(DEMO.employer, false);
  const joao = createMockClient(DEMO.employee, { now: () => NOON_BRT });
  await assert.rejects(joao.pay({ merchant: DEMO.merchant, amount: 1n * U }), code("EmployerNotApproved"));
});

test("batch upsert is all-or-nothing", async () => {
  resetMockStore();
  const acme = createMockClient(DEMO.employer);
  const a = Keypair.generate().publicKey;
  const b = Keypair.generate().publicKey;
  // 650 livres: a cabe, a + b não
  await assert.rejects(
    acme.upsertEmployees([
      { wallet: a, balance: 400n * U, maxPerMeal: U, dailyCap: U },
      { wallet: b, balance: 400n * U, maxPerMeal: U, dailyCap: U },
    ]),
    code("OverAllocated")
  );
  assert.equal((await acme.listEmployees(DEMO.employer)).length, 2);
  const sigs = await acme.upsertEmployees([
    { wallet: a, balance: 100n * U, maxPerMeal: U, dailyCap: U },
    { wallet: b, balance: 100n * U, maxPerMeal: U, dailyCap: U },
  ]);
  assert.equal(sigs.length, 1);
  assert.equal((await acme.listEmployees(DEMO.employer)).length, 4);
});

test("wallet without SOL gets a clear message", async () => {
  const { friendlyError } = await import("./errors.ts");
  assert.match(friendlyError(new Error('Transaction simulation failed: "AccountNotFound"')), /no SOL/);
  assert.match(friendlyError(new Error("Attempt to debit an account but found no record of a prior credit.")), /faucet/);
});
