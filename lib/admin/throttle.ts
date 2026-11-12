import { getSql } from "@/lib/db";
import { ensureAdminTables, withDatabaseTimeout } from "@/lib/admin/tables";

/**
 * Persistent brute-force defence for the pass-key form, layered under the per-minute in-process
 * limiter in lib/rateLimit.ts.
 *
 * That limiter lives in one serverless instance's memory and resets on every cold start, so on its
 * own it only slows an attacker down. This one is stored in Postgres, so the lockout holds across
 * instances and deploys.
 *
 * Policy: 5 failures within 15 minutes lock that client out for 15 minutes. Each repeat lock
 * doubles (capped at 24 hours) until a successful sign-in clears the record.
 *
 * If the database is unreachable the same policy runs from an in-process Map. An outage must
 * neither lock the owner out forever nor quietly switch the throttle off.
 */

export const LOGIN_POLICY = {
  maxFailures: 5,
  windowSeconds: 15 * 60,
  baseLockSeconds: 15 * 60,
  maxLockSeconds: 24 * 60 * 60,
} as const;

/** Past this many doublings the cap has long since been reached; also keeps power(2, n) finite. */
const MAX_DOUBLINGS = 20;
const MEMORY_MAX_ENTRIES = 5_000;

export type LoginGate = { allowed: true } | { allowed: false; retryAfter: number };
export interface LoginFailureOutcome {
  locked: boolean;
  retryAfter: number;
}

/* ------------------------------------------------------------------ *
 * Policy (pure) — also the in-memory fallback                          *
 * ------------------------------------------------------------------ */

export interface AttemptState {
  failures: number;
  firstFailureAt: number | null;
  lockedUntil: number | null;
  lockCount: number;
}

/** Length in seconds of the next lock for a client that has already been locked `lockCount` times. */
export function lockDurationSeconds(lockCount: number): number {
  const doublings = Number.isFinite(lockCount) ? Math.min(Math.max(0, Math.floor(lockCount)), MAX_DOUBLINGS) : 0;
  return Math.min(LOGIN_POLICY.baseLockSeconds * 2 ** doublings, LOGIN_POLICY.maxLockSeconds);
}

/** Seconds left on a lock, or 0 when there is none. */
export function remainingLockSeconds(state: AttemptState | undefined, now: number): number {
  if (!state || state.lockedUntil === null || state.lockedUntil <= now) return 0;
  return Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
}

/**
 * Applies one failed attempt. The SQL in `recordLoginFailure` implements the same transitions;
 * keep the two in step.
 */
export function applyLoginFailure(
  state: AttemptState | undefined,
  now: number,
): { state: AttemptState; locked: boolean; retryAfter: number } {
  const current: AttemptState = state ?? { failures: 0, firstFailureAt: null, lockedUntil: null, lockCount: 0 };

  // Already locked: attempts that raced past the gate must not stretch or compound the lock.
  if (remainingLockSeconds(current, now) > 0) {
    return { state: current, locked: true, retryAfter: remainingLockSeconds(current, now) };
  }

  const windowOpen = current.firstFailureAt !== null && current.firstFailureAt > now - LOGIN_POLICY.windowSeconds * 1000;
  const failures = windowOpen ? current.failures + 1 : 1;
  const firstFailureAt = windowOpen ? current.firstFailureAt : now;

  if (failures >= LOGIN_POLICY.maxFailures) {
    const lockedUntil = now + lockDurationSeconds(current.lockCount) * 1000;
    return {
      state: { failures: 0, firstFailureAt: null, lockedUntil, lockCount: current.lockCount + 1 },
      locked: true,
      retryAfter: Math.ceil((lockedUntil - now) / 1000),
    };
  }

  return {
    state: { failures, firstFailureAt, lockedUntil: current.lockedUntil, lockCount: current.lockCount },
    locked: false,
    retryAfter: 0,
  };
}

/* ------------------------------------------------------------------ *
 * In-process fallback                                                  *
 * ------------------------------------------------------------------ */

