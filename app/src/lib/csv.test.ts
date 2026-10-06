// Planilha de funcionários. Rodar: npm test -w app
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { employeesToCsv, parseEmployeesCsv } from "./csv.ts";

const U = 1_000_000n;
const a = Keypair.generate().publicKey.toBase58();
const b = Keypair.generate().publicKey.toBase58();

test("parses comma CSV with optional meal hours", () => {
  const { rows, errors } = parseEmployeesCsv(
    `wallet,balance,max_per_meal,daily_cap,meal_start,meal_end\n${a},200,40,60,11:00,15:00\n${b},150.5,35,50,,\n`
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].balance, 200n * U);
  assert.equal(rows[0].windowStartMin, 660);
  assert.equal(rows[0].windowEndMin, 900);
  assert.equal(rows[1].balance, 150_500_000n);
  assert.equal(rows[1].windowStartMin, 0);
});

test("parses Excel (pt-BR) CSV: semicolon and decimal comma, any column order", () => {
  const { rows, errors } = parseEmployeesCsv(`﻿daily_cap;wallet;max_per_meal;balance\r\n60;${a};40;200,50\r\n`);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].balance, 200_500_000n);
  assert.equal(rows[0].dailyCap, 60n * U);
});

test("reports bad lines without dropping the good ones", () => {
  const { rows, errors } = parseEmployeesCsv(
    `wallet,balance,max_per_meal,daily_cap,meal_start,meal_end\nnot-a-wallet,1,1,1,,\n${a},1,0,1,,\n${b},1,1,1,15:00,11:00\n${a},1,1,1,,\n${b.slice(0, 10)},1,1,1,,\n`
  );
  // a linha 5 repete a carteira da linha 3, que falhou: entra
  assert.equal(rows.length, 1);
  assert.deepEqual(errors.map((e) => e.line), [2, 3, 4, 6]);
  const ok = parseEmployeesCsv(`wallet,balance,max_per_meal,daily_cap\n${a},1,1,1\n${a},2,2,2\n`);
  assert.equal(ok.rows.length, 1);
  assert.match(ok.errors[0].message, /twice/);
});

test("missing columns is a single clear error", () => {
  const { rows, errors } = parseEmployeesCsv(`wallet,balance\n${a},1\n`);
  assert.equal(rows.length, 0);
  assert.match(errors[0].message, /max_per_meal, daily_cap/);
});

test("export round-trips through import", () => {
  const { rows } = parseEmployeesCsv(`wallet,balance,max_per_meal,daily_cap,meal_start,meal_end\n${a},200,40,60,11:00,15:00\n`);
  const csv = employeesToCsv([
    { ...rows[0], windowStartMin: 660, windowEndMin: 900, address: rows[0].wallet, employer: rows[0].wallet, spentToday: 0n, active: true },
  ]);
  const back = parseEmployeesCsv(csv);
  assert.deepEqual(back.errors, []);
  assert.equal(back.rows[0].balance, 200n * U);
  assert.equal(back.rows[0].windowEndMin, 900);
});

test("optional people columns go to the directory, with quoted names", () => {
  const { rows, people, errors } = parseEmployeesCsv(
    `wallet,name,email,employee_id,balance,max_per_meal,daily_cap\n${a},"Souza, Maria",Maria@Acme.com,ACM-1,200,40,60\n${b},,,,100,20,30\n`
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.deepEqual(people[0], { wallet: a, name: "Souza, Maria", email: "Maria@Acme.com", employeeId: "ACM-1" });
  // célula vazia = manter o que já existe
  assert.deepEqual(people[1], { wallet: b, name: undefined, email: undefined, employeeId: undefined });
});

test("invalid email fails the line; no people columns means no directory updates", () => {
  const bad = parseEmployeesCsv(`wallet,email,balance,max_per_meal,daily_cap\n${a},not-an-email,1,1,1\n`);
  assert.equal(bad.rows.length, 0);
  assert.match(bad.errors[0].message, /Invalid email/);
  assert.deepEqual(parseEmployeesCsv(`wallet,balance,max_per_meal,daily_cap\n${a},1,1,1\n`).people, []);
});

test("export with names round-trips names, emails and quotes", () => {
  const { rows } = parseEmployeesCsv(`wallet,balance,max_per_meal,daily_cap\n${a},200,40,60\n`);
  const names = new Map([[a, { wallet: a, name: "Souza, Maria", email: "maria@acme.com", employeeId: "ACM-1" }]]);
  const csv = employeesToCsv([{ ...rows[0], windowStartMin: 0, windowEndMin: 0, address: rows[0].wallet, employer: rows[0].wallet, spentToday: 0n, active: true }], names);
  assert.match(csv.split("\n")[0], /^wallet,name,email,employee_id,balance/);
  const back = parseEmployeesCsv(csv);
  assert.deepEqual(back.errors, []);
  assert.equal(back.people[0].name, "Souza, Maria");
  assert.equal(back.rows[0].balance, 200n * U);
});
