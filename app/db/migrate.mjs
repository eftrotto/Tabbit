// Aplica db/schema.sql no banco de DATABASE_URL. Idempotente (só "create ... if not exists").
// Uso: npm run db:migrate -w app   (lê app/.env.local)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida (app/.env.local)");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(new URL("./schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);
const [{ count }] = await sql.query("select count(*)::int as count from directory");
console.log(`✓ schema aplicado (${statements.length} comandos). Linhas em directory: ${count}`);
