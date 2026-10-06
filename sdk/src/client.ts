// Cliente real do Tabbit: implementa a interface TabbitClient (types.ts) falando com o programa on-chain.
import { AnchorError, AnchorProvider, BN, EventParser, Program, utils } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import type { Connection, TransactionInstruction, TransactionSignature } from "@solana/web3.js";

import { CATEGORY_CODES } from "./constants";
import idl from "./idl/tabbit.json";
import type { Tabbit } from "./idl/tabbit";
import { findApprovalPda, findConfigPda, findEmployeePda, findEmployerPda, findMerchantPda } from "./pda";
import {
  TabbitError,
  type Category,
  type ConfigAccount,
  type EmployeeAccount,
  type EmployerAccount,
  type MerchantAccount,
  type Payment,
  type Refund,
  type TabbitClient,
  type TabbitErrorCode,
  type UpsertEmployeeInput,
} from "./types";
import type { AnchorWallet } from "./wallet";

/** Patrocinador (fee payer): paga taxa e aluguel em `pay`, para o funcionário não precisar de SOL. */
export interface TabbitSponsor {
  publicKey: PublicKey;
  /** Recebe a transação já assinada pelo funcionário, co-assina, envia e devolve a assinatura. */
  signAndSend(tx: Transaction): Promise<TransactionSignature>;
}

export interface CreateTabbitClientOptions {
  connection: Connection;
  wallet?: AnchorWallet; // sem carteira = só leitura
  /** Quando definido, o patrocinador paga taxa e aluguel em `pay`. */
  sponsor?: TabbitSponsor;
}

const ERROR_CODES: TabbitErrorCode[] = [
  "Paused",
  "Unauthorized",
  "EmployeeInactive",
  "MerchantInactive",
  "ExceedsMaxPerMeal",
  "ExceedsDailyCap",
  "InsufficientBalance",
  "OutsideTimeWindow",
  "OverAllocated",
  "InvalidAmount",
  "NameTooLong",
  "InvalidWindow",
  "EmployerNotApproved",
  "InvalidMint",
];

const CATEGORY_BY_CODE: Category[] = ["restaurant", "cafe", "grocery", "other"];

// Offsets (8 bytes de discriminator + campos) usados nos filtros de getProgramAccounts
const EMPLOYEE_EMPLOYER_OFFSET = 8;
const EMPLOYEE_WALLET_OFFSET = 8 + 32;

const UPSERTS_PER_TX = 8;

// A RPC pública da devnet limita bem forte o getProgramAccounts (varredura de contas). Cada tela
// chamava várias vezes coisas que quase nunca mudam; este cache é compartilhado entre os clientes
// (o app recria o cliente a cada troca de carteira) e junta chamadas iguais que estão em andamento.
const MERCHANTS_TTL_MS = 60_000;
const CONFIG_TTL_MS = 15_000;
const shared = new Map<string, { at: number; value: Promise<unknown> }>();
/** Carteira do funcionário → endereço da conta Employee (não muda: é um PDA). */
const employeeAddressByWallet = new Map<string, PublicKey>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  shared.set(key, { at: Date.now(), value });
  value.catch(() => shared.delete(key)); // erro não fica no cache
  return value;
}

const toBig = (v: BN): bigint => BigInt(v.toString());
const toBN = (v: bigint): BN => new BN(v.toString());

/** Carteira fake para modo só leitura (nunca assina). */
function readOnlyWallet(): AnchorWallet {
  const kp = Keypair.generate();
  const fail = async (): Promise<never> => {
    throw new TabbitError("Unauthorized", "Connect a wallet to send transactions");
  };
  return { publicKey: kp.publicKey, signTransaction: fail, signAllTransactions: fail };
}

function mapError(e: unknown): never {
  if (e instanceof TabbitError) throw e;
  const anchorErr = e instanceof AnchorError ? e : (e as { error?: { errorCode?: { code?: string } } });
  const code = (anchorErr as AnchorError)?.error?.errorCode?.code;
  if (code && (ERROR_CODES as string[]).includes(code)) {
    throw new TabbitError(code as TabbitErrorCode, (anchorErr as AnchorError).error.errorMessage);
  }
  // Conta de restaurante inexistente = restaurante não credenciado
  if (/AccountNotInitialized|account does not exist/i.test(String(e))) {
    throw new TabbitError("MerchantInactive", "Merchant is not registered");
  }
  throw e;
}

