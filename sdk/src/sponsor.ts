// Fee payer (patrocinador): regras que o servidor confere antes de co-assinar um pagamento.
// Fica no SDK (sem dependência do Next) para a rota /api/sponsor e os scripts usarem a mesma checagem.
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

import idl from "./idl/tabbit.json";

const PAY_IX = idl.instructions.find((i) => i.name === "pay")!;
const PAY_DISCRIMINATOR = Buffer.from(PAY_IX.discriminator);
const CREATE_IDEMPOTENT = 1; // instrução do Associated Token Program

// Posição das contas em `pay`, lida da IDL (programs/tabbit/src/instructions/pay.rs)
const payIndex = (name: string) => PAY_IX.accounts.findIndex((a) => a.name === name);
const PAY_PAYER = payIndex("payer");
const PAY_MERCHANT_TOKEN = payIndex("merchant_token");
const PAY_TREASURY_TOKEN = payIndex("treasury_token");
const PAY_ACCOUNTS = PAY_IX.accounts.length;

export class SponsorRejected extends Error {}

/**
 * Confere uma transação de pagamento antes do patrocinador assinar. Aceita só:
 * - `feePayer` = patrocinador;
 * - exatamente um `pay` do programa Tabbit, assinado (de verdade) pelo funcionário;
 * - criação idempotente das contas de token do restaurante e da tesouraria desse mesmo `pay`,
 *   com o patrocinador pagando o aluguel.
 * O patrocinador não pode aparecer em nenhum outro lugar. Devolve a carteira do funcionário.
 */
export function validateSponsoredPay(tx: Transaction, sponsor: PublicKey, programId: PublicKey): PublicKey {
  const reject = (why: string): never => {
    throw new SponsorRejected(why);
  };

  if (!tx.feePayer?.equals(sponsor)) reject("fee payer is not the sponsor");

  const pays = tx.instructions.filter((ix) => ix.programId.equals(programId));
  if (pays.length !== 1) reject("expected exactly one Tabbit instruction");
  const pay = pays[0];
  if (!pay.data.subarray(0, 8).equals(PAY_DISCRIMINATOR)) reject("only `pay` can be sponsored");
  if (pay.keys.length !== PAY_ACCOUNTS) reject("malformed `pay`");
  if (pay.keys.some((k) => k.pubkey.equals(sponsor))) reject("sponsor cannot be a `pay` account");

  const employee = pay.keys[PAY_PAYER].pubkey;
  const allowedAtas = [pay.keys[PAY_MERCHANT_TOKEN].pubkey, pay.keys[PAY_TREASURY_TOKEN].pubkey];

  for (const ix of tx.instructions) {
    if (ix === pay) continue;
    if (!ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) reject(`program not allowed: ${ix.programId.toBase58()}`);
    if (ix.data.length !== 1 || ix.data[0] !== CREATE_IDEMPOTENT) reject("only idempotent token account creation");
    // Contas: [funder, ata, dono, mint, system, token]
    if (ix.keys.length !== 6) reject("malformed token account creation");
    if (!ix.keys[0].pubkey.equals(sponsor)) reject("token account must be funded by the sponsor");
    if (!allowedAtas.some((a) => a.equals(ix.keys[1].pubkey))) reject("token account is not part of the payment");
    if (ix.keys.slice(2).some((k) => k.pubkey.equals(sponsor))) reject("sponsor misused in token account creation");
  }

  // A assinatura do funcionário tem que existir e ser válida para esta mensagem exata
  const employeeSig = tx.signatures.find((s) => s.publicKey.equals(employee));
  if (!employeeSig?.signature) reject("missing employee signature");
  if (!tx.verifySignatures(false)) reject("invalid signature");

  return employee;
}
