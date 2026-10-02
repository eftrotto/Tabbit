// *** CONTRATO ENTRE DEV A (programa + SDK) E DEV B (app) ***
// Qualquer mudança aqui: PR só com esta mudança, aprovado pelos dois (ver docs/IMPLEMENTACAO.md, seção 7).
// Espelha as contas/instruções/erros de programs/tabbit/src (seção 4 do guia).
import type { PublicKey, TransactionSignature } from "@solana/web3.js";

export type Category = "restaurant" | "cafe" | "grocery" | "other";

export interface ConfigAccount {
  authority: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  paused: boolean;
  mint: PublicKey; // token oficial do benefício
}

export interface EmployerAccount {
  address: PublicKey; // PDA
  owner: PublicKey;
  name: string;
  mint: PublicKey;
  vault: PublicKey;
  tzOffsetMinutes: number;
  totalDeposited: bigint;
  totalAllocated: bigint;
  approved: boolean; // aprovada pela plataforma (só então deposita e paga)
}

export interface EmployeeAccount {
  address: PublicKey; // PDA
  employer: PublicKey; // PDA do Employer
  wallet: PublicKey;
  balance: bigint;
  maxPerMeal: bigint;
  dailyCap: bigint;
  spentToday: bigint; // já "resetado" pelo SDK se o dia mudou
  windowStartMin: number;
  windowEndMin: number;
  active: boolean;
}

export interface MerchantAccount {
  address: PublicKey; // PDA
  wallet: PublicKey;
  name: string;
  category: Category;
  active: boolean;
}

export interface Payment {
  signature: TransactionSignature;
  employer: PublicKey;
  employee: PublicKey; // wallet do funcionário
  merchant: PublicKey; // wallet do restaurante
  amount: bigint;
  fee: bigint;
  timestamp: number; // unix seconds
}

export interface UpsertEmployeeInput {
  wallet: PublicKey;
  balance: bigint;
  maxPerMeal: bigint;
  dailyCap: bigint;
  windowStartMin?: number; // default 0
  windowEndMin?: number; // default 0 (sem janela)
}

export type TabbitErrorCode =
  | "Paused"
  | "Unauthorized"
  | "EmployeeInactive"
  | "MerchantInactive"
  | "ExceedsMaxPerMeal"
  | "ExceedsDailyCap"
  | "InsufficientBalance"
  | "OutsideTimeWindow"
  | "OverAllocated"
  | "InvalidAmount"
  | "NameTooLong"
  | "InvalidWindow"
  | "EmployerNotApproved"
  | "InvalidMint";

export class TabbitError extends Error {
  constructor(public code: TabbitErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TabbitError";
  }
}

/** Interface que o app usa. O Dev A implementa de verdade (client.ts); o Dev B implementa um mock (app/src/lib/mock-client.ts). */
export interface TabbitClient {
  // leitura
  getConfig(): Promise<ConfigAccount>;
  getEmployer(owner: PublicKey): Promise<EmployerAccount | null>;
  listEmployers(): Promise<EmployerAccount[]>;
  listEmployees(employerOwner: PublicKey): Promise<EmployeeAccount[]>;
  getEmployeeByWallet(wallet: PublicKey): Promise<EmployeeAccount | null>; // MVP: 1 empresa por funcionário
  listMerchants(): Promise<MerchantAccount[]>;
  getMerchant(wallet: PublicKey): Promise<MerchantAccount | null>;
  listPayments(filter: {
    merchant?: PublicKey;
    employee?: PublicKey;
    employer?: PublicKey;
    limit?: number;
  }): Promise<Payment[]>;
  onPayment(cb: (p: Payment) => void): () => void; // retorna função para cancelar

  // escrita (a carteira conectada assina)
  /** mint é opcional: o programa só aceita o token oficial da Config. */
  registerEmployer(input: { name: string; mint?: PublicKey; tzOffsetMinutes: number }): Promise<TransactionSignature>;
  deposit(amount: bigint): Promise<TransactionSignature>;
  upsertEmployee(input: UpsertEmployeeInput): Promise<TransactionSignature>;
  /** Vários funcionários de uma vez (planilha, recarga mensal): agrupa em poucas transações e pede uma assinatura só. */
  upsertEmployees(inputs: UpsertEmployeeInput[]): Promise<TransactionSignature[]>;
  revokeEmployee(wallet: PublicKey): Promise<TransactionSignature>;
  withdrawUnallocated(amount: bigint): Promise<TransactionSignature>;
  registerMerchant(input: { wallet: PublicKey; name: string; category: Category }): Promise<TransactionSignature>;
  setMerchantActive(wallet: PublicKey, active: boolean): Promise<TransactionSignature>;
  setEmployerApproved(owner: PublicKey, approved: boolean): Promise<TransactionSignature>;
  setPaused(paused: boolean): Promise<TransactionSignature>;
  pay(input: { merchant: PublicKey; amount: bigint }): Promise<TransactionSignature>;
}
