// Roda UMA vez logo depois do upgrade que trouxe aprovação de empresas e token oficial:
// 1. grava o token oficial na Config (set_mint migra a Config antiga, que não tinha esse campo);
// 2. aprova as empresas que já existiam e usam esse token (antes não havia aprovação).
// Pode rodar de novo sem problema.
//
// Uso:  MINT=<token oficial> npm run migrate:approval
//       (chave da plataforma em ~/.config/solana/id.json ou PLATFORM_KEY=<arquivo>)
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { createTabbitClient, findConfigPda } from "../sdk/src";
import idl from "../sdk/src/idl/tabbit.json";
import type { Tabbit } from "../sdk/src/idl/tabbit";
import type { AnchorWallet } from "../sdk/src";

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const KEY = process.env.PLATFORM_KEY ?? join(homedir(), ".config/solana/id.json");
if (!process.env.MINT) throw new Error("Informe o token oficial: MINT=<endereço>");
const MINT = new PublicKey(process.env.MINT);

function walletOf(kp: Keypair): AnchorWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return { publicKey: kp.publicKey, signTransaction: async (tx) => sign(tx), signAllTransactions: async (txs) => txs.map(sign) };
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const platform = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(KEY, "utf8"))));
  const program = new Program<Tabbit>(idl as Tabbit, new AnchorProvider(connection, walletOf(platform), { commitment: "confirmed" }));
  const client = createTabbitClient({ connection, wallet: walletOf(platform) });

  const before = (await connection.getAccountInfo(findConfigPda(program.programId)))!.data.length;
  await program.methods.setMint().accountsPartial({ authority: platform.publicKey, mint: MINT }).rpc();
  const config = await client.getConfig();
  console.log(`✓ Config: ${before} → ${(await connection.getAccountInfo(findConfigPda(program.programId)))!.data.length} bytes, mint ${config.mint.toBase58()}`);

  for (const e of await client.listEmployers()) {
    if (e.approved) console.log(`  já aprovada: ${e.name}`);
    else if (!e.mint.equals(MINT)) console.log(`  ignorada (token não oficial): ${e.name}`);
    else {
      await client.setEmployerApproved(e.owner, true);
      console.log(`✓ aprovada: ${e.name}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
