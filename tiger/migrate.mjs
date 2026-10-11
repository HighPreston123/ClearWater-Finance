// Applies tiger/migrations/*.sql in order to TigerData, tracking applied files in fin_meta.schema_migrations.
// Usage: TIGER_DATABASE_URL=... node tiger/migrate.mjs   (URL is never printed)
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TIGER_DATABASE_URL;
if (!url) {
  console.error("TIGER_DATABASE_URL is not set");
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
try {
  await sql`CREATE SCHEMA IF NOT EXISTS fin_meta`;
  await sql`CREATE TABLE IF NOT EXISTS fin_meta.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql`SELECT name FROM fin_meta.schema_migrations`).map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    if (body.startsWith("-- tiger:no-transaction")) {
      // e.g. refresh_continuous_aggregate, which cannot run inside a transaction block.
      await sql.unsafe(body);
      await sql`INSERT INTO fin_meta.schema_migrations (name) VALUES (${file})`;
    } else {
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO fin_meta.schema_migrations (name) VALUES (${file})`;
      });
    }
    console.log("applied", file);
  }
  console.log("migrations up to date");
} catch (e) {
  console.error("migration failed:", e.code ?? "", String(e.message).replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
  process.exitCode = 1;
} finally {
  await sql.end();
}
