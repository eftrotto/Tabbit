// Números públicos da rede para a página de transparência. Lê tudo da Solana uma vez e guarda,
// para os visitantes não baterem cada um na RPC (a pública da devnet limita bastante).
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { createTabbitClient, scanPayments } from "@tabbit/sdk";
import { computeStats, statsToJson } from "@/lib/network";

export const dynamic = "force-dynamic";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
const FRESH_MS = 20_000;

let last: { at: number; body: string } | null = null;
let inFlight: Promise<string> | null = null;

async function build(): Promise<string> {
  const connection = new Connection(RPC_URL, "confirmed");
  const client = createTabbitClient({ connection });
  const [employers, merchants] = await Promise.all([client.listEmployers(), client.listMerchants()]);
  // Todo pagamento passa pela conta do restaurante: varre só elas
  const [scan, vaultBalances] = await Promise.all([
    scanPayments(connection, { addresses: merchants.map((m) => m.address) }),
    vaultBalancesOf(connection, employers.map((e) => e.vault)),
  ]);
  return statsToJson(computeStats({ payments: scan.payments, employers, merchants, vaultBalances, complete: scan.complete }));
}

/** Saldo real de cada cofre, lido da conta de token (até 100 por chamada). */
async function vaultBalancesOf(connection: Connection, vaults: PublicKey[]): Promise<bigint[]> {
  const out: bigint[] = [];
  for (let i = 0; i < vaults.length; i += 100) {
    const accounts = await connection.getMultipleParsedAccounts(vaults.slice(i, i + 100));
    for (const a of accounts.value) {
      const data = a?.data;
      const amount = data && "parsed" in data ? (data.parsed?.info?.tokenAmount?.amount as string | undefined) : undefined;
      out.push(BigInt(amount ?? "0"));
    }
  }
  return out;
}

export async function GET() {
  if (!last || Date.now() - last.at > FRESH_MS) {
    // Uma busca por vez, mesmo com vários visitantes chegando juntos
    inFlight ??= build()
      .then((body) => {
        last = { at: Date.now(), body };
        return body;
      })
      .finally(() => {
        inFlight = null;
      });
    try {
      await inFlight;
    } catch (e) {
      // Sem dado novo: devolve o último que deu certo, se houver
      if (!last) return Response.json({ error: e instanceof Error ? e.message : "Failed to read the network" }, { status: 502 });
    }
  }
  return new Response(last!.body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
  });
}
