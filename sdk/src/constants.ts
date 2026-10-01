import { PublicKey } from "@solana/web3.js";

// Atualize depois do primeiro deploy (anchor keys sync + anchor deploy).
export const PROGRAM_ID = new PublicKey("Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn");

// USDC de teste da Circle na devnet (faucet: https://faucet.circle.com)
export const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const USDC_DECIMALS = 6;

export const SEEDS = {
  config: "config",
  employer: "employer",
  employee: "employee",
  merchant: "merchant",
} as const;

export const CATEGORY_CODES = { restaurant: 0, cafe: 1, grocery: 2, other: 3 } as const;
