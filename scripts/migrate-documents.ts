/**
 * Creates (or verifies) every table behind /admin and the public Documents & Verification area.
 *
 *   npm run migrate:documents
 *
 * Tables:
 *   admin_login_attempts, admin_audit_log             (lib/admin/tables.ts)
 *   documents, document_files, verification_events   (lib/documents/schema.ts)
 *
 * Safe to re-run: every statement is CREATE ... IF NOT EXISTS. The app also creates the tables
 * lazily on first use, so this script exists to provision the schema ahead of a deploy, which
 * avoids two cold serverless instances racing the very first CREATE TABLE, and to fail loudly when
 * the database cannot be reached.
 *
 * Which database it targets follows lib/db.ts: DATABASE_URL (Neon) by default, or the embedded
 * .local-db/ when ACEVA_LOCAL_DB=1 (development only). The connection string is never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureAdminTables } from "../lib/admin/tables";
import { getSql, isDatabaseConfigured } from "../lib/db";
import { ensureDocumentTables } from "../lib/documents/schema";

const TAG = "[migrate-documents]";

const EXPECTED_TABLES = [
  "admin_login_attempts",
  "admin_audit_log",
  "documents",
  "document_files",
  "verification_events",
] as const;

/**
 * `tsx` does not load .env.local the way `next dev` does. lib/pulse/env.ts already falls back to the
 * file for DATABASE_URL, but ACEVA_LOCAL_DB is read straight from process.env, so without this a
 * developer who set it in .env.local would silently migrate against Neon instead of .local-db/.
 * An explicit shell value always wins.
 */
function hydrateLocalDbFlagFromEnvFile(): void {
  if (process.env.ACEVA_LOCAL_DB !== undefined) return;
  try {
    const file = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return;
    const match = fs.readFileSync(file, "utf-8").match(/^ACEVA_LOCAL_DB\s*=\s*(.*)$/m);
    if (!match) return;
    const raw = match[1].trim();
    const quoted = raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0];
    process.env.ACEVA_LOCAL_DB = quoted ? raw.slice(1, -1).trim() : raw;
  } catch {
    // An unreadable .env.local simply means the flag stays unset.
  }
}

/** The embedded client exposes close(); Neon's HTTP client does not and needs none. */
async function closeIfLocal(sql: ReturnType<typeof getSql>): Promise<void> {
  const close = (sql as { close?: unknown }).close;
  if (typeof close === "function") await (close as () => Promise<void>).call(sql);
}

async function listPresentTables(sql: ReturnType<typeof getSql>): Promise<Set<string>> {
  // No bind parameters on purpose: the list is a fixed constant, and a literal IN (...) behaves the
  // same on Neon and on the embedded engine.
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('admin_login_attempts', 'admin_audit_log', 'documents', 'document_files', 'verification_events')
  `;
  return new Set(rows.map((row) => String(row.table_name)));
}

async function main(): Promise<void> {
  hydrateLocalDbFlagFromEnvFile();

  if (!isDatabaseConfigured()) {
    console.error(
      `${TAG} No database is configured. Set DATABASE_URL in .env.local or the environment, ` +
        "or set ACEVA_LOCAL_DB=1 (development only) to use the embedded .local-db/ database, then re-run.",
    );
    process.exit(1);
  }

  const sql = getSql();
  const isLocal = typeof (sql as { close?: unknown }).close === "function";
  console.log(`${TAG} target: ${isLocal ? "embedded database (.local-db/)" : "Neon (DATABASE_URL)"}`);

  try {
    await ensureAdminTables();
    await ensureDocumentTables();

    const present = await listPresentTables(sql);
    const missing = EXPECTED_TABLES.filter((name) => !present.has(name));
    for (const name of EXPECTED_TABLES) {
      console.log(`${TAG}   ${present.has(name) ? "ok     " : "MISSING"} ${name}`);
    }
    if (missing.length > 0) {
      console.error(`${TAG} ${missing.length} table(s) are missing after migration: ${missing.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`${TAG} all ${EXPECTED_TABLES.length} tables are present.`);
  } finally {
    await closeIfLocal(sql);
  }
}

main().catch((error: unknown) => {
  console.error(`${TAG} failed:`, error instanceof Error ? error.message : error);
  process.exit(1);
});
