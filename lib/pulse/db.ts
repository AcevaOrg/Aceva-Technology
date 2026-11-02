import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getDatabaseUrl } from "./env";
import { checkDatabaseTarget } from "./dbTarget";

/**
 * Shared database plumbing for the security stores (rate limits, email
 * verification). The older stores keep their own clients; new code uses this.
 */

/** No query waits longer than this. The HTTP driver has no deadline of its own. */
export const DB_QUERY_TIMEOUT_MS = 5_000;

/**
 * The database could not be reached, timed out, or is not configured. Routes
 * turn it into a generic SERVICE_UNAVAILABLE; the message stays in the log.
 */
export class DatabaseUnavailableError extends Error {
  /** Short machine-readable cause, e.g. "target-refused:endpoint-unconfigured". Never holds a URL or data. */
  readonly reason: string;
  constructor(message: string, reason = "unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.reason = reason;
  }
}

/** A database failure tagged with the store operation that hit it ("prepare-table", "insert", ...). */
export class DatabaseOperationError extends Error {
  readonly operation: string;
  readonly original: unknown;
  constructor(operation: string, original: unknown) {
    super(`database operation "${operation}" failed`);
    this.name = "DatabaseOperationError";
    this.operation = operation;
    this.original = original;
  }
}

/** Runs one store step and tags any failure with its operation name. */
export async function tagOperation<T>(operation: string, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw error instanceof DatabaseOperationError ? error : new DatabaseOperationError(operation, error);
  }
}

/**
 * A log-safe description of a database failure: what kind of failure it was
 * and, for a query Postgres rejected, its SQLSTATE code (e.g. 42501 = permission
 * denied, 42P01 = missing table). Driver messages are deliberately left out:
 * Postgres can quote submitted values in them, and a connection error can name
 * the host. Our own DatabaseUnavailableError reasons carry neither.
 */
export function describeDatabaseError(
  failure: unknown
): { operation: string; category: string; code?: string; errorName: string } {
  const tagged = failure instanceof DatabaseOperationError;
  const operation = tagged ? failure.operation : "unknown";
  const error = tagged ? failure.original : failure;
  return { operation, ...describeUntagged(error) };
}

function describeUntagged(error: unknown): { category: string; code?: string; errorName: string } {
  const errorName = error instanceof Error ? error.name : typeof error;
  if (error instanceof DatabaseUnavailableError) return { category: error.reason, errorName };
  const code = (error as { code?: unknown } | null)?.code;
  if (errorName === "NeonDbError") {
    return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)
      ? { category: "query-rejected", code, errorName }
      : { category: "connection-failed", errorName };
  }
  if (error instanceof TypeError) return { category: "connection-failed", errorName };
  return { category: "unknown", errorName };
}

let client: NeonQueryFunction<false, false> | null = null;
let clientUrl = "";

/**
 * The one way Pulse code gets a database client. Every call re-checks that
 * the configured database is the one this deployment is approved to use (see
 * dbTarget.ts), so a preview or a laptop pointed at production refuses before
 * a single query rather than writing beside customer records.
 */
export function getSql(): NeonQueryFunction<false, false> {
  const url = getDatabaseUrl();
  if (!url) throw new DatabaseUnavailableError("DATABASE_URL is not set.", "not-configured");
  const target = checkDatabaseTarget(url);
  if (!target.ok) {
    throw new DatabaseUnavailableError(
      `Database target refused (${target.reason}) in the ${target.runtime} runtime.`,
      `target-refused:${target.reason}`
    );
  }
  if (!client || clientUrl !== url) {
    client = neon(url);
    clientUrl = url;
    // Once per process: proves which runtime accepted its database, for the
    // deployment checklist. The endpoint and host are deliberately left out.
    console.info("[db] database target accepted", { runtime: target.runtime });
  }
  return client;
}

/**
 * Bounds a query's latency. The request itself is not cancelled (the driver
 * takes no per-query signal through the tagged template), but the caller gets
 * a definite failure instead of hanging until the platform kills the function.
 */
export async function withTimeout<T>(query: PromiseLike<T>, label: string, ms = DB_QUERY_TIMEOUT_MS): Promise<T> {
  // The Neon driver's query object is lazy: it sends the query each time its
  // `then` is called. Attaching the catch below and then racing the same
  // object therefore ran every query twice. An insert landed on the first run
  // and returned no row on the second (ON CONFLICT DO NOTHING), so the save
  // route reported failure for a lead it had stored, and retried, storing
  // three. Adopting it into a real Promise calls `then` exactly once.
  const promise = Promise.resolve(query);
  // A late rejection after the timeout won must not become an unhandled one.
  promise.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DatabaseUnavailableError(`${label} timed out after ${ms}ms`, "timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True where the shared Postgres-backed stores should be used. Only a real
 * production runtime writes to them: `.env.local` points DATABASE_URL at the
 * production database, so a development or test run that used them would write
 * rate-limit rows and verification tokens there. Elsewhere an in-process store
 * is used, which is all a single dev server or test runner needs.
 * `PULSE_SHARED_STORES=postgres` forces the shared store for a deliberate check
 * against a non-production database.
 */
export function sharedStoresEnabled(): boolean {
  if (process.env.PULSE_SHARED_STORES === "postgres") return true;
  if (process.env.PULSE_SHARED_STORES === "memory") return false;
  // Tests stub NODE_ENV=production to exercise production rules; they must
  // still never reach the database `.env.local` points at.
  if (process.env.VITEST) return false;
  return process.env.NODE_ENV === "production";
}
