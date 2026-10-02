// Números da página de transparência, a partir dos dados on-chain. Função pura: a rota
// /api/network usa no servidor (modo real) e a página usa no navegador (modo demo).
// Não expõe funcionários nem empresas: só totais e o nome dos restaurantes (estabelecimentos credenciados).
import type { EmployerAccount, MerchantAccount, Payment } from "@tabbit/sdk";

/** Teto de taxa do mercado (Decreto 12.712/2025), para comparar com o Tabbit. */
export const MARKET_FEE_BPS = 360n;
const DAYS = 14;
const RECENT = 30;
const TZ_MINUTES = -180; // dias contados no horário de Brasília

export interface NetworkPayment {
  signature: string;
  merchant: string; // carteira do restaurante
  amount: bigint;
  fee: bigint;
  timestamp: number;
}

export interface NetworkStats {
  generatedAt: number;
  /** false se o histórico foi cortado num limite (os totais seriam parciais). */
  complete: boolean;
  totals: { volume: bigint; fees: bigint; count: number };
  /** Volume por dia, do mais antigo ao de hoje. */
  daily: { day: string; volume: bigint; count: number }[];
  recent: NetworkPayment[];
  restaurants: { active: number; registered: number; names: Record<string, string> };
  companies: { approved: number };
  /** Saldo real dos cofres x o que foi reservado aos funcionários. */
  reserves: { inVaults: bigint; allocated: bigint };
}

const dayKey = (unix: number) => {
  const d = new Date((unix + TZ_MINUTES * 60) * 1000);
  return d.toISOString().slice(0, 10);
};

export function computeStats(input: {
  payments: Payment[];
  employers: EmployerAccount[];
  merchants: MerchantAccount[];
  /** Saldo real de cada cofre (mesma ordem de `employers`). */
  vaultBalances: bigint[];
  complete: boolean;
  now?: number;
}): NetworkStats {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const payments = [...input.payments].sort((a, b) => b.timestamp - a.timestamp);

  const daily: NetworkStats["daily"] = [];
  for (let i = DAYS - 1; i >= 0; i--) daily.push({ day: dayKey(now - i * 86_400), volume: 0n, count: 0 });
  const byDay = new Map(daily.map((d) => [d.day, d]));
  for (const p of payments) {
    const d = byDay.get(dayKey(p.timestamp));
    if (d) {
      d.volume += p.amount;
      d.count += 1;
    }
  }

  return {
    generatedAt: now,
    complete: input.complete,
    totals: {
      volume: payments.reduce((s, p) => s + p.amount, 0n),
      fees: payments.reduce((s, p) => s + p.fee, 0n),
      count: payments.length,
    },
    daily,
    recent: payments.slice(0, RECENT).map(toNetworkPayment),
    restaurants: {
      active: input.merchants.filter((m) => m.active).length,
      registered: input.merchants.length,
      names: Object.fromEntries(input.merchants.map((m) => [m.wallet.toBase58(), m.name])),
    },
    companies: { approved: input.employers.filter((e) => e.approved).length },
    reserves: {
      inVaults: input.vaultBalances.reduce((s, b) => s + b, 0n),
      allocated: input.employers.reduce((s, e) => s + e.totalAllocated, 0n),
    },
  };
}

const toNetworkPayment = (p: Payment): NetworkPayment => ({
  signature: p.signature,
  merchant: p.merchant.toBase58(),
  amount: p.amount,
  fee: p.fee,
  timestamp: p.timestamp,
});

/** Pagamento que chegou ao vivo: entra nos totais, no dia e na lista (sem duplicar). */
export function addPayment(stats: NetworkStats, p: Payment): NetworkStats {
  if (stats.recent.some((r) => r.signature === p.signature)) return stats;
  const day = dayKey(p.timestamp);
  return {
    ...stats,
    totals: { volume: stats.totals.volume + p.amount, fees: stats.totals.fees + p.fee, count: stats.totals.count + 1 },
    daily: stats.daily.map((d) => (d.day === day ? { ...d, volume: d.volume + p.amount, count: d.count + 1 } : d)),
    recent: [toNetworkPayment(p), ...stats.recent].slice(0, RECENT),
  };
}

/** Quanto o restaurante pagaria no teto do mercado pelo mesmo volume. */
export const marketFee = (volume: bigint) => (volume * MARKET_FEE_BPS) / 10_000n;

// bigint não passa pelo JSON: vira string com prefixo
export const statsToJson = (s: NetworkStats) => JSON.stringify(s, (_, v) => (typeof v === "bigint" ? `n:${v}` : v));
export const statsFromJson = (text: string): NetworkStats =>
  JSON.parse(text, (_, v) => (typeof v === "string" && /^n:-?\d+$/.test(v) ? BigInt(v.slice(2)) : v));
