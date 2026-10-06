// Diretório de funcionários (nome, e-mail, matrícula) fora da blockchain, no Postgres (Neon).
// Só o dono da empresa lê e grava: ele prova com uma assinatura da carteira (lib/directory-auth).
// A empresa é derivada da carteira autenticada, então ninguém mexe no diretório de outra.
import { neon } from "@neondatabase/serverless";
import { PublicKey } from "@solana/web3.js";
import { findEmployerPda } from "@tabbit/sdk";
import { AUTH_HEADER, verifyAuth } from "@/lib/directory-auth";
import type { DirectoryEntry } from "@/lib/directory";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const db = () => (process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null);
const fail = (status: number, error: string) => Response.json({ error }, { status });

function authEmployer(request: Request): { employer: string } | Response {
  const auth = verifyAuth(request.headers.get(AUTH_HEADER));
  if ("error" in auth) return fail(401, auth.error);
  return { employer: findEmployerPda(auth.wallet).toBase58() };
}

export async function GET(request: Request) {
  const sql = db();
  if (!sql) return fail(503, "Directory is not configured");
  const who = authEmployer(request);
  if (who instanceof Response) return who;
  const rows = (await sql.query(
    "select wallet, name, email, employee_id from directory where employer = $1 order by name nulls last",
    [who.employer]
  )) as { wallet: string; name: string | null; email: string | null; employee_id: string | null }[];
  return Response.json({ entries: rows.map((r) => ({ wallet: r.wallet, name: r.name, email: r.email, employeeId: r.employee_id })) });
}

/**
 * Grava em lote. Campo ausente (ou null) mantém o valor atual; string vazia apaga.
 * Assim a planilha só com nomes não apaga e-mails, e o formulário de edição consegue limpar um campo.
 */
export async function PUT(request: Request) {
  const sql = db();
  if (!sql) return fail(503, "Directory is not configured");
  const who = authEmployer(request);
  if (who instanceof Response) return who;

  let entries: Partial<DirectoryEntry>[];
  try {
    entries = ((await request.json()) as { entries?: Partial<DirectoryEntry>[] }).entries ?? [];
  } catch {
    return fail(400, "Invalid body");
  }
  if (!Array.isArray(entries) || entries.length === 0) return fail(400, "No entries");
  if (entries.length > MAX_ENTRIES) return fail(400, `At most ${MAX_ENTRIES} employees per request`);

  // A mesma carteira duas vezes: vale a última (o Postgres não atualiza a mesma linha duas vezes num comando)
  entries = [...new Map(entries.map((e) => [e.wallet, e])).values()];
  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
  const cols = { wallet: [] as string[], name: [] as (string | null)[], email: [] as (string | null)[], employeeId: [] as (string | null)[] };
  for (const [i, e] of entries.entries()) {
    try {
      cols.wallet.push(new PublicKey(e.wallet ?? "").toBase58());
    } catch {
      return fail(400, `Line ${i + 1}: invalid wallet`);
    }
    const email = clean(e.email, 200);
    if (email && !EMAIL.test(email)) return fail(400, `Line ${i + 1}: invalid email "${email}"`);
    cols.name.push(clean(e.name, 100));
    cols.email.push(email?.toLowerCase() ?? email);
    cols.employeeId.push(clean(e.employeeId, 50));
  }

  // O valor enviado fica em `input`: null = manter, "" = apagar, texto = gravar
  await sql.query(
    `with input as (
       select * from unnest($2::text[], $3::text[], $4::text[], $5::text[]) as t(w, n, e, i)
     )
     insert into directory (employer, wallet, name, email, employee_id)
     select $1, w, nullif(n, ''), nullif(e, ''), nullif(i, '') from input
     on conflict (employer, wallet) do update set
       name        = (select case when n is null then directory.name else nullif(n, '') end from input where w = excluded.wallet),
       email       = (select case when e is null then directory.email else nullif(e, '') end from input where w = excluded.wallet),
       employee_id = (select case when i is null then directory.employee_id else nullif(i, '') end from input where w = excluded.wallet),
       updated_at  = now()`,
    [who.employer, cols.wallet, cols.name, cols.email, cols.employeeId]
  );
  return Response.json({ saved: cols.wallet.length });
}
