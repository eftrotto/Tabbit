// Configuração lida das envs públicas (separada de tabbit.ts para não criar import circular).
import { clusterApiUrl } from "@solana/web3.js";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
