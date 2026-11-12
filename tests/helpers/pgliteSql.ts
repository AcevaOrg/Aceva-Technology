import { PGlite } from "@electric-sql/pglite";
import type { SqlClient, SqlRow } from "@/lib/db";

/**
 * An in-memory Postgres that speaks the same tagged-template contract as `getSql()`, so the
 * real SQL in lib/documents and lib/admin runs against a real engine in unit tests — no
 * network, no Neon branch. Inject it with `setSqlClientForTests(sql)`.
 *
 * Mirrors the production driver's rules: ONE statement per call (Neon's HTTP endpoint rejects
 * multi-statement text that carries parameters), values travel as `$n` parameters, rows come
 * back as plain objects. Use a single-statement CTE when several writes must be atomic.
 */
export async function createPgliteSql(): Promise<{ sql: SqlClient; db: PGlite; close: () => Promise<void> }> {
  const db = new PGlite();
  await db.waitReady;
  const sql: SqlClient = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    const result = await db.query<SqlRow>(text, values as unknown[]);
    return result.rows;
  };
  return { sql, db, close: () => db.close() };
}
