import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPgliteSql } from "../helpers/pgliteSql";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { ensureAdminTables } from "@/lib/admin/tables";
import {
  LOGIN_POLICY,
  applyLoginFailure,
  checkLoginAllowed,
  lockDurationSeconds,
  randomFailureDelayMs,
  recordLoginFailure,
  recordLoginSuccess,
  remainingLockSeconds,
  resetLoginThrottleMemory,
  setLoginFailureDelayForTests,
  waitAfterLoginFailure,
  type AttemptState,
} from "@/lib/admin/throttle";

const IP = "a1b2c3d4e5f60718";
const OTHER_IP = "0123456789abcdef";

describe("lock policy (pure)", () => {
  it("doubles from 15 minutes and caps at 24 hours", () => {
    expect(lockDurationSeconds(0)).toBe(15 * 60);
    expect(lockDurationSeconds(1)).toBe(30 * 60);
    expect(lockDurationSeconds(2)).toBe(60 * 60);
    expect(lockDurationSeconds(3)).toBe(2 * 3600);
    expect(lockDurationSeconds(5)).toBe(8 * 3600);
    expect(lockDurationSeconds(6)).toBe(16 * 3600);
    expect(lockDurationSeconds(7)).toBe(24 * 3600);
    expect(lockDurationSeconds(8)).toBe(24 * 3600);
    expect(lockDurationSeconds(10_000)).toBe(24 * 3600);
    expect(lockDurationSeconds(-3)).toBe(15 * 60);
    expect(lockDurationSeconds(Number.NaN)).toBe(15 * 60);
  });

  it("locks on the fifth failure inside the window, not before", () => {
    const now = 1_000_000;
    let state: AttemptState | undefined;
    for (let i = 1; i <= 4; i += 1) {
      const step = applyLoginFailure(state, now + i * 1000);
      expect(step.locked, `failure ${i}`).toBe(false);
      state = step.state;
    }
    const fifth = applyLoginFailure(state, now + 5000);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfter).toBe(LOGIN_POLICY.baseLockSeconds);
    expect(fifth.state).toMatchObject({ failures: 0, firstFailureAt: null, lockCount: 1 });
    expect(remainingLockSeconds(fifth.state, now + 5000)).toBe(900);
    expect(remainingLockSeconds(fifth.state, now + 5000 + 900_000)).toBe(0);
  });

  it("starts a new window once the old one is 15 minutes old", () => {
    const now = 1_000_000;
    let state: AttemptState | undefined;
    for (let i = 0; i < 4; i += 1) state = applyLoginFailure(state, now + i).state;
    const later = applyLoginFailure(state, now + 15 * 60 * 1000 + 10);
    expect(later.locked).toBe(false);
    expect(later.state.failures).toBe(1);
  });

  it("does not stretch or compound an active lock", () => {
    const now = 1_000_000;
    let state: AttemptState | undefined;
    for (let i = 0; i < 5; i += 1) state = applyLoginFailure(state, now).state;
    const locked = state as AttemptState;
    const again = applyLoginFailure(locked, now + 60_000);
    expect(again.locked).toBe(true);
    expect(again.state).toBe(locked);
    expect(again.retryAfter).toBe(840);
  });

  it("doubles the next lock", () => {
    const now = 1_000_000;
    let state: AttemptState | undefined;
    for (let i = 0; i < 5; i += 1) state = applyLoginFailure(state, now).state;
    const afterFirstLock = now + 900_000 + 1;
    for (let i = 0; i < 5; i += 1) state = applyLoginFailure(state, afterFirstLock).state;
    expect(remainingLockSeconds(state, afterFirstLock)).toBe(1800);
    expect(state?.lockCount).toBe(2);
  });
});

describe("failure delay", () => {
  afterEach(() => {
    vi.useRealTimers();
    setLoginFailureDelayForTests(null);
  });

  it("is always between 350 and 750 ms", () => {
    expect(randomFailureDelayMs(() => 0)).toBe(350);
    expect(randomFailureDelayMs(() => 0.9999999)).toBe(750);
    expect(randomFailureDelayMs(() => 0.5)).toBe(550);
    for (let i = 0; i < 500; i += 1) {
      const delay = randomFailureDelayMs();
      expect(delay).toBeGreaterThanOrEqual(350);
      expect(delay).toBeLessThanOrEqual(750);
    }
  });

  it("actually waits at least 350 ms before resolving", async () => {
    vi.useFakeTimers();
    let done = false;
    const wait = waitAfterLoginFailure().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(349);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(401);
    await wait;
    expect(done).toBe(true);
  });

  it("can be replaced for tests and restored", async () => {
    const stub = vi.fn(async () => undefined);
    setLoginFailureDelayForTests(stub);
    await waitAfterLoginFailure();
    expect(stub).toHaveBeenCalledOnce();
  });
});

