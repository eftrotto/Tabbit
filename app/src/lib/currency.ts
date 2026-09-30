// Conversão USDC (unidades base, 6 casas) → moeda de exibição. Cotação fixa para a demo,
// configurável por env (NEXT_PUBLIC_RATE_BRL / NEXT_PUBLIC_RATE_EUR).
export const USDC_DECIMALS = 6;
const UNIT = 10n ** BigInt(USDC_DECIMALS);

export type DisplayCurrency = "BRL" | "EUR" | "USD";
export const CURRENCIES: DisplayCurrency[] = ["BRL", "EUR", "USD"];

// Quantas unidades da moeda local valem 1 USDC.
export const RATES: Record<DisplayCurrency, number> = {
  BRL: Number(process.env.NEXT_PUBLIC_RATE_BRL ?? 5.4),
  EUR: Number(process.env.NEXT_PUBLIC_RATE_EUR ?? 0.92),
  USD: 1,
};

const LOCALES: Record<DisplayCurrency, string> = { BRL: "pt-BR", EUR: "de-DE", USD: "en-US" };

/** Unidades base → número em USDC (só para exibição; nunca use para cálculo on-chain). */
export function toUsdc(base: bigint): number {
  return Number(base) / Number(UNIT);
}

/** "12.5" → 12_500_000n. Aceita até 6 casas; retorna null se inválido ou negativo. */
export function parseUsdc(input: string): bigint | null {
  const s = input.trim().replace(",", ".");
  const m = /^(\d+)(?:\.(\d{0,6}))?$/.exec(s);
  if (!m) return null;
  return BigInt(m[1]) * UNIT + BigInt((m[2] ?? "").padEnd(USDC_DECIMALS, "0"));
}

/** 12_500_000n → "12.5" (inverso de parseUsdc, sem zeros sobrando). */
export function usdcToInput(base: bigint): string {
  const frac = (base % UNIT).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return (base / UNIT).toString() + (frac ? "." + frac : "");
}

export function formatUsdc(base: bigint): string {
  return `${toUsdc(base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

export function formatFiat(base: bigint, currency: DisplayCurrency): string {
  return new Intl.NumberFormat(LOCALES[currency], { style: "currency", currency }).format(
    toUsdc(base) * RATES[currency]
  );
}