const memory = new Map<string, AttemptState>();
let outageLogged = false;

function pruneMemory(now: number): void {
  if (memory.size <= MEMORY_MAX_ENTRIES) return;
  for (const [key, state] of memory) {
    const windowOpen = state.firstFailureAt !== null && state.firstFailureAt > now - LOGIN_POLICY.windowSeconds * 1000;
    if (!windowOpen && remainingLockSeconds(state, now) === 0) memory.delete(key);
  }
  // Still full of live entries (a flood of distinct addresses): drop the oldest rather than grow.
  for (const key of memory.keys()) {
    if (memory.size <= MEMORY_MAX_ENTRIES) break;
    memory.delete(key);
  }
}

/** Test seam: forget every in-process record and the "already logged" flag. */
export function resetLoginThrottleMemory(): void {
  memory.clear();
  outageLogged = false;
}

function noteDatabaseUnavailable(error: unknown): void {
  if (outageLogged) return;
  outageLogged = true;
  // The error name only: driver messages can echo the connection string or host.
  const reason = error instanceof Error ? error.name : typeof error;
  console.warn(`[admin-throttle] database unavailable (${reason}); using the in-process login lockout instead`);
}

/* ------------------------------------------------------------------ *
 * Public API                                                           *
 * ------------------------------------------------------------------ */

/** Whether this client may attempt a sign-in right now. Never throws. */
export async function checkLoginAllowed(ipHash: string): Promise<LoginGate> {
  // A lock recorded in memory during an outage still applies once the database is back.
  const memoryRetry = remainingLockSeconds(memory.get(ipHash), Date.now());
  if (memoryRetry > 0) return { allowed: false, retryAfter: memoryRetry };

  try {
    const rows = await withDatabaseTimeout(
      (async () => {
        await ensureAdminTables();
        return getSql()`
          SELECT GREATEST(CEIL(EXTRACT(EPOCH FROM (locked_until - now())))::int, 1) AS retry_after
          FROM admin_login_attempts
          WHERE ip_hash = ${ipHash} AND locked_until IS NOT NULL AND locked_until > now()
        `;
      })(),
    );
    if (rows.length === 0) return { allowed: true };
    return { allowed: false, retryAfter: Math.max(1, Number(rows[0].retry_after) || 1) };
  } catch (error) {
    noteDatabaseUnavailable(error);
    return { allowed: true };
  }
}

/**
 * Counts one failed sign-in. One atomic upsert, so concurrent failures cannot overwrite each
 * other's count. `trips` (not already locked, window still open, this failure is the Nth) is
 * spelled out in each assignment because every right-hand side sees the row as it was before.
 */
