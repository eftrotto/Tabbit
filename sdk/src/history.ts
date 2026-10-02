// Histórico de pagamentos da rede inteira (página de transparência). Lê os eventos PaymentMade
// e guarda o que já leu: transação confirmada não muda. Pensado para rodar no servidor, que busca
// uma vez para todos os visitantes.
//
// Todo `pay` passa pela conta Merchant do restaurante, então varrer as contas dos restaurantes
// (em vez do programa inteiro, cheio de cadastros e depósitos) lê quase só pagamentos. A RPC
// pública da devnet limita bastante o getTransaction, por isso a leitura vai devagar.
import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";

import { PROGRAM_ID } from "./constants";
import idl from "./idl/tabbit.json";
import type { Payment } from "./types";

const PAGE = 1000; // máximo do getSignaturesForAddress
const PARALLEL = 2; // getTransaction em paralelo (a RPC pública recusa o lote getTransactions)
const GAP_MS = 150;

const parsedBySig = new Map<string, Payment[]>();

async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries - 1 || !/429|too many requests/i.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

export interface PaymentScan {
  payments: Payment[]; // mais novos primeiro
  /** Transações lidas (de pagamento ou não). */
  scanned: number;
  /** true se chegou ao início do histórico; false se parou no limite. */
  complete: boolean;
}

export async function scanPayments(
  connection: Connection,
  opts: {
    /** Contas a varrer. Padrão: o programa inteiro. A página passa as contas Merchant. */
    addresses?: PublicKey[];
    /** Limite de transações por conta. */
    maxSignatures?: number;
    programId?: PublicKey;
  } = {}
): Promise<PaymentScan> {
  const programId = opts.programId ?? PROGRAM_ID;
  const max = opts.maxSignatures ?? 2000;
  const parser = new EventParser(programId, new BorshCoder(idl as Idl));

  const seen = new Set<string>();
  const sigs: string[] = [];
  let scanned = 0;
  let complete = true;
  for (const address of opts.addresses ?? [programId]) {
    let before: string | undefined;
    let read = 0;
    for (;;) {
      const want = Math.min(PAGE, max - read);
      if (want <= 0) {
        complete = false;
        break;
      }
      const page = await withRetry(() => connection.getSignaturesForAddress(address, { limit: want, before }, "confirmed"));
      read += page.length;
      scanned += page.length;
      for (const s of page) if (!s.err && !seen.has(s.signature)) seen.add(s.signature), sigs.push(s.signature);
      if (page.length < want) break;
      before = page[page.length - 1].signature;
    }
  }

  const missing = sigs.filter((s) => !parsedBySig.has(s));
  for (let i = 0; i < missing.length; i += PARALLEL) {
    await Promise.all(
      missing.slice(i, i + PARALLEL).map(async (signature) => {
        const tx = await withRetry(() =>
          connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })
        );
        if (!tx) return; // ainda não indexada: tenta na próxima varredura
        const out: Payment[] = [];
        for (const ev of parser.parseLogs(tx.meta?.logMessages ?? [])) {
          if (ev.name.toLowerCase() !== "paymentmade") continue; // "PaymentMade" pela IDL crua, "paymentMade" pelo Program
          const d = ev.data as any;
          out.push({
            signature,
            employer: d.employer,
            employee: d.employee,
            merchant: d.merchant,
            amount: BigInt(d.amount.toString()),
            fee: BigInt(d.fee.toString()),
            timestamp: d.timestamp.toNumber(),
          });
        }
        parsedBySig.set(signature, out);
      })
    );
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  const payments = sigs.flatMap((s) => parsedBySig.get(s) ?? []).sort((a, b) => b.timestamp - a.timestamp);
  return { payments, scanned, complete };
}
