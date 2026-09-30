// Cliente real. Dono: Dev A (IMPLEMENTACAO.md, seção 5, passo 6).
import type { Connection } from "@solana/web3.js";
import type { AnchorWallet } from "./wallet";
import type { TabbitClient } from "./types";

export interface CreateTabbitClientOptions {
  connection: Connection;
  wallet?: AnchorWallet; // sem carteira = só leitura
}

export function createTabbitClient(_opts: CreateTabbitClientOptions): TabbitClient {
  throw new Error("TODO (Dev A): implementar createTabbitClient. Até lá o app usa o mock (NEXT_PUBLIC_USE_MOCK=true).");
}
