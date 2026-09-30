// Cliente mock: implementa o contrato TabbitClient (sdk/src/types.ts) em memória, com as mesmas
// regras do programa (IMPLEMENTACAO.md, seção 4.3). Persiste em localStorage e avisa as outras abas
// por BroadcastChannel, para a demo rodar em 3 abas (empresa, funcionário, restaurante) sem devnet.
import { Keypair, PublicKey } from "@solana/web3.js";
import { findEmployerPda, findEmployeePda, findMerchantPda, TabbitError, USDC_DEVNET_MINT } from "@tabbit/sdk";
import type {
  Category,
  ConfigAccount,
  EmployeeAccount,
  EmployerAccount,
  MerchantAccount,
  Payment,
  TabbitClient,
  UpsertEmployeeInput,
} from "@tabbit/sdk";

// Personas da demo (só existem no mock). Sem carteira conectada, cada visão age como uma delas.
export const DEMO = {
  platform: new PublicKey("g7MZs2qX4nHkVfRtvfL3GWTJZUCyRkK7mv1dbKqm46s"),
  treasury: new PublicKey("GMJuDb7qS2ARqmi895J3LLZ9Y1hWTy926iJwXf7WD8Eu"),
  employer: new PublicKey("A1h1G5psMdVHWkYbj5LRJc6EoqbYQpg5bWeiJrvRaVMi"),
  employee: new PublicKey("3u8xzDymuD9dKJjWoPfvZfsEBNNbUsHhNN9mYM9mhxTG"), // João
  employee2: new PublicKey("C7MHQt6NvWnkPA6TjpJ5K8yGkrLEyH4xnmmZdzJb753M"), // Maria
  merchant: new PublicKey("Lhm3L14ZUbMKsRGSFmhBAttL36dCT2QGTWBn18SU6uH"),
  merchant2: new PublicKey("931VQy4Wy2AEPcPtkNU1UeG5Qzqdz8DbjdGPYqZPxcnm"),
  merchant3: new PublicKey("35fQgCDLS2nsYim5AXkAfv2fESmfbHKFE1A7ek6rrYC3"),
};

const USDC = 1_000_000n;
const STORAGE_KEY = "tabbit-mock-v1";
const CATEGORIES: Category[] = ["restaurant", "cafe", "grocery", "other"];

// Estado guardado só com tipos serializáveis (base58 + bigint).
interface EmployerRow { owner: string; name: string; mint: string; tzOffsetMinutes: number; totalDeposited: bigint; totalAllocated: bigint }
interface EmployeeRow { employerOwner: string; wallet: string; balance: bigint; maxPerMeal: bigint; dailyCap: bigint; spentToday: bigint; lastSpendDay: number; windowStartMin: number; windowEndMin: number; active: boolean }
interface MerchantRow { wallet: string; name: string; category: Category; active: boolean }
interface PaymentRow { signature: string; employer: string; employee: string; merchant: string; amount: bigint; fee: bigint; timestamp: number }
interface Store {
  config: { authority: string; treasury: string; feeBps: number; paused: boolean };
  employers: EmployerRow[];
  employees: EmployeeRow[];
  merchants: MerchantRow[];
  payments: PaymentRow[];
}

function seed(): Store {
  const owner = DEMO.employer.toBase58();
  const employee = (wallet: PublicKey, balance: number, maxPerMeal: number, dailyCap: number, windowStartMin = 0, windowEndMin = 0): EmployeeRow => ({
    employerOwner: owner, wallet: wallet.toBase58(), balance: BigInt(balance) * USDC, maxPerMeal: BigInt(maxPerMeal) * USDC,
    dailyCap: BigInt(dailyCap) * USDC, spentToday: 0n, lastSpendDay: 0, windowStartMin, windowEndMin, active: true,
  });
  return {
    config: { authority: DEMO.platform.toBase58(), treasury: DEMO.treasury.toBase58(), feeBps: 80, paused: false },
    employers: [{ owner, name: "Acme Corp", mint: USDC_DEVNET_MINT.toBase58(), tzOffsetMinutes: -180, totalDeposited: 1000n * USDC, totalAllocated: 350n * USDC }],
    employees: [employee(DEMO.employee, 200, 40, 60), employee(DEMO.employee2, 150, 35, 50, 11 * 60, 15 * 60)],
    merchants: [
      { wallet: DEMO.merchant.toBase58(), name: "Cantina da Vila", category: "restaurant", active: true },
      { wallet: DEMO.merchant2.toBase58(), name: "Café Aurora", category: "cafe", active: true },
      { wallet: DEMO.merchant3.toBase58(), name: "Mercado Bom Preço", category: "grocery", active: true },
    ],
    payments: [],
  };
}