function localDay(unixSeconds: number, tzOffsetMinutes: number): number {
  return Math.floor((unixSeconds + tzOffsetMinutes * 60) / 86_400);
}

export function createTabbitClient(opts: CreateTabbitClientOptions): TabbitClient {
  const wallet = opts.wallet ?? readOnlyWallet();
  const provider = new AnchorProvider(opts.connection, wallet, { commitment: "confirmed" });
  const program = new Program<Tabbit>(idl as Tabbit, provider);
  const connection = opts.connection;
  const configPda = findConfigPda(program.programId);
  const cacheKey = (name: string) => `${connection.rpcEndpoint}|${program.programId.toBase58()}|${name}`;
  const invalidate = (name: string) => shared.delete(cacheKey(name));

  const me = () => {
    if (!opts.wallet) throw new TabbitError("Unauthorized", "Connect a wallet to send transactions");
    return opts.wallet.publicKey;
  };

  // ---------- conversores ----------

  const toEmployer = (address: PublicKey, a: any, approved: boolean): EmployerAccount => ({
    address,
    approved,
    owner: a.owner,
    name: a.name,
    mint: a.mint,
    vault: a.vault,
    tzOffsetMinutes: a.tzOffsetMinutes,
    totalDeposited: toBig(a.totalDeposited),
    totalAllocated: toBig(a.totalAllocated),
  });

  const employerTzCache = new Map<string, number>();
  async function tzOf(employer: PublicKey): Promise<number> {
    const key = employer.toBase58();
    if (!employerTzCache.has(key)) {
      const e = await program.account.employer.fetch(employer);
      employerTzCache.set(key, e.tzOffsetMinutes);
    }
    return employerTzCache.get(key)!;
  }

  async function toEmployee(address: PublicKey, a: any): Promise<EmployeeAccount> {
    const tz = await tzOf(a.employer);
    const today = localDay(Math.floor(Date.now() / 1000), tz);
    const spentToday = a.lastSpendDay.toNumber() === today ? toBig(a.spentToday) : 0n;
    return {
      address,
      employer: a.employer,
      wallet: a.wallet,
      balance: toBig(a.balance),
      maxPerMeal: toBig(a.maxPerMeal),
      dailyCap: toBig(a.dailyCap),
      spentToday,
      windowStartMin: a.windowStartMin,
      windowEndMin: a.windowEndMin,
      active: a.active,
    };
  }

  const toMerchant = (address: PublicKey, a: any): MerchantAccount => ({
    address,
    wallet: a.wallet,
    name: a.name,
    category: CATEGORY_BY_CODE[a.category] ?? "other",
    active: a.active,
  });

  // ---------- histórico ----------

  const eventParser = new EventParser(program.programId, program.coder);

  type HistoryFilter = { merchant?: PublicKey; employee?: PublicKey; employer?: PublicKey; limit?: number; since?: number; until?: number };

  interface TxEvents {
    payments: Payment[];
    refunds: Refund[];
  }

  function eventsFromLogs(signature: string, logs: string[]): TxEvents {
    const out: TxEvents = { payments: [], refunds: [] };
    for (const ev of eventParser.parseLogs(logs)) {
      const d = ev.data as any;
      if (ev.name === "paymentMade")
        out.payments.push({
          signature,
          employer: d.employer,
          employee: d.employee,
          merchant: d.merchant,
          amount: toBig(d.amount),
          fee: toBig(d.fee),
          timestamp: d.timestamp.toNumber(),
        });
      else if (ev.name === "refundMade")
        out.refunds.push({
          signature,
          employer: d.employer,
          employee: d.employee,
          merchant: d.merchant,
          amount: toBig(d.amount),
          reference: utils.bytes.bs58.encode(Buffer.from(d.reference)),
          timestamp: d.timestamp.toNumber(),
        });
    }
    return out;
  }

  const paymentsFromLogs = (signature: string, logs: string[]) => eventsFromLogs(signature, logs).payments;

  // Transações confirmadas não mudam: guarda os eventos já lidos de cada assinatura
  const eventsBySig = new Map<string, TxEvents>();

  // A RPC pública da devnet responde 429 quando recebe muitas chamadas seguidas
  async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i >= tries - 1 || !/429|too many requests/i.test(String(e))) throw e;
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
  }

  // Leituras em andamento: pagamentos e estornos pedidos juntos (extrato) não buscam a mesma transação duas vezes
  const reading = new Map<string, Promise<void>>();

  function readTx(sig: string): Promise<void> {
    let p = reading.get(sig);
    if (!p) {
      p = withRetry(() => connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }))
        .then((tx) => {
          if (!tx) return; // ainda não indexada; tenta de novo na próxima leitura
          const logs = tx.meta?.logMessages;
          eventsBySig.set(sig, logs ? eventsFromLogs(sig, logs) : { payments: [], refunds: [] });
        })
        .finally(() => reading.delete(sig));
      reading.set(sig, p);
    }
    return p;
  }

  async function eventsOf(signatures: string[]): Promise<TxEvents> {
    // Sem getTransactions em lote (a RPC pública recusa); busca uma por vez
    for (const sig of signatures) if (!eventsBySig.has(sig)) await readTx(sig);
    const found = signatures.map((s) => eventsBySig.get(s));
    return { payments: found.flatMap((e) => e?.payments ?? []), refunds: found.flatMap((e) => e?.refunds ?? []) };
  }

  /** Conta mais específica para buscar o histórico (todo pagamento/estorno passa por ela). */
  async function historyAddress(filter: { merchant?: PublicKey; employee?: PublicKey; employer?: PublicKey }): Promise<PublicKey | null> {
    if (filter.merchant) return findMerchantPda(filter.merchant, program.programId);
    if (filter.employee) return (await client.getEmployeeByWallet(filter.employee))?.address ?? null;
    if (filter.employer) return filter.employer;
    return program.programId;
  }

  async function historyEvents(filter: HistoryFilter) {
    const address = await historyAddress(filter);
    if (!address) return { payments: [], refunds: [] };
    if (filter.since !== undefined) return eventsOf(await signaturesInRange(address, filter.since, filter.until));
    const limit = filter.limit ?? 50;
    // A conta da empresa também aparece em depósitos e cadastros: busca mais assinaturas que o limite
    const sigs = await withRetry(() =>
      connection.getSignaturesForAddress(address, { limit: Math.min(limit * 3, 100) }, "confirmed")
    );
    return eventsOf(sigs.filter((s) => !s.err).map((s) => s.signature));
  }

  /** Assinaturas de um período (extrato): pagina para trás até passar do início do período. */
  async function signaturesInRange(address: PublicKey, since: number, until = Infinity): Promise<string[]> {
    const out: string[] = [];
    let before: string | undefined;
    for (;;) {
      const page = await withRetry(() => connection.getSignaturesForAddress(address, { limit: 1000, before }, "confirmed"));
      for (const s of page) {
        const t = s.blockTime ?? 0;
        if (!s.err && t >= since && t < until) out.push(s.signature);
      }
      const oldest = page.at(-1);
      if (page.length < 1000 || !oldest || (oldest.blockTime ?? 0) < since) return out;
      before = oldest.signature;
    }
  }

  // Simula antes de pedir a assinatura: se o programa recusar (limite, saldo, horário...),
  // o app recebe o TabbitError na hora e a carteira nem abre o aviso de "transação revertida".
  function upsertBuilder(owner: PublicKey, employer: PublicKey, input: UpsertEmployeeInput) {
    return program.methods
      .upsertEmployee(
        input.wallet,
        toBN(input.balance),
        toBN(input.maxPerMeal),
        toBN(input.dailyCap),
        input.windowStartMin ?? 0,
        input.windowEndMin ?? 0
      )
      .accountsPartial({ owner, employer, employee: findEmployeePda(employer, input.wallet, program.programId) });
  }

  async function isApproved(employer: PublicKey): Promise<boolean> {
    const a = await program.account.employerApproval.fetchNullable(findApprovalPda(employer, program.programId));
    return !!a?.approved;
  }

  // Sem aprovação a conta ["approval", empresa] nem existe e o erro on-chain seria genérico
  async function requireApproved(employer: PublicKey) {
    if (!(await isApproved(employer))) throw new TabbitError("EmployerNotApproved", "This company is not approved by Tabbit yet");
  }

  // "Blockhash not found" é recusado na checagem prévia da RPC, antes de a transação ir para a rede:
  // tentar de novo (com blockhash novo) não tem como executar duas vezes.
  async function rpcWithFreshBlockhash(builder: { rpc(): Promise<TransactionSignature> }, tries = 3): Promise<TransactionSignature> {
    for (let i = 0; ; i++) {
      try {
        return await builder.rpc();
      } catch (e) {
        if (i >= tries - 1 || !/blockhash not found/i.test(String(e))) throw e;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }

  async function simulate(tx: Transaction) {
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      throw (
        AnchorError.parse(sim.value.logs ?? []) ??
        new Error(`Transaction simulation failed: ${JSON.stringify(sim.value.err)}\n${(sim.value.logs ?? []).join("\n")}`)
      );
    }
  }

  async function send(builder: {
    transaction(): Promise<Transaction>;
    rpc(): Promise<TransactionSignature>;
  }): Promise<TransactionSignature> {
    try {
      const tx = await builder.transaction();
      tx.feePayer = me();
      await simulate(tx);
      return await rpcWithFreshBlockhash(builder);
    } catch (e) {
      mapError(e);
    }
  }

  // Igual ao send, mas o patrocinador paga a taxa: o funcionário só assina, e o patrocinador co-assina e envia.
  async function sendSponsored(
    builder: { transaction(): Promise<Transaction> },
    sponsor: TabbitSponsor
  ): Promise<TransactionSignature> {
    try {
      const tx = await builder.transaction();
      tx.feePayer = sponsor.publicKey;
      await simulate(tx);
      tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
      const signed = await opts.wallet!.signTransaction(tx);
      return await sponsor.signAndSend(signed);
    } catch (e) {
      mapError(e);
    }
  }

  const client: TabbitClient = {
    // ---------- leitura ----------

    getConfig(): Promise<ConfigAccount> {
      return cached(cacheKey("config"), CONFIG_TTL_MS, async () => {
        const c = await program.account.config.fetch(configPda);
        return { authority: c.authority, treasury: c.treasury, feeBps: c.feeBps, paused: c.paused, mint: c.mint };
      });
    },

    async getEmployer(owner) {
      const address = findEmployerPda(owner, program.programId);
      const [a, approved] = await Promise.all([program.account.employer.fetchNullable(address), isApproved(address)]);
      return a ? toEmployer(address, a, approved) : null;
    },

    async listEmployers() {
      const [rows, approvals] = await Promise.all([program.account.employer.all(), program.account.employerApproval.all()]);
      const ok = new Set(approvals.filter((r) => r.account.approved).map((r) => r.account.employer.toBase58()));
      return rows.map((r) => toEmployer(r.publicKey, r.account, ok.has(r.publicKey.toBase58())));
    },

    async listEmployees(employerOwner) {
      const employer = findEmployerPda(employerOwner, program.programId);
      const rows = await program.account.employee.all([
        { memcmp: { offset: EMPLOYEE_EMPLOYER_OFFSET, bytes: employer.toBase58() } },
      ]);
      return Promise.all(rows.map((r) => toEmployee(r.publicKey, r.account)));
    },

    async getEmployeeByWallet(wallet) {
      // Já sabemos onde fica a conta: leitura direta, sem varrer o programa
      const known = employeeAddressByWallet.get(wallet.toBase58());
      if (known) {
        const a = await program.account.employee.fetchNullable(known);
        if (a?.active) return toEmployee(known, a);
      }
      const rows = await cached(cacheKey(`employee:${wallet.toBase58()}`), 5_000, () =>
        program.account.employee.all([{ memcmp: { offset: EMPLOYEE_WALLET_OFFSET, bytes: wallet.toBase58() } }])
      );
      if (rows.length === 0) return null;
      // MVP: 1 empresa por funcionário; se houver mais de uma, prefere a ativa
      const row = rows.find((r) => r.account.active) ?? rows[0];
      employeeAddressByWallet.set(wallet.toBase58(), row.publicKey);
      return toEmployee(row.publicKey, row.account);
    },

    listMerchants() {
      return cached(cacheKey("merchants"), MERCHANTS_TTL_MS, async () => {
        const rows = await program.account.merchant.all();
        return rows.map((r) => toMerchant(r.publicKey, r.account));
      });
    },

    async getMerchant(wallet) {
      const address = findMerchantPda(wallet, program.programId);
      const a = await program.account.merchant.fetchNullable(address);
      return a ? toMerchant(address, a) : null;
    },

    async listPayments(filter) {
      const limit = filter.limit ?? 50;
      const { payments } = await historyEvents(filter);
      return payments
        .filter((p) => !filter.merchant || p.merchant.equals(filter.merchant))
        .filter((p) => !filter.employee || p.employee.equals(filter.employee))
        .filter((p) => !filter.employer || p.employer.equals(filter.employer))
        .filter((p) => filter.since === undefined || (p.timestamp >= filter.since && p.timestamp < (filter.until ?? Infinity)))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, filter.since === undefined ? limit : undefined);
    },

    async listRefunds(filter) {
      const { refunds } = await historyEvents(filter);
      return refunds
        .filter((r) => !filter.merchant || r.merchant.equals(filter.merchant))
        .filter((r) => !filter.employee || r.employee.equals(filter.employee))
        .filter((r) => !filter.employer || r.employer.equals(filter.employer))
        .filter((r) => filter.since === undefined || (r.timestamp >= filter.since && r.timestamp < (filter.until ?? Infinity)))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, filter.since === undefined ? filter.limit ?? 50 : undefined);
    },

    onPayment(cb) {
      const id = connection.onLogs(
        program.programId,
        (res) => {
          if (res.err) return;
          paymentsFromLogs(res.signature, res.logs).forEach(cb);
        },
        "confirmed"
      );
      return () => {
        void connection.removeOnLogsListener(id);
      };
    },

    // ---------- escrita ----------

    async registerEmployer({ name, mint: requested, tzOffsetMinutes }) {
      const owner = me();
      const employer = findEmployerPda(owner, program.programId);
      const mint = requested ?? (await program.account.config.fetch(configPda)).mint;
      return send(
        program.methods
          .registerEmployer(name, tzOffsetMinutes)
          .accountsPartial({
            owner,
            employer,
            mint,
            vault: getAssociatedTokenAddressSync(mint, employer, true),
          })
      );
    },

    async deposit(amount) {
      const owner = me();
      const employer = findEmployerPda(owner, program.programId);
      const e = await program.account.employer.fetch(employer);
      await requireApproved(employer);
      return send(
        program.methods
          .deposit(toBN(amount))
          .accountsPartial({
            owner,
            employer,
            vault: e.vault,
            ownerToken: getAssociatedTokenAddressSync(e.mint, owner),
          })
      );
    },

    async upsertEmployees(inputs: UpsertEmployeeInput[]) {
      const owner = me();
      const employer = findEmployerPda(owner, program.programId);
      if (inputs.length === 0) return [];
      try {
        const ixs = await Promise.all(
          inputs.map((input) => upsertBuilder(owner, employer, input).instruction())
        );
        // ~8 por transação cabe no limite de 1232 bytes
        const txs: Transaction[] = [];
        for (let i = 0; i < ixs.length; i += UPSERTS_PER_TX) txs.push(new Transaction().add(...ixs.slice(i, i + UPSERTS_PER_TX)));
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        for (const tx of txs) {
          tx.feePayer = owner;
          tx.recentBlockhash = blockhash;
        }
        await simulate(txs[0]);
        const signed = await opts.wallet!.signAllTransactions(txs);
        const sigs: TransactionSignature[] = [];
        // Em sequência: o total alocado de uma depende da anterior
        for (const tx of signed) {
          const sig = await connection.sendRawTransaction(tx.serialize());
          await connection.confirmTransaction(sig, "confirmed");
          sigs.push(sig);
        }
        return sigs;
      } catch (e) {
        mapError(e);
      }
    },

    upsertEmployee(input: UpsertEmployeeInput) {
      const owner = me();
      return send(upsertBuilder(owner, findEmployerPda(owner, program.programId), input));
    },

    revokeEmployee(wallet) {
      const owner = me();
      const employer = findEmployerPda(owner, program.programId);
      return send(
        program.methods
          .revokeEmployee()
          .accountsPartial({
            owner,
            employer,
            employee: findEmployeePda(employer, wallet, program.programId),
          })
      );
    },

    async withdrawUnallocated(amount) {
      const owner = me();
      const employer = findEmployerPda(owner, program.programId);
      const e = await program.account.employer.fetch(employer);
      return send(
        program.methods
          .withdrawUnallocated(toBN(amount))
          .accountsPartial({
            owner,
            employer,
            vault: e.vault,
            ownerToken: getAssociatedTokenAddressSync(e.mint, owner),
          })
      );
    },

    registerMerchant({ wallet, name, category }) {
      const authority = me();
      return send(
        program.methods
          .registerMerchant(wallet, name, CATEGORY_CODES[category])
          .accountsPartial({
            authority,
            config: configPda,
            merchant: findMerchantPda(wallet, program.programId),
          })
      ).finally(() => invalidate("merchants"));
    },

    setEmployerApproved(owner, approved) {
      const authority = me();
      return send(
        program.methods
          .setEmployerApproved(approved)
          .accountsPartial({ authority, config: configPda, employer: findEmployerPda(owner, program.programId) })
      );
    },

    setPaused(paused) {
      const authority = me();
      return send(program.methods.setPaused(paused).accountsPartial({ authority, config: configPda })).finally(() =>
        invalidate("config")
      );
    },

    setMerchantActive(wallet, active) {
      const authority = me();
      return send(
        program.methods
          .setMerchantActive(active)
          .accountsPartial({
            authority,
            config: configPda,
            merchant: findMerchantPda(wallet, program.programId),
          })
      ).finally(() => invalidate("merchants"));
    },

    async pay({ merchant, amount }) {
      const payer = me();
      const emp = await this.getEmployeeByWallet(payer);
      if (!emp) throw new TabbitError("EmployeeInactive", "This wallet has no meal benefit");
      await requireApproved(emp.employer);
      const [employer, config] = await Promise.all([
        program.account.employer.fetch(emp.employer),
        program.account.config.fetch(configPda),
      ]);

      const merchantToken = getAssociatedTokenAddressSync(employer.mint, merchant);
      const treasuryToken = getAssociatedTokenAddressSync(employer.mint, config.treasury);

      // Cria as contas de token do restaurante e da tesouraria se ainda não existirem.
      // Com patrocinador, é ele quem paga o aluguel; sem, o próprio funcionário.
      const funder = opts.sponsor?.publicKey ?? payer;
      const pre: TransactionInstruction[] = [
        createAssociatedTokenAccountIdempotentInstruction(funder, merchantToken, merchant, employer.mint),
        createAssociatedTokenAccountIdempotentInstruction(funder, treasuryToken, config.treasury, employer.mint),
      ];

      const builder = program.methods
        .pay(toBN(amount))
        .accountsPartial({
          payer,
          config: configPda,
          employer: emp.employer,
          employee: emp.address,
          merchant: findMerchantPda(merchant, program.programId),
          vault: employer.vault,
          merchantToken,
          treasuryToken,
        })
        .preInstructions(pre);
      return opts.sponsor ? sendSponsored(builder, opts.sponsor) : send(builder);
    },

    async refund({ employee, amount, reference }) {
      const merchantWallet = me();
      const emp = await this.getEmployeeByWallet(employee);
      if (!emp) throw new TabbitError("EmployeeInactive", "This employee has no meal benefit");
      const employer = await program.account.employer.fetch(emp.employer);
      const ref = utils.bytes.bs58.decode(reference);
      if (ref.length !== 64) throw new TabbitError("InvalidAmount", "Invalid payment reference");
      return send(
        program.methods
          .refund(toBN(amount), Array.from(ref))
          .accountsPartial({
            merchantWallet,
            merchant: findMerchantPda(merchantWallet, program.programId),
            employer: emp.employer,
            employee: emp.address,
            vault: employer.vault,
            merchantToken: getAssociatedTokenAddressSync(employer.mint, merchantWallet),
          })
      );
    },
  };
  return client;
}