describe("persistent throttle (Postgres)", () => {
  let db: PGlite;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const pg = await createPgliteSql();
    db = pg.db;
    close = pg.close;
    setSqlClientForTests(pg.sql);
    await ensureAdminTables();
  }, 30_000);

  afterAll(async () => {
    setSqlClientForTests(null);
    await close();
  });

  beforeEach(async () => {
    resetLoginThrottleMemory();
    await db.query("DELETE FROM admin_login_attempts");
  });

  async function fail(ip: string, times: number) {
    let last = { locked: false, retryAfter: 0 };
    for (let i = 0; i < times; i += 1) last = await recordLoginFailure(ip);
    return last;
  }

  async function row(ip: string) {
    const result = await db.query<{ failures: number; lock_count: number; locked: boolean; first_failure_at: string | null }>(
      "SELECT failures, lock_count, (locked_until IS NOT NULL AND locked_until > now()) AS locked, first_failure_at FROM admin_login_attempts WHERE ip_hash = $1",
      [ip],
    );
    return result.rows[0];
  }

  it("creates both tables and the audit index idempotently", async () => {
    await ensureAdminTables();
    await ensureAdminTables();
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_name IN ('admin_login_attempts', 'admin_audit_log') ORDER BY 1",
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(["admin_audit_log", "admin_login_attempts"]);
    const indexes = await db.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE tablename = 'admin_audit_log'");
    expect(indexes.rows.some((r) => /\(at DESC\)/.test(r.indexdef))).toBe(true);
  });

  it("allows an unknown client", async () => {
    expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
  });

  it("counts failures without locking until the fifth", async () => {
    for (let i = 1; i <= 4; i += 1) {
      expect(await recordLoginFailure(IP), `failure ${i}`).toEqual({ locked: false, retryAfter: 0 });
      expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
    }
    expect(await row(IP)).toMatchObject({ failures: 4, lock_count: 0, locked: false });
  });

  it("locks for 15 minutes on the fifth failure and reports the wait", async () => {
    const outcome = await fail(IP, 5);
    expect(outcome.locked).toBe(true);
    expect(outcome.retryAfter).toBeGreaterThan(890);
    expect(outcome.retryAfter).toBeLessThanOrEqual(900);

    const gate = await checkLoginAllowed(IP);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.retryAfter).toBeGreaterThan(890);
      expect(gate.retryAfter).toBeLessThanOrEqual(900);
    }
    expect(await row(IP)).toMatchObject({ failures: 0, lock_count: 1, locked: true, first_failure_at: null });
  });

  it("keeps clients apart", async () => {
    await fail(IP, 5);
    expect((await checkLoginAllowed(IP)).allowed).toBe(false);
    expect(await checkLoginAllowed(OTHER_IP)).toEqual({ allowed: true });
  });

  it("lets the client back in once the lock has expired, then doubles the next lock", async () => {
    await fail(IP, 5);
    await db.query("UPDATE admin_login_attempts SET locked_until = now() - interval '1 second' WHERE ip_hash = $1", [IP]);
    expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });

    // Failures after an expired lock start a fresh window, and the second lock is twice as long.
    expect((await fail(IP, 4)).locked).toBe(false);
    const second = await recordLoginFailure(IP);
    expect(second.locked).toBe(true);
    expect(second.retryAfter).toBeGreaterThan(1790);
    expect(second.retryAfter).toBeLessThanOrEqual(1800);
    expect(await row(IP)).toMatchObject({ lock_count: 2 });
  });

  it("caps the lock at 24 hours", async () => {
    await db.query(
      "INSERT INTO admin_login_attempts (ip_hash, failures, first_failure_at, lock_count) VALUES ($1, 4, now(), 40)",
      [IP],
    );
    const outcome = await recordLoginFailure(IP);
    expect(outcome.locked).toBe(true);
    expect(outcome.retryAfter).toBeGreaterThan(86_390);
    expect(outcome.retryAfter).toBeLessThanOrEqual(86_400);
  });

  it("forgets old failures: the window is 15 minutes", async () => {
    await fail(IP, 4);
    await db.query("UPDATE admin_login_attempts SET first_failure_at = now() - interval '16 minutes' WHERE ip_hash = $1", [IP]);
    expect(await recordLoginFailure(IP)).toEqual({ locked: false, retryAfter: 0 });
    expect(await row(IP)).toMatchObject({ failures: 1 });
  });

  it("does not stretch or compound a lock when a racing attempt fails during it", async () => {
    await fail(IP, 5);
    const before = await db.query<{ locked_until: string; lock_count: number }>(
      "SELECT locked_until::text, lock_count FROM admin_login_attempts WHERE ip_hash = $1",
      [IP],
    );
    const outcome = await fail(IP, 10);
    expect(outcome.locked).toBe(true);
    const after = await db.query<{ locked_until: string; lock_count: number }>(
      "SELECT locked_until::text, lock_count FROM admin_login_attempts WHERE ip_hash = $1",
      [IP],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("counts concurrent failures atomically", async () => {
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => recordLoginFailure(IP)));
    expect(outcomes.filter((o) => o.locked)).toHaveLength(1);
    expect(await row(IP)).toMatchObject({ lock_count: 1, locked: true });
  });

  it("success clears the record, including an active lock and the doubling", async () => {
    await fail(IP, 3);
    await recordLoginSuccess(IP);
    expect(await row(IP)).toBeUndefined();

    // After a success, 4 more failures do not lock: the earlier 3 no longer count.
    expect((await fail(IP, 4)).locked).toBe(false);

    await fail(IP, 1);
    expect((await checkLoginAllowed(IP)).allowed).toBe(false);
    await recordLoginSuccess(IP);
    expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
    // Back to a 15-minute first lock, not a doubled one.
    const outcome = await fail(IP, 5);
    expect(outcome.retryAfter).toBeLessThanOrEqual(900);
  });

  it("stores only the hash it is given", async () => {
    await fail(IP, 1);
    const all = await db.query("SELECT * FROM admin_login_attempts");
    expect(JSON.stringify(all.rows)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(all.rows).toHaveLength(1);
  });
});

