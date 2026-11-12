import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "@/lib/pulse/env";

/**
 * Shared Postgres access for the admin console and the document registry.
 *
 * `lib/pulse/directionStore.ts` keeps its own private client and is intentionally left
 * alone; everything added for /admin, /documents and /verify goes through this module so
 * there is exactly one place to swap the driver (tests inject an in-memory Postgres here).
 *
 * Three backends, chosen in this order:
 *   1. an injected client (unit tests),
 *   2. an embedded PGlite database under `.local-db/` (ACEVA_LOCAL_DB=1, never in production),
 *   3. Neon over HTTP (DATABASE_URL).
 */

export type SqlRow = Record<string, unknown>;

/** A tagged-template query function: sql`SELECT ${value}` → rows. */
export type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

/** The local client can also be closed, which the tests use to prove the data really persists. */
export type LocalSqlClient = SqlClient & { close: () => Promise<void> };

let neonClient: SqlClient | null = null;
let injected: SqlClient | null = null;
let warnedAboutProductionLocalDb = false;

/** Where the embedded database lives, relative to the repo root. Git-ignored. */
export const LOCAL_DB_DIRECTORY = ".local-db";

const LOCAL_CLIENT_GLOBAL_KEY = "__acevaLocalSqlClient";

/**
 * True when the embedded database was asked for AND is allowed.
 *
 * It is refused in production on purpose: a serverless filesystem is read-only/ephemeral, so
 * "working" there would silently lose every record. The warning is printed once so a
 * misconfigured deployment is noticed without flooding the log.
 */
function localDatabaseEnabled(): boolean {
  if (process.env.ACEVA_LOCAL_DB !== "1") return false;
  if (process.env.NODE_ENV === "production") {
    if (!warnedAboutProductionLocalDb) {
      warnedAboutProductionLocalDb = true;
      console.warn("ACEVA_LOCAL_DB=1 is ignored in production; using DATABASE_URL instead.");
    }
    return false;
  }
  return true;
}

/** True when a database can be reached. Pages use it to render a setup notice instead of crashing. */
export function isDatabaseConfigured(): boolean {
  return injected !== null || localDatabaseEnabled() || Boolean(getDatabaseUrl());
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set — the document registry is unavailable.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function getSql(): SqlClient {
  if (injected) return injected;
  if (localDatabaseEnabled()) return getLocalSqlClient();
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new DatabaseNotConfiguredError();
  if (!neonClient) neonClient = neon(connectionString) as unknown as SqlClient;
  return neonClient;
}

/** Test seam: route every query through `client` (e.g. an embedded Postgres), or pass null to restore. */
export function setSqlClientForTests(client: SqlClient | null): void {
  injected = client;
}

/* ------------------------------------------------------------------ *
 * Embedded development database (PGlite)                              *
 * ------------------------------------------------------------------ */

/** The slice of PGlite this module relies on, so the package stays a lazily-loaded dev dependency. */
interface LocalDatabase {
  query(text: string, params?: unknown[]): Promise<{ rows: SqlRow[] }>;
  close(): Promise<void>;
}

interface PgliteModule {
  PGlite: new (dataDir?: string) => LocalDatabase & { waitReady: Promise<void> };
}

/** Turns the tagged-template pieces into numbered `$n` placeholders, exactly as Neon's driver does. */
function toQueryText(strings: TemplateStringsArray, valueCount: number): string {
  let text = strings[0];
  for (let i = 0; i < valueCount; i += 1) text += `$${i + 1}${strings[i + 1]}`;
  return text;
}

async function openLocalDatabase(dataDir: string): Promise<LocalDatabase> {
  // A variable specifier keeps the bundlers from following the import: PGlite ships megabytes of
  // WASM that must never be traced into a production function, and this path never runs there.
  const specifier = "@electric-sql/pglite";
  const { PGlite } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier)) as PgliteModule;
  if (!dataDir.includes("://")) fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  return db;
}

/**
 * A client backed by an embedded Postgres, with the same contract as `getSql()`.
 *
 * The database opens lazily on the first query, so merely calling `getSql()` is free. PGlite is a
 * single connection, so every query is serialised through one promise chain; a failed query never
 * poisons the chain for the next one, and a failed open is retried on the next query.
 */
export function createLocalSqlClient(options: { dataDir?: string } = {}): LocalSqlClient {
  const dataDir = options.dataDir ?? path.join(process.cwd(), LOCAL_DB_DIRECTORY);
  let opening: Promise<LocalDatabase> | null = null;
  let tail: Promise<unknown> = Promise.resolve();

  const open = (): Promise<LocalDatabase> => {
    if (!opening) {
      opening = openLocalDatabase(dataDir).catch((error: unknown) => {
        opening = null;
        throw error;
      });
    }
    return opening;
  };

  const client = ((strings: TemplateStringsArray, ...values: unknown[]): Promise<SqlRow[]> => {
    const text = toQueryText(strings, values.length);
    const run = tail.then(async () => {
      const db = await open();
      const result = await db.query(text, values);
      return result.rows;
    });
    tail = run.catch(() => undefined);
    return run;
  }) as LocalSqlClient;

  client.close = async () => {
    await tail;
    const pending = opening;
    opening = null;
    if (!pending) return;
    const db = await pending.catch(() => null);
    await db?.close();
  };

  return client;
}

/** One client per process: Next's dev server re-evaluates modules on every edit but keeps `globalThis`. */
function getLocalSqlClient(): SqlClient {
  const store = globalThis as unknown as Record<string, LocalSqlClient | undefined>;
  if (!store[LOCAL_CLIENT_GLOBAL_KEY]) store[LOCAL_CLIENT_GLOBAL_KEY] = createLocalSqlClient();
  return store[LOCAL_CLIENT_GLOBAL_KEY];
}