// ---- persistência + sincronização entre abas ----
const hasWindow = typeof window !== "undefined";
const channel = hasWindow && "BroadcastChannel" in window ? new BroadcastChannel("tabbit-mock") : null;
const listeners = new Set<(p: Payment) => void>();
let store: Store | null = null;

const replacer = (_: string, v: unknown) => (typeof v === "bigint" ? { $big: v.toString() } : v);
const reviver = (_: string, v: unknown) =>
  v && typeof v === "object" && "$big" in v ? BigInt((v as { $big: string }).$big) : v;

function load(): Store {
  if (store) return store;
  try {
    const raw = hasWindow ? localStorage.getItem(STORAGE_KEY) : null;
    store = raw ? (JSON.parse(raw, reviver) as Store) : seed();
  } catch {
    store = seed();
  }
  return store;
}

function save(s: Store) {
  try {
    if (hasWindow) localStorage.setItem(STORAGE_KEY, JSON.stringify(s, replacer));
  } catch {
    // modo privado / quota: segue só em memória
  }
  channel?.postMessage({ type: "sync" });
}

channel?.addEventListener("message", (ev: MessageEvent) => {
  store = null; // outra aba mudou o estado: relê do localStorage
  if (ev.data?.type === "payment") {
    const p = JSON.parse(ev.data.payment, reviver) as PaymentRow;
    listeners.forEach((cb) => cb(toPayment(p)));
  }
});

/** Volta os dados da demo ao estado inicial (botão "Reset demo" e testes). */
export function resetMockStore() {
  store = seed();
  save(store);
}

// ---- helpers ----
const pk = (s: string) => new PublicKey(s);
const fakeSignature = () => Keypair.generate().publicKey.toBase58() + Keypair.generate().publicKey.toBase58();
const localDay = (unix: number, tz: number) => Math.floor((unix + tz * 60) / 86400);
const localMinute = (unix: number, tz: number) => Math.floor((((unix + tz * 60) % 86400) + 86400) % 86400 / 60);

function toEmployer(r: EmployerRow): EmployerAccount {
  const address = findEmployerPda(pk(r.owner));
  return {
    address, owner: pk(r.owner), name: r.name, mint: pk(r.mint),
    vault: PublicKey.findProgramAddressSync([Buffer.from("mock-vault"), address.toBuffer()], address)[0],
    tzOffsetMinutes: r.tzOffsetMinutes, totalDeposited: r.totalDeposited, totalAllocated: r.totalAllocated,
  };
}

function toPayment(r: PaymentRow): Payment {
  return { signature: r.signature, employer: pk(r.employer), employee: pk(r.employee), merchant: pk(r.merchant), amount: r.amount, fee: r.fee, timestamp: r.timestamp };
}

function checkName(name: string) {
  if (new TextEncoder().encode(name).length > 32) throw new TabbitError("NameTooLong");
}

function checkWindow(start: number, end: number) {
  if (start === 0 && end === 0) return;
  if (start < 0 || end > 1440 || start >= end) throw new TabbitError("InvalidWindow");
}

export interface MockClientOptions {
  now?: () => number; // unix seconds; injetável para testes
}

