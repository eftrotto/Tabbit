// "Try it as an employee": quem entra (e-mail/Google) e ainda não tem benefício pode pedir um saldo
// de demonstração na empresa de demo. O servidor assina como essa empresa com DEMO_EMPLOYER_SECRET_KEY.
// Só existe para a devnet: são tokens de teste, e cada cadastro custa ~0,002 SOL de aluguel à empresa.
import { clusterApiUrl, Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { createTabbitClient, type AnchorWallet } from "@tabbit/sdk";

export const dynamic = "force-dynamic";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
const USDC = 1_000_000n;
const BALANCE = 50n * USDC;
const MAX_PER_MEAL = 25n * USDC;
const DAILY_CAP = 50n * USDC;
const REFILL_AFTER_MS = 10 * 60_000; // recarga para quem gastou tudo, no máximo a cada 10 min
const PER_IP_PER_HOUR = 5;
const PER_DAY = 300; // por instância do servidor

let demo: Keypair | null | undefined;
function loadDemo(): Keypair | null {
  if (demo !== undefined) return demo;
  const raw = process.env.DEMO_EMPLOYER_SECRET_KEY; // array JSON, mesmo formato de `solana-keygen`
  demo = raw ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))) : null;
  return demo;
}

function walletOf(kp: Keypair): AnchorWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return { publicKey: kp.publicKey, signTransaction: async (tx) => sign(tx), signAllTransactions: async (txs) => txs.map(sign) };
}

// Limites em memória: suficientes para uma demo na devnet
const byIp = new Map<string, number[]>();
const lastRefill = new Map<string, number>();
let day = "";
let today = 0;

function limited(ip: string): string | null {
  const now = Date.now();
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) [day, today] = [d, 0];
  if (today >= PER_DAY) return "The demo is very popular today. Please try again tomorrow.";
  const hits = (byIp.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= PER_IP_PER_HOUR) return "Too many demo requests from this network. Try again in an hour.";
  byIp.set(ip, [...hits, now]);
  today++;
  return null;
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function GET() {
  const kp = loadDemo();
  if (!kp) return Response.json({ enabled: false });
  const employer = await createTabbitClient({ connection: new Connection(RPC_URL, "confirmed") }).getEmployer(kp.publicKey).catch(() => null);
  return Response.json({
    enabled: !!employer?.approved,
    company: employer?.name ?? null,
    employer: employer?.address.toBase58() ?? null,
    balance: BALANCE.toString(),
    maxPerMeal: MAX_PER_MEAL.toString(),
  });
}

export async function POST(request: Request) {
  const kp = loadDemo();
  if (!kp) return fail(503, "Demo is not available");

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(((await request.json()) as { wallet?: string }).wallet ?? "");
  } catch {
    return fail(400, "Invalid wallet");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const asDemo = createTabbitClient({ connection, wallet: walletOf(kp) });
  const existing = await asDemo.getEmployeeByWallet(wallet);
  const demoEmployer = (await asDemo.getEmployer(kp.publicKey))?.address;
  if (existing && demoEmployer && !existing.employer.equals(demoEmployer))
    return fail(409, "This wallet already has a meal benefit from another company");

  // Já é da empresa de demo: só recarrega se o saldo acabou (e não recarregou há pouco)
  const key = wallet.toBase58();
  if (existing?.active && existing.balance >= MAX_PER_MEAL) return Response.json({ status: "already-enrolled" });
  if (existing && Date.now() - (lastRefill.get(key) ?? 0) < REFILL_AFTER_MS)
    return fail(429, "You can refill the demo balance again in a few minutes");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const why = limited(ip);
  if (why) return fail(429, why);

  try {
    const signature = await asDemo.upsertEmployee({ wallet, balance: BALANCE, maxPerMeal: MAX_PER_MEAL, dailyCap: DAILY_CAP });
    lastRefill.set(key, Date.now());
    return Response.json({ status: existing ? "refilled" : "enrolled", signature });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "OverAllocated") return fail(503, "The demo company ran out of demo funds. Please tell the Tabbit team.");
    return fail(502, e instanceof Error ? e.message : "Could not create the demo benefit");
  }
}
