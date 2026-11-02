import { createHash, randomBytes } from "node:crypto";
import { DatabaseUnavailableError, getSql, sharedStoresEnabled, withTimeout } from "./db";

/**
 * Single-use email ownership tokens for the blueprint email.
 *
 * Only the address a direction was saved with can receive its blueprint, and
 * only after the person at that address clicks a link sent to it. The link
 * carries a 256-bit random token; the database stores only its SHA-256, so a
 * leaked table cannot be replayed. Redemption is a single conditional UPDATE
 *
 *   UPDATE ... SET used_at = now()
 *   WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
 *   RETURNING pulse_id
 *
 * so of two concurrent clicks exactly one gets a row back. A new request for
 * the same reference supersedes any earlier unused token, and a successful
 * redemption invalidates every other outstanding token for that reference.
 * Tokens are never logged; nothing about the email address is stored here.
 */

/** 32 random bytes as unpadded base64url: always 43 characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Link lifetime in minutes. PULSE_VERIFY_TOKEN_TTL_MINUTES, clamped to 5–60, default 30. */
export function verificationTtlMinutes(): number {
  const raw = Number(process.env.PULSE_VERIFY_TOKEN_TTL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(60, Math.max(5, Math.floor(raw)));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newVerificationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export interface VerificationStore {
  /** Stores a new token for `pulseId`, superseding any unused earlier one. */
  create(tokenHash: string, pulseId: string, expiresAt: Date): Promise<void>;
  /** Atomically consumes a live token. Returns its reference, or null if unknown, used or expired. */
  redeem(tokenHash: string, now: Date): Promise<string | null>;
}

// ---------------------------------------------------------------- stores

export class MemoryVerificationStore implements VerificationStore {
  readonly rows = new Map<string, { pulseId: string; expiresAt: number; usedAt: number | null }>();

  async create(tokenHash: string, pulseId: string, expiresAt: Date): Promise<void> {
    const now = Date.now();
    for (const row of this.rows.values()) {
      if (row.pulseId === pulseId && row.usedAt === null) row.usedAt = now;
    }
    this.rows.set(tokenHash, { pulseId, expiresAt: expiresAt.getTime(), usedAt: null });
  }

  async redeem(tokenHash: string, now: Date): Promise<string | null> {
    // Synchronous between read and write, so concurrent calls cannot both win.
    const row = this.rows.get(tokenHash);
    if (!row || row.usedAt !== null || row.expiresAt <= now.getTime()) return null;
    row.usedAt = now.getTime();
    for (const other of this.rows.values()) {
      if (other.pulseId === row.pulseId && other.usedAt === null) other.usedAt = now.getTime();
    }
    return row.pulseId;
  }
}

export const VERIFICATION_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS pulse_email_verifications (
    token_hash TEXT PRIMARY KEY,
    pulse_id   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ
  )`;

export const SUPERSEDE_SQL = `
  UPDATE pulse_email_verifications SET used_at = now()
  WHERE pulse_id = $1 AND used_at IS NULL`;

export const INSERT_TOKEN_SQL = `
  INSERT INTO pulse_email_verifications (token_hash, pulse_id, expires_at)
  VALUES ($1, $2, $3)`;

export const REDEEM_SQL = `
  UPDATE pulse_email_verifications SET used_at = $2
  WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
  RETURNING pulse_id`;

export class PostgresVerificationStore implements VerificationStore {
  private schemaReady: Promise<void> | null = null;

  private ensureTable(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = withTimeout(getSql().query(VERIFICATION_TABLE_DDL), "verification DDL")
        .then(() => undefined)
        .catch((error: unknown) => {
          this.schemaReady = null;
          throw error;
        });
    }
    return this.schemaReady;
  }

  async create(tokenHash: string, pulseId: string, expiresAt: Date): Promise<void> {
    await this.ensureTable();
    const sql = getSql();
    await withTimeout(
      sql.transaction([sql.query(SUPERSEDE_SQL, [pulseId]), sql.query(INSERT_TOKEN_SQL, [tokenHash, pulseId, expiresAt.toISOString()])]),
      "verification create"
    );
  }

  async redeem(tokenHash: string, now: Date): Promise<string | null> {
    await this.ensureTable();
    const rows = (await withTimeout(
      getSql().query(REDEEM_SQL, [tokenHash, now.toISOString()]),
      "verification redeem"
    )) as { pulse_id: string }[];
    const pulseId = rows[0]?.pulse_id ?? null;
    if (pulseId) {
      await withTimeout(getSql().query(SUPERSEDE_SQL, [pulseId]), "verification invalidate").catch((error: unknown) => {
        // The redeemed token is already spent; siblings expire on their own.
        console.warn("[verification] could not invalidate sibling tokens", {
          reason: error instanceof DatabaseUnavailableError ? error.message : "unknown error",
        });
      });
    }
    return pulseId;
  }
}

let store: VerificationStore | null = null;

export function getVerificationStore(): VerificationStore {
  if (!store) store = sharedStoresEnabled() ? new PostgresVerificationStore() : new MemoryVerificationStore();
  return store;
}

/** For tests: inject a store, or reset to the default. */
export function setVerificationStoreForTests(next: VerificationStore | null): void {
  store = next;
}
