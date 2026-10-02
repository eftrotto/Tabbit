// Popula a rede com dados de demo: Config, 1 empresa, 3 restaurantes e 2 funcionários.
// Uso:  npm run seed            (devnet)
//       RPC_URL=http://127.0.0.1:8899 npm run seed   (validador local)
//
// Moeda (env MINT):
//   mock (padrão)  cria um token de teste de 6 casas que a plataforma pode emitir à vontade
//   usdc           usa o USDC de teste da Circle; a carteira da empresa precisa ter USDC (https://faucet.circle.com)
//
// As chaves de demo ficam em keys/ (fora do git). Rodar de novo reaproveita tudo que já existe.
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { createTabbitClient, findConfigPda, USDC_DEVNET_MINT } from "../sdk/src";
import idl from "../sdk/src/idl/tabbit.json";
import type { Tabbit } from "../sdk/src/idl/tabbit";
import type { AnchorWallet, Category } from "../sdk/src";

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const MINT_MODE = (process.env.MINT ?? "mock").toLowerCase();
const KEYS_DIR = "keys";
const U = (n: number) => BigInt(Math.round(n * 1_000_000));

const MERCHANTS: { key: string; name: string; category: Category }[] = [
  { key: "merchant-cantina", name: "Cantina da Vila", category: "restaurant" },
  { key: "merchant-bistro", name: "Bistro 22", category: "restaurant" },
  { key: "merchant-cafe", name: "Cafe Paulista", category: "cafe" },
];

const EMPLOYEES = [
  { key: "employee-joao", balance: 250, maxPerMeal: 40, dailyCap: 60 },
  { key: "employee-maria", balance: 250, maxPerMeal: 40, dailyCap: 60 },
];

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function demoKey(name: string): Keypair {
  mkdirSync(KEYS_DIR, { recursive: true });
  const path = join(KEYS_DIR, `${name}.json`);
  if (existsSync(path)) return loadKeypair(path);
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function walletOf(kp: Keypair): AnchorWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}

/** Garante SOL para taxas de rede: transfere da plataforma (airdrop da devnet costuma falhar por limite). */
async function fund(connection: Connection, from: Keypair, to: PublicKey, sol: number) {
  const balance = await connection.getBalance(to);
  if (balance >= sol * LAMPORTS_PER_SOL * 0.5) return;
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })
  );
  await sendAndConfirmTransaction(connection, tx, [from], { commitment: "confirmed" });
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const platform = loadKeypair(process.env.WALLET ?? join(homedir(), ".config/solana/id.json"));
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Plataforma: ${platform.publicKey.toBase58()} (${(await connection.getBalance(platform.publicKey)) / LAMPORTS_PER_SOL} SOL)`);

  const employerKp = demoKey("employer");
  const employeeKps = EMPLOYEES.map((e) => demoKey(e.key));
  const merchantKps = MERCHANTS.map((m) => demoKey(m.key));

  for (const kp of [employerKp, ...employeeKps]) await fund(connection, platform, kp.publicKey, 0.2);

  const asPlatform = createTabbitClient({ connection, wallet: walletOf(platform) });
  const asEmployer = createTabbitClient({ connection, wallet: walletOf(employerKp) });

  // 1. Moeda (vem antes da Config: ela guarda o token oficial)
  let mint: PublicKey;
  if (MINT_MODE === "usdc") {
    mint = USDC_DEVNET_MINT;
    console.log(`• Usando USDC da Circle (${mint.toBase58()}). A empresa precisa ter saldo: ${employerKp.publicKey.toBase58()}`);
  } else {
    const mintKp = demoKey("mint");
    mint = mintKp.publicKey;
    if (!(await connection.getAccountInfo(mint))) {
      await createMint(connection, platform, platform.publicKey, null, 6, mintKp);
      const employerAta = await getOrCreateAssociatedTokenAccount(connection, platform, mint, employerKp.publicKey);
      await mintTo(connection, platform, mint, employerAta.address, platform, U(1000));
      console.log(`✓ Token de teste criado (${mint.toBase58()}) e 1.000 emitidos para a empresa`);
    }
  }

  // 2. Config (taxa 0,8%, tesouraria = carteira da plataforma, token oficial)
  if (!(await connection.getAccountInfo(findConfigPda()))) {
    const program = new Program<Tabbit>(idl as Tabbit, new AnchorProvider(connection, walletOf(platform), {}));
    await program.methods.initialize(80, platform.publicKey).accountsPartial({ authority: platform.publicKey, mint }).rpc();
    console.log("✓ Config criada (taxa 0,8%)");
  } else {
    console.log("• Config já existe");
  }

  // 3. Empresa (aprovada pela plataforma) + depósito
  let employer = await asEmployer.getEmployer(employerKp.publicKey);
  if (!employer) {
    await asEmployer.registerEmployer({ name: "Acme Ltda", tzOffsetMinutes: -180 });
    console.log("✓ Empresa Acme Ltda registrada");
    employer = await asEmployer.getEmployer(employerKp.publicKey);
  }
  if (!employer!.approved) {
    await asPlatform.setEmployerApproved(employerKp.publicKey, true);
    console.log("✓ Empresa aprovada pela plataforma");
  }
  const needed = U(EMPLOYEES.reduce((s, e) => s + e.balance, 0));
  if (employer!.totalDeposited < needed) {
    await asEmployer.deposit(needed - employer!.totalDeposited + U(100));
    console.log("✓ Depósito feito no cofre");
  }

  // 4. Restaurantes
  for (let i = 0; i < MERCHANTS.length; i++) {
    const m = MERCHANTS[i];
    if (!(await asPlatform.getMerchant(merchantKps[i].publicKey))) {
      await asPlatform.registerMerchant({ wallet: merchantKps[i].publicKey, name: m.name, category: m.category });
      console.log(`✓ Restaurante ${m.name}`);
    }
  }

  // 5. Funcionários
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    await asEmployer.upsertEmployee({
      wallet: employeeKps[i].publicKey,
      balance: U(e.balance),
      maxPerMeal: U(e.maxPerMeal),
      dailyCap: U(e.dailyCap),
    });
    console.log(`✓ Funcionário ${e.key}`);
  }

  console.log("\nResumo da demo (chaves em keys/, fora do git):");
  console.log(`  MINT            ${mint.toBase58()}`);
  console.log(`  employer        ${employerKp.publicKey.toBase58()}`);
  EMPLOYEES.forEach((e, i) => console.log(`  ${e.key.padEnd(15)} ${employeeKps[i].publicKey.toBase58()}`));
  MERCHANTS.forEach((m, i) => console.log(`  ${m.key.padEnd(15)} ${merchantKps[i].publicKey.toBase58()}`));
  console.log("\nPara usar no Phantom: npm run key:export -- keys/employee-joao.json e importe a chave (Add account > Import private key).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