/** `signer` = carteira que "assina" as escritas (null = só leitura). */
export function createMockClient(signer: PublicKey | null, opts: MockClientOptions = {}): TabbitClient {
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));

  const requireSigner = () => {
    if (!signer) throw new TabbitError("Unauthorized", "Connect a wallet first");
    return signer.toBase58();
  };
  const myEmployer = (s: Store) => {
    const row = s.employers.find((e) => e.owner === requireSigner());
    if (!row) throw new TabbitError("Unauthorized", "Register your company first");
    return row;
  };
  const requireAuthority = (s: Store) => {
    if (requireSigner() !== s.config.authority) throw new TabbitError("Unauthorized");
  };
  const toEmployee = (r: EmployeeRow): EmployeeAccount => {
    const employer = load().employers.find((e) => e.owner === r.employerOwner)!;
    const employerPda = findEmployerPda(pk(r.employerOwner));
    const sameDay = localDay(now(), employer.tzOffsetMinutes) === r.lastSpendDay;
    return {
      address: findEmployeePda(employerPda, pk(r.wallet)), employer: employerPda, wallet: pk(r.wallet),
      balance: r.balance, maxPerMeal: r.maxPerMeal, dailyCap: r.dailyCap, spentToday: sameDay ? r.spentToday : 0n,
      windowStartMin: r.windowStartMin, windowEndMin: r.windowEndMin, active: r.active,
    };
  };
  const toMerchant = (r: MerchantRow): MerchantAccount => ({
    address: findMerchantPda(pk(r.wallet)), wallet: pk(r.wallet), name: r.name, category: r.category, active: r.active,
  });
  const done = (s: Store) => {
    save(s);
    return Promise.resolve(fakeSignature());
  };
  // Erros saem como Promise rejeitada, igual ao cliente real.
  const tx = (fn: () => Promise<string>) => {
    try {
      return fn();
    } catch (e) {
      return Promise.reject(e);
    }
  };

  return {
    async getConfig(): Promise<ConfigAccount> {
      const c = load().config;
      return { authority: pk(c.authority), treasury: pk(c.treasury), feeBps: c.feeBps, paused: c.paused };
    },
    async getEmployer(owner) {
      const row = load().employers.find((e) => e.owner === owner.toBase58());
      return row ? toEmployer(row) : null;
    },
    async listEmployees(employerOwner) {
      return load().employees.filter((e) => e.employerOwner === employerOwner.toBase58()).map(toEmployee);
    },
    async getEmployeeByWallet(wallet) {
      const row = load().employees.find((e) => e.wallet === wallet.toBase58());
      return row ? toEmployee(row) : null;
    },
    async listMerchants() {
      return load().merchants.map(toMerchant);
    },
    async getMerchant(wallet) {
      const row = load().merchants.find((m) => m.wallet === wallet.toBase58());
      return row ? toMerchant(row) : null;
    },
    async listPayments({ merchant, employee, employer, limit }) {
      return load()
        .payments.filter(
          (p) =>
            (!merchant || p.merchant === merchant.toBase58()) &&
            (!employee || p.employee === employee.toBase58()) &&
            (!employer || p.employer === employer.toBase58())
        )
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit ?? Infinity)
        .map(toPayment);
    },
    onPayment(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },

    registerEmployer: ({ name, mint, tzOffsetMinutes }) =>
      tx(() => {
        const s = load();
        const owner = requireSigner();
        checkName(name);
        if (s.employers.some((e) => e.owner === owner)) throw new Error("Company already registered for this wallet");
        s.employers.push({ owner, name, mint: mint.toBase58(), tzOffsetMinutes, totalDeposited: 0n, totalAllocated: 0n });
        return done(s);
      }),
    deposit: (amount) =>
      tx(() => {
        const s = load();
        const emp = myEmployer(s);
        if (amount <= 0n) throw new TabbitError("InvalidAmount");
        emp.totalDeposited += amount;
        return done(s);
      }),
    upsertEmployee: (input: UpsertEmployeeInput) =>
      tx(() => {
        const s = load();
        const emp = myEmployer(s);
        const start = input.windowStartMin ?? 0;
        const end = input.windowEndMin ?? 0;
        checkWindow(start, end);
        const wallet = input.wallet.toBase58();
        const row = s.employees.find((e) => e.employerOwner === emp.owner && e.wallet === wallet);
        const allocated = emp.totalAllocated - (row?.balance ?? 0n) + input.balance;
        if (allocated > emp.totalDeposited) throw new TabbitError("OverAllocated");
        emp.totalAllocated = allocated;
        const fields = { balance: input.balance, maxPerMeal: input.maxPerMeal, dailyCap: input.dailyCap, windowStartMin: start, windowEndMin: end, active: true };
        if (row) Object.assign(row, fields);
        else s.employees.push({ employerOwner: emp.owner, wallet, spentToday: 0n, lastSpendDay: 0, ...fields });
        return done(s);
      }),
    revokeEmployee: (wallet) =>
      tx(() => {
        const s = load();
        const emp = myEmployer(s);
        const row = s.employees.find((e) => e.employerOwner === emp.owner && e.wallet === wallet.toBase58());
        if (!row) throw new TabbitError("Unauthorized", "Employee not found");
        emp.totalAllocated -= row.balance;
        row.balance = 0n;
        row.active = false;
        return done(s);
      }),
    withdrawUnallocated: (amount) =>
      tx(() => {
        const s = load();
        const emp = myEmployer(s);
        if (amount <= 0n) throw new TabbitError("InvalidAmount");
        if (amount > emp.totalDeposited - emp.totalAllocated) throw new TabbitError("OverAllocated");
        emp.totalDeposited -= amount;
        return done(s);
      }),
    registerMerchant: ({ wallet, name, category }) =>
      tx(() => {
        const s = load();
        requireAuthority(s);
        checkName(name);
        if (!CATEGORIES.includes(category)) throw new Error(`Unknown category ${category}`);
        const row = s.merchants.find((m) => m.wallet === wallet.toBase58());
        if (row) Object.assign(row, { name, category, active: true });
        else s.merchants.push({ wallet: wallet.toBase58(), name, category, active: true });
        return done(s);
      }),
    setMerchantActive: (wallet, active) =>
      tx(() => {
        const s = load();
        requireAuthority(s);
        const row = s.merchants.find((m) => m.wallet === wallet.toBase58());
        if (!row) throw new Error("Merchant not found");
        row.active = active;
        return done(s);
      }),
    pay: ({ merchant, amount }) =>
      tx(() => {
        const s = load();
        const me = requireSigner();
        // Mesma ordem de checagem do programa (seção 4.3).
        if (s.config.paused) throw new TabbitError("Paused");
        const row = s.employees.find((e) => e.wallet === me);
        if (!row || !row.active) throw new TabbitError("EmployeeInactive");
        const m = s.merchants.find((x) => x.wallet === merchant.toBase58());
        if (!m || !m.active) throw new TabbitError("MerchantInactive");
        if (amount <= 0n) throw new TabbitError("InvalidAmount");
        if (amount > row.maxPerMeal) throw new TabbitError("ExceedsMaxPerMeal");
        if (amount > row.balance) throw new TabbitError("InsufficientBalance");
        const emp = s.employers.find((e) => e.owner === row.employerOwner)!;
        const t = now();
        const today = localDay(t, emp.tzOffsetMinutes);
        if (row.lastSpendDay !== today) {
          row.spentToday = 0n;
          row.lastSpendDay = today;
        }
        if (row.spentToday + amount > row.dailyCap) throw new TabbitError("ExceedsDailyCap");
        if (!(row.windowStartMin === 0 && row.windowEndMin === 0)) {
          const minute = localMinute(t, emp.tzOffsetMinutes);
          if (minute < row.windowStartMin || minute >= row.windowEndMin) throw new TabbitError("OutsideTimeWindow");
        }
        const fee = (amount * BigInt(s.config.feeBps)) / 10_000n;
        row.balance -= amount;
        row.spentToday += amount;
        emp.totalAllocated -= amount;
        emp.totalDeposited -= amount;
        const payment: PaymentRow = {
          signature: fakeSignature(), employer: findEmployerPda(pk(emp.owner)).toBase58(), employee: me,
          merchant: m.wallet, amount, fee, timestamp: t,
        };
        s.payments.push(payment);
        save(s);
        listeners.forEach((cb) => cb(toPayment(payment)));
        channel?.postMessage({ type: "payment", payment: JSON.stringify(payment, replacer) });
        return Promise.resolve(payment.signature);
      }),
  };
}
