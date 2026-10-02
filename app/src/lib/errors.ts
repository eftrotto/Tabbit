import type { TabbitErrorCode } from "@tabbit/sdk";

export const ERROR_MESSAGES: Record<TabbitErrorCode, string> = {
  Paused: "Payments are temporarily paused",
  Unauthorized: "This wallet is not allowed to do that",
  EmployeeInactive: "This benefit card is not active",
  MerchantInactive: "This restaurant is not accepting Tabbit right now",
  ExceedsMaxPerMeal: "Above the per-meal limit",
  ExceedsDailyCap: "Daily limit reached",
  InsufficientBalance: "Insufficient balance",
  OutsideTimeWindow: "Outside allowed meal hours",
  OverAllocated: "Not enough unallocated funds in the vault",
  InvalidAmount: "Enter an amount greater than zero",
  NameTooLong: "Name is too long (max 32 characters)",
  InvalidWindow: "Invalid meal time window",
  EmployerNotApproved: "This company is waiting for Tabbit approval",
  InvalidMint: "This token is not accepted by Tabbit",
};

/** Mensagem amigável para qualquer erro vindo do cliente (TabbitError, carteira, rede). */
export function friendlyError(e: unknown): string {
  // Checa pelo formato e não por instanceof: o SDK pode vir de outra cópia do módulo.
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && code in ERROR_MESSAGES) return ERROR_MESSAGES[code as TabbitErrorCode];
  if (e instanceof Error && /reject/i.test(e.message)) return "Transaction cancelled in wallet";
  return e instanceof Error ? e.message : "Something went wrong";
}
