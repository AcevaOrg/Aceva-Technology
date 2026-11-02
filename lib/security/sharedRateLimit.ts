import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api/response";
import { DatabaseUnavailableError, getSql, sharedStoresEnabled, withTimeout } from "@/lib/pulse/db";

/**
 * Rate limits that hold across every server instance.
 *
 * `lib/rateLimit.ts` counts in a Map inside one process. On Vercel each
 * concurrent instance has its own Map, so the real limit is the configured one
 * times however many instances are warm, and it resets whenever one is
 * recycled. The Pulse routes that touch saved leads or send email now count in
 * Postgres instead, with one atomic statement per hit:
 *
 *   INSERT ... ON CONFLICT (bucket) DO UPDATE SET hits = hits + 1 ... RETURNING hits
 *
 * Postgres serialises concurrent upserts on the same primary key, so two
 * requests can never both read "4 of 5" and both pass.
 *
 * Buckets are keyed by a SHA-256 of the dimension value, never the raw IP,
 * email or reference, and rows expire with their window.
 *
 * Store failure is handled per call site: "deny" refuses the request (the
 * routes that write leads or send email), "local" falls back to an in-process
 * counter at half the limit (the chat lookup, so an outage cannot take chat
 * down). Neither is unlimited.
 */

export type RateLimitDimension = "ip" | "session" | "email" | "pulse-id";

export interface RateLimitRule {
  dimension: RateLimitDimension;
  /** The raw value to bucket on. Skipped when empty. Hashed before storage. */
  value: string | undefined | null;
  limit: number;
  windowMs: number;
}

export type StoreFailurePolicy = "deny" | "local";

export interface RateLimitStore {
  /** Counts one hit in `bucket` for the window starting at `windowStart`; returns the count including it. */
  hit(bucket: string, windowStart: number, windowMs: number): Promise<number>;
}

// ---------------------------------------------------------------- stores

/** In-process store. Correct for one process; used outside production and in tests. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { windowStart: number; hits: number }>();

  async hit(bucket: string, windowStart: number): Promise<number> {
    const entry = this.buckets.get(bucket);
    if (!entry || entry.windowStart < windowStart) {
      this.buckets.set(bucket, { windowStart, hits: 1 });
      return 1;
    }
    entry.hits += 1;
    return entry.hits;
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const RATE_LIMIT_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS pulse_rate_limits (
    bucket       TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    hits         INTEGER NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL
  )`;

/** The atomic upsert. A hit from an older window never rewinds a newer one. */
export const RATE_LIMIT_UPSERT_SQL = `
  INSERT INTO pulse_rate_limits (bucket, window_start, hits, expires_at)
  VALUES ($1, $2, 1, $3)
  ON CONFLICT (bucket) DO UPDATE SET
    hits = CASE WHEN pulse_rate_limits.window_start >= EXCLUDED.window_start
                THEN pulse_rate_limits.hits + 1 ELSE 1 END,
    window_start = GREATEST(pulse_rate_limits.window_start, EXCLUDED.window_start),
    expires_at   = GREATEST(pulse_rate_limits.expires_at, EXCLUDED.expires_at)
  RETURNING hits`;

const RATE_LIMIT_TIMEOUT_MS = 2_000;

export class PostgresRateLimitStore implements RateLimitStore {
  private schemaReady: Promise<void> | null = null;

  private ensureTable(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = withTimeout(getSql().query(RATE_LIMIT_TABLE_DDL), "rate-limit DDL", RATE_LIMIT_TIMEOUT_MS)
        .then(() => undefined)
        .catch((error: unknown) => {
          this.schemaReady = null;
          throw error;
        });
    }
    return this.schemaReady;
  }

  async hit(bucket: string, windowStart: number, windowMs: number): Promise<number> {
    await this.ensureTable();
    const rows = (await withTimeout(
      getSql().query(RATE_LIMIT_UPSERT_SQL, [
        bucket,
        new Date(windowStart).toISOString(),
        new Date(windowStart + windowMs).toISOString(),
      ]),
      "rate-limit upsert",
      RATE_LIMIT_TIMEOUT_MS
    )) as { hits: number }[];

    // Expired rows are swept occasionally rather than on every hit.
    if (Math.random() < 0.01) {
      void getSql().query("DELETE FROM pulse_rate_limits WHERE expires_at < now()").catch(() => undefined);
    }

    const hits = Number(rows[0]?.hits);
    if (!Number.isFinite(hits)) throw new DatabaseUnavailableError("rate-limit upsert returned no count");
    return hits;
  }
}

let store: RateLimitStore | null = null;
const localFallback = new MemoryRateLimitStore();

function getStore(): RateLimitStore {
  if (!store) store = sharedStoresEnabled() ? new PostgresRateLimitStore() : new MemoryRateLimitStore();
  return store;
}

/** For tests: inject a store (e.g. one shared by two simulated instances), or reset. */
export function setRateLimitStoreForTests(next: RateLimitStore | null): void {
  store = next;
  localFallback.clear();
}

// ---------------------------------------------------------------- enforcement

function bucketFor(scope: string, rule: RateLimitRule): string {
  const digest = createHash("sha256").update(`${scope}\u0000${rule.dimension}\u0000${rule.value}`).digest("hex");
  return `${scope}:${rule.dimension}:${digest.slice(0, 40)}`;
}

/**
 * Counts one hit against every rule and throws RATE_LIMITED if any is over.
 * All rules are counted even after one trips, so a caller cannot dodge one
 * dimension by staying under another.
 */
export async function enforceRateLimits(
  scope: string,
  rules: RateLimitRule[],
  options: { onStoreError: StoreFailurePolicy; now?: number }
): Promise<void> {
  const now = options.now ?? Date.now();
  let retryAfter = 0;

  for (const rule of rules) {
    if (!rule.value) continue;
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    const bucket = bucketFor(scope, rule);

    let hits: number;
    try {
      hits = await getStore().hit(bucket, windowStart, rule.windowMs);
    } catch (error: unknown) {
      if (options.onStoreError === "deny") {
        console.error(`[rate-limit] shared store unavailable; refusing ${scope}`, {
          reason: error instanceof Error ? error.message : "unknown error",
        });
        throw new ApiError(
          "SERVICE_UNAVAILABLE",
          { message: "This is temporarily unavailable. Please try again in a few minutes." },
          { scope, reason: "rate-limit-store-unavailable" }
        );
      }
      console.warn(`[rate-limit] shared store unavailable; using a stricter local limit for ${scope}`);
      hits = await localFallback.hit(bucket, windowStart);
      if (hits > Math.max(1, Math.floor(rule.limit / 2))) {
        retryAfter = Math.max(retryAfter, Math.ceil((windowStart + rule.windowMs - now) / 1000));
      }
      continue;
    }

    if (hits > rule.limit) {
      retryAfter = Math.max(retryAfter, Math.ceil((windowStart + rule.windowMs - now) / 1000));
    }
  }

  if (retryAfter > 0) {
    throw new ApiError("RATE_LIMITED", { retryAfter }, { scope });
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
