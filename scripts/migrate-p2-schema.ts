/**
 * Schema changes needed before the P1/P2 code is deployed. PREPARED 30 October
 * 2026; NOT RUN. Additive only: two new tables and one new index. No row is
 * read, changed or deleted, apart from a duplicate count.
 *
 *   npx tsx scripts/migrate-p2-schema.ts            dry run: checks, prints the plan
 *   npx tsx scripts/migrate-p2-schema.ts --execute  applies it
 *
 * Connects through lib/pulse/db.ts, so the database target guard applies: set
 * PULSE_DB_ENDPOINT (and PULSE_DB_PRODUCTION_ENDPOINT), and for production from
 * a workstation PULSE_DB_ALLOW_PRODUCTION=1. Run it on a backup branch first.
 */
import { getSql, withTimeout } from "../lib/pulse/db";
import { RATE_LIMIT_TABLE_DDL } from "../lib/security/sharedRateLimit";
import { VERIFICATION_TABLE_DDL } from "../lib/pulse/emailVerification";
import { ensureChatTurnsTable } from "../lib/pulse/turnLog";

/** One row per request. CONCURRENTLY so live inserts are not blocked while it builds. */
const CHAT_TURNS_UNIQUE_REQUEST =
  "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS chat_turns_request_id_key ON chat_turns (request_id)";

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const sql = getSql();

  // The dry run must not change the schema, so it only checks whether
  // chat_turns exists; the table is created below, and only with --execute.
  const [table] = (await withTimeout(
    sql.query("SELECT to_regclass('public.chat_turns') IS NOT NULL AS present"),
    "chat_turns check",
    30_000
  )) as { present: boolean }[];
  let duplicateRows = 0;
  if (table.present) {
    const [dupes] = (await withTimeout(
      sql.query("SELECT (count(*) - count(DISTINCT request_id))::int AS duplicate_rows FROM chat_turns"),
      "duplicate check",
      30_000
    )) as { duplicate_rows: number }[];
    duplicateRows = dupes.duplicate_rows;
  }

  const steps = [
    ...(table.present ? [] : ["create table chat_turns (absent)"]),
    "create table pulse_rate_limits if absent",
    "create table pulse_email_verifications if absent",
    duplicateRows === 0
      ? "create unique index chat_turns_request_id_key if absent"
      : `SKIP unique index: ${duplicateRows} duplicate chat_turns rows need review first`,
  ];
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", steps }, null, 2));
  if (!execute) return;

  if (!table.present) await ensureChatTurnsTable();
  await withTimeout(sql.query(RATE_LIMIT_TABLE_DDL), "rate-limit DDL", 30_000);
  await withTimeout(sql.query(VERIFICATION_TABLE_DDL), "verification DDL", 30_000);
  if (duplicateRows === 0) await withTimeout(sql.query(CHAT_TURNS_UNIQUE_REQUEST), "unique index", 120_000);
  console.log("[migrate-p2-schema] applied.");
}

main().catch((error: unknown) => {
  console.error("[migrate-p2-schema] failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