export async function recordLoginFailure(ipHash: string): Promise<LoginFailureOutcome> {
  try {
    const rows = await withDatabaseTimeout(
      (async () => {
        await ensureAdminTables();
        const { maxFailures, windowSeconds, baseLockSeconds, maxLockSeconds } = LOGIN_POLICY;
        return getSql()`
          INSERT INTO admin_login_attempts AS a (ip_hash, failures, first_failure_at, updated_at)
          VALUES (${ipHash}, 1, now(), now())
          ON CONFLICT (ip_hash) DO UPDATE SET
            failures = CASE
              WHEN a.locked_until IS NOT NULL AND a.locked_until > now() THEN a.failures
              WHEN a.first_failure_at IS NOT NULL AND a.first_failure_at > now() - make_interval(secs => ${windowSeconds}::double precision)
                THEN CASE WHEN a.failures + 1 >= ${maxFailures}::int THEN 0 ELSE a.failures + 1 END
              ELSE 1
            END,
            first_failure_at = CASE
              WHEN a.locked_until IS NOT NULL AND a.locked_until > now() THEN a.first_failure_at
              WHEN a.first_failure_at IS NOT NULL AND a.first_failure_at > now() - make_interval(secs => ${windowSeconds}::double precision)
                THEN CASE WHEN a.failures + 1 >= ${maxFailures}::int THEN NULL ELSE a.first_failure_at END
              ELSE now()
            END,
            locked_until = CASE
              WHEN (a.locked_until IS NULL OR a.locked_until <= now())
                AND a.first_failure_at IS NOT NULL
                AND a.first_failure_at > now() - make_interval(secs => ${windowSeconds}::double precision)
                AND a.failures + 1 >= ${maxFailures}::int
                THEN now() + make_interval(secs => LEAST(
                  ${baseLockSeconds}::double precision * power(2, LEAST(a.lock_count, ${MAX_DOUBLINGS}::int)),
                  ${maxLockSeconds}::double precision))
              ELSE a.locked_until
            END,
            lock_count = CASE
              WHEN (a.locked_until IS NULL OR a.locked_until <= now())
                AND a.first_failure_at IS NOT NULL
                AND a.first_failure_at > now() - make_interval(secs => ${windowSeconds}::double precision)
                AND a.failures + 1 >= ${maxFailures}::int
                THEN a.lock_count + 1
              ELSE a.lock_count
            END,
            updated_at = now()
          RETURNING
            (locked_until IS NOT NULL AND locked_until > now()) AS locked,
            COALESCE(GREATEST(CEIL(EXTRACT(EPOCH FROM (locked_until - now())))::int, 0), 0) AS retry_after
        `;
      })(),
    );

    // Housekeeping, not correctness: drop long-quiet records so the table does not grow forever.
    if (Math.random() < 0.02) {
      void getSql()`
        DELETE FROM admin_login_attempts
        WHERE updated_at < now() - interval '30 days' AND (locked_until IS NULL OR locked_until < now())
      `.catch(() => undefined);
    }

    const row = rows[0];
    const locked = row?.locked === true;
    return { locked, retryAfter: locked ? Math.max(1, Number(row.retry_after) || 1) : 0 };
  } catch (error) {
    noteDatabaseUnavailable(error);
    const now = Date.now();
    const outcome = applyLoginFailure(memory.get(ipHash), now);
    memory.set(ipHash, outcome.state);
    pruneMemory(now);
    return { locked: outcome.locked, retryAfter: outcome.retryAfter };
  }
}

/** Clears this client's record after a successful sign-in. Never throws. */
export async function recordLoginSuccess(ipHash: string): Promise<void> {
  memory.delete(ipHash);
  try {
    await withDatabaseTimeout(
      (async () => {
        await ensureAdminTables();
        await getSql()`DELETE FROM admin_login_attempts WHERE ip_hash = ${ipHash}`;
      })(),
    );
  } catch (error) {
    noteDatabaseUnavailable(error);
  }
}

/* ------------------------------------------------------------------ *
 * Failure delay                                                        *
 * ------------------------------------------------------------------ */

const FAILURE_DELAY_MIN_MS = 350;
const FAILURE_DELAY_MAX_MS = 750;

/** A random delay in [350, 750] ms. `random` is injectable for tests; it must return [0, 1). */
export function randomFailureDelayMs(random: () => number = defaultRandom): number {
  return FAILURE_DELAY_MIN_MS + Math.floor(random() * (FAILURE_DELAY_MAX_MS - FAILURE_DELAY_MIN_MS + 1));
}

function defaultRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

let delayOverride: (() => Promise<void>) | null = null;

/**
 * Pauses after a rejected pass key. The jitter blurs response timing and adds a floor to the
 * cost of each guess even when the persistent lockout has not yet triggered.
 */
export function waitAfterLoginFailure(): Promise<void> {
  if (delayOverride) return delayOverride();
  return new Promise((resolve) => setTimeout(resolve, randomFailureDelayMs()));
}

/** Test seam: replace the failure delay (pass null to restore the real one). */
export function setLoginFailureDelayForTests(delay: (() => Promise<void>) | null): void {
  delayOverride = delay;
}
