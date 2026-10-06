// Assinatura de acesso ao diretório. Rodar: npm test -w app
import { test } from "node:test";
import assert from "node:assert/strict";
import { ed25519 } from "@noble/curves/ed25519";
import { Keypair } from "@solana/web3.js";
import { authMessage, encodeAuth, verifyAuth } from "./directory-auth.ts";

const NOW = 1_791_300_000;
const signAs = (kp: Keypair, wallet: string, issuedAt: number) =>
  encodeAuth(wallet, issuedAt, ed25519.sign(new TextEncoder().encode(authMessage(wallet, issuedAt)), kp.secretKey.slice(0, 32)));

test("accepts a fresh signature from the wallet itself", () => {
  const kp = Keypair.generate();
  const r = verifyAuth(signAs(kp, kp.publicKey.toBase58(), NOW - 60), NOW);
  assert.ok("wallet" in r && r.wallet.equals(kp.publicKey));
});

test("rejects someone signing for another wallet", () => {
  const owner = Keypair.generate();
  const attacker = Keypair.generate();
  const r = verifyAuth(signAs(attacker, owner.publicKey.toBase58(), NOW), NOW);
  assert.deepEqual(r, { error: "Invalid signature" });
});

test("rejects expired, future-dated, tampered and missing sign-ins", () => {
  const kp = Keypair.generate();
  const w = kp.publicKey.toBase58();
  assert.match((verifyAuth(signAs(kp, w, NOW - 13 * 3600), NOW) as { error: string }).error, /expired/);
  assert.deepEqual(verifyAuth(signAs(kp, w, NOW + 3600), NOW), { error: "Invalid sign-in" });
  // assinatura de um horário reaproveitada com outro horário
  const real = JSON.parse(atob(signAs(kp, w, NOW - 60)));
  const tampered = btoa(JSON.stringify({ ...real, issuedAt: NOW }));
  assert.deepEqual(verifyAuth(tampered, NOW), { error: "Invalid signature" });
  assert.match((verifyAuth(null, NOW) as { error: string }).error, /Sign in/);
  assert.deepEqual(verifyAuth("lixo", NOW), { error: "Invalid sign-in" });
});
