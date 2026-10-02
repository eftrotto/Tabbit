// Fee payer (patrocinador): paga a taxa de rede e o aluguel das contas de token nos pagamentos,
// para o funcionário não precisar de SOL. Só co-assina transações que passam em validateSponsoredPay.
import { clusterApiUrl, Connection, Keypair, SendTransactionError, Transaction } from "@solana/web3.js";
import { PROGRAM_ID, SponsorRejected, validateSponsoredPay } from "@tabbit/sdk";

export const dynamic = "force-dynamic";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
const MAX_TX_BYTES = 1232; // limite de tamanho de transação da Solana
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5; // pagamentos patrocinados por funcionário por minuto (por instância do servidor)

let sponsor: Keypair | null | undefined;
function loadSponsor(): Keypair | null {
  if (sponsor !== undefined) return sponsor;
  const raw = process.env.SPONSOR_SECRET_KEY; // array JSON, mesmo formato de `solana-keygen`
  sponsor = raw ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))) : null;
  return sponsor;
}

const recent = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  recent.set(key, [...hits, now]);
  return false;
}

const fail = (status: number, error: string, logs?: string[]) => Response.json({ error, logs }, { status });

export async function GET() {
  const kp = loadSponsor();
  if (!kp) return fail(503, "Sponsor not configured");
  // Saldo em SOL para o painel da plataforma avisar antes de acabar
  const lamports = await new Connection(RPC_URL, "confirmed").getBalance(kp.publicKey).catch(() => null);
  return Response.json({ publicKey: kp.publicKey.toBase58(), lamports });
}

export async function POST(request: Request) {
  const kp = loadSponsor();
  if (!kp) return fail(503, "Sponsor not configured");

  let tx: Transaction;
  try {
    const { transaction } = (await request.json()) as { transaction?: string };
    const bytes = Buffer.from(transaction ?? "", "base64");
    if (bytes.length === 0 || bytes.length > MAX_TX_BYTES) return fail(400, "Invalid transaction");
    tx = Transaction.from(bytes);
  } catch {
    return fail(400, "Invalid transaction");
  }

  let employee;
  try {
    employee = validateSponsoredPay(tx, kp.publicKey, PROGRAM_ID);
  } catch (e) {
    if (e instanceof SponsorRejected) return fail(400, `Transaction not sponsored: ${e.message}`);
    throw e;
  }
  if (rateLimited(employee.toBase58())) return fail(429, "Too many payments, wait a minute and try again");

  tx.partialSign(kp);
  const connection = new Connection(RPC_URL, "confirmed");
  try {
    // Preflight ligado: se o programa recusar, a RPC devolve o erro sem cobrar taxa do patrocinador
    const signature = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
    await waitConfirmed(connection, signature);
    return Response.json({ signature });
  } catch (e) {
    if (e instanceof SendTransactionError) return fail(400, e.message, e.logs ?? undefined);
    return fail(502, e instanceof Error ? e.message : "Failed to send transaction");
  }
}

async function waitConfirmed(connection: Connection, signature: string) {
  for (let i = 0; i < 60; i++) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Transaction not confirmed in time");
}
