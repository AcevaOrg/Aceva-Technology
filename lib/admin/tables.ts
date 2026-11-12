import { getSql, type SqlClient } from "@/lib/db";

/**
 * Tables owned by the admin gate: the persistent login throttle and the audit trail.
 *
 * Mirrors `ensureDirectionsTable` in lib/pulse/directionStore.ts: the DDL runs once per process,
 * the resolved promise is cached, and a rejection is deliberately NOT cached so the next caller
 * retries instead of inheriting a permanently broken store.
 *
 * The cache is keyed by the SQL client it ran on. Production has exactly one client, so this costs
 * nothing there; it lets a test swap in a fresh in-memory database without a reset hook.
 */

let cached: { sql: SqlClient; promise: Promise<void> } | null = null;

async function createTables(sql: SqlClient): Promise<void> {
  // One statement per call: Neon's HTTP endpoint rejects multi-statement text that carries parameters.
  await sql`
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      ip_hash          text PRIMARY KEY,
      failures         int NOT NULL DEFAULT 0,
      first_failure_at timestamptz,
      locked_until     timestamptz,
      lock_count       int NOT NULL DEFAULT 0,
      updated_at       timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id          bigserial PRIMARY KEY,
      at          timestamptz NOT NULL DEFAULT now(),
      action      text NOT NULL,
      entity_type text,
      entity_id   text,
      actor       text NOT NULL DEFAULT '',
      detail      jsonb
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS admin_audit_log_at_idx ON admin_audit_log (at DESC)`;
}

export async function ensureAdminTables(): Promise<void> {
  const sql = getSql();
  if (!cached || cached.sql !== sql) {
    const promise: Promise<void> = createTables(sql).catch((error: unknown) => {
      if (cached?.promise === promise) cached = null;
      throw error;
    });
    cached = { sql, promise };
  }
  return cached.promise;
}

/** A query that has not answered by now is treated as an outage rather than stalling a request. */
export const DATABASE_TIMEOUT_MS = 4_000;

/**
 * Rejects if `work` takes longer than the timeout. Sign-in and the audit trail sit on the login
 * path, and a hung database connection must not hang the login form with it. The abandoned query
 * may still finish in the background, which is harmless for these idempotent writes.
 */
export async function withDatabaseTimeout<T>(work: Promise<T>, ms: number = DATABASE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TimeoutError")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