describe("in-process fallback when the database is unavailable", () => {
  const broken: SqlClient = async () => {
    throw new Error("connection to postgresql://user:hunter2@ep-secret-host.neon.tech/db failed");
  };

  beforeEach(() => {
    resetLoginThrottleMemory();
    setSqlClientForTests(broken);
  });

  afterEach(() => {
    setSqlClientForTests(null);
    resetLoginThrottleMemory();
  });

  it("applies the same policy from memory", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
    for (let i = 1; i <= 4; i += 1) expect((await recordLoginFailure(IP)).locked, `failure ${i}`).toBe(false);
    const fifth = await recordLoginFailure(IP);
    expect(fifth).toEqual({ locked: true, retryAfter: 900 });

    const gate = await checkLoginAllowed(IP);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryAfter).toBeGreaterThan(890);
    expect(await checkLoginAllowed(OTHER_IP)).toEqual({ allowed: true });

    await recordLoginSuccess(IP);
    expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
  });

  it("logs the outage once and never prints the connection string", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await checkLoginAllowed(IP);
    await recordLoginFailure(IP);
    await recordLoginFailure(IP);
    await recordLoginSuccess(IP);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0].join(" "));
    expect(message).toContain("[admin-throttle]");
    expect(message).not.toMatch(/hunter2|postgresql:|neon\.tech|ep-secret/);
  });

  it("falls back when the database is not configured at all", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "");
    setSqlClientForTests(null);
    try {
      expect(await checkLoginAllowed(IP)).toEqual({ allowed: true });
      expect((await recordLoginFailure(IP)).locked).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps a lock recorded during the outage after the database recovers", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (let i = 0; i < 5; i += 1) await recordLoginFailure(IP);

    const pg = await createPgliteSql();
    try {
      setSqlClientForTests(pg.sql);
      const gate = await checkLoginAllowed(IP);
      expect(gate.allowed).toBe(false);
    } finally {
      setSqlClientForTests(broken);
      await pg.close();
    }
  }, 30_000);

  it("treats a hung database as an outage instead of stalling the login form", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      setSqlClientForTests(() => new Promise(() => undefined));
      const pending = checkLoginAllowed(IP);
      await vi.advanceTimersByTimeAsync(4_100);
      await expect(pending).resolves.toEqual({ allowed: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
