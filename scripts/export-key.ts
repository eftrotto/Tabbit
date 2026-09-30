// Mostra a chave privada em base58 (formato que o Phantom aceita). Só para chaves de DEMO da devnet.
// Uso: npm run key:export -- keys/employee-joao.json
import { utils } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Uso: npm run key:export -- keys/<arquivo>.json");
  process.exit(1);
}
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
console.log(`Endereço: ${kp.publicKey.toBase58()}`);
console.log(`Chave privada (base58): ${utils.bytes.bs58.encode(kp.secretKey)}`);
