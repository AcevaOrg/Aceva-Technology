import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the P1 security modules (30 October 2026). Every database
 * call goes to an in-memory fake of the Neon driver that implements the same
 * SQL semantics the modules rely on; nothing reaches a real database, Cloudflare
 * or an email provider. All data is synthetic.
 */

// ------------------------------------------------------------ fake Neon driver
const fakeDb = vi.hoisted(() => {
  const state = {
    rateRows: new Map<string, { windowStart: number; hits: number; expiresAt: number }>(),
    tokenRows: new Map<string, { pulseId: string; expiresAt: number; usedAt: number | null }>(),
    statements: [] as string[],
    fail: false,
  };
  async function query(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    state.statements.push(text.replace(/\s+/g, " ").trim());
    // Yield first, as a network call would, so concurrent callers interleave.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (state.fail) throw new Error("neon: connection refused at 10.0.0.12:5432");
    if (/^\s*CREATE TABLE/i.test(text) || /^\s*DELETE FROM pulse_rate_limits/i.test(text)) return [];
    if (/INSERT INTO pulse_rate_limits/.test(text)) {
      const [bucket, windowStartIso, expiresIso] = params as string[];
      const windowStart = Date.parse(windowStartIso);
      const row = state.rateRows.get(bucket);
      if (!row) {
        state.rateRows.set(bucket, { windowStart, hits: 1, expiresAt: Date.parse(expiresIso) });
        return [{ hits: 1 }];
      }
      row.hits = row.windowStart >= windowStart ? row.hits + 1 : 1;
      row.windowStart = Math.max(row.windowStart, windowStart);
      row.expiresAt = Math.max(row.expiresAt, Date.parse(expiresIso));
      return [{ hits: row.hits }];
    }
    if (/^\s*UPDATE pulse_email_verifications SET used_at = now\(\)/.test(text)) {
      for (const row of state.tokenRows.values()) {
        if (row.pulseId === params[0] && row.usedAt === null) row.usedAt = Date.now();
      }
      return [];
    }
    if (/INSERT INTO pulse_email_verifications/.test(text)) {
      const [hash, pulseId, expiresIso] = params as string[];
      state.tokenRows.set(hash, { pulseId, expiresAt: Date.parse(expiresIso), usedAt: null });
      return [];
    }
    if (/UPDATE pulse_email_verifications SET used_at = \$2/.test(text)) {
      const [hash, nowIso] = params as string[];
      const now = Date.parse(nowIso);
      const row = state.tokenRows.get(hash);
      if (!row || row.usedAt !== null || row.expiresAt <= now) return [];
      row.usedAt = now;
      return [{ pulse_id: row.pulseId }];
    }
    throw new Error(`unexpected SQL in test: ${text}`);
  }
  const sql = {
    query,
    async transaction(queries: Promise<unknown>[]) {
      return Promise.all(queries);
    },
  };
  return { state, sql };
});

vi.mock("@/lib/pulse/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/db")>()),
  getSql: () => fakeDb.sql,
}));

import {
  checkPulseId,
  generatePulseId,
  PULSE_ID_MENTION,
  PULSE_ID_PATTERN,
  pulseIdMaxAgeDays,
} from "@/lib/pulse/pulseId";
import { fitSubmissionToLimits, LEAD_LIMITS, validateLeadSubmission } from "@/lib/pulse/leadValidation";
import { isPulseTurnstileRequired, readTurnstileToken, verifyPulseTurnstile } from "@/lib/security/turnstile";
import {
  enforceRateLimits,
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  RATE_LIMIT_UPSERT_SQL,
  setRateLimitStoreForTests,
  type RateLimitStore,
} from "@/lib/security/sharedRateLimit";
import { getTrustedClientIp, UNTRUSTED_CLIENT } from "@/lib/security/clientIp";
import {
  hashToken,
  isWellFormedToken,
  newVerificationToken,
  PostgresVerificationStore,
  verificationTtlMinutes,
} from "@/lib/pulse/emailVerification";
import { sharedStoresEnabled, withTimeout } from "@/lib/pulse/db";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fakeDb.state.rateRows.clear();
  fakeDb.state.tokenRows.clear();
  fakeDb.state.statements.length = 0;
  fakeDb.state.fail = false;
  setRateLimitStoreForTests(new MemoryRateLimitStore());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ------------------------------------------------------------ PULSE IDs
describe("server-generated PULSE IDs", () => {
  const NOW = new Date("2026-10-30T12:00:00Z");

  it("carry the date and two 4-character Crockford blocks", () => {
    const id = generatePulseId(NOW);
    expect(id).toMatch(PULSE_ID_PATTERN);
    expect(id.startsWith("PLS-261030-")).toBe(true);
    expect(id.slice(11)).not.toMatch(/[ILOU]/);
  });

  // 20,000 draws from 2^40 collide by chance about once in 5,500 runs; 100,000
  // would flake about once in 220 and took over 5 s on a loaded machine.
  it("do not repeat across 20,000 draws", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 20_000; n++) seen.add(generatePulseId(NOW));
    expect(seen.size).toBe(20_000);
  }, 30_000);

  it("use the whole alphabet in every position (no fixed or biased characters)", () => {
    const positions = Array.from({ length: 8 }, () => new Set<string>());
    for (let n = 0; n < 5_000; n++) {
      const block = generatePulseId(NOW).slice(11).replace("-", "");
      [...block].forEach((char, i) => positions[i].add(char));
    }
    for (const position of positions) expect(position.size).toBe(32);
  });

  it("accept today's ID in any case and with surrounding space", () => {
    const id = generatePulseId(NOW);
    expect(checkPulseId(`  ${id.toLowerCase()} `, NOW)).toEqual({ ok: true, id });
  });

  it("accept one day of clock or time-zone skew", () => {
    expect(checkPulseId(generatePulseId(new Date("2026-10-31T12:00:00Z")), NOW).ok).toBe(true);
  });

  it("reject future-dated IDs", () => {
    expect(checkPulseId(generatePulseId(new Date("2026-11-02T00:00:00Z")), NOW)).toEqual({ ok: false, reason: "future" });
  });

  it("reject expired IDs, with a configurable age", () => {
    expect(checkPulseId(generatePulseId(new Date("2025-10-01T00:00:00Z")), NOW)).toEqual({ ok: false, reason: "expired" });
    vi.stubEnv("PULSE_ID_MAX_AGE_DAYS", "30");
    expect(pulseIdMaxAgeDays()).toBe(30);
    expect(checkPulseId(generatePulseId(new Date("2026-09-01T00:00:00Z")), NOW).ok).toBe(false);
    vi.stubEnv("PULSE_ID_MAX_AGE_DAYS", "-5");
    expect(pulseIdMaxAgeDays()).toBe(365);
  });

  it("refuse the old guessable browser format", () => {
    expect(checkPulseId("PLS-261030-502", NOW)).toEqual({ ok: false, reason: "legacy" });
  });

  const malformed: unknown[] = [
    undefined,
    null,
    42,
    "",
    "PLS-261030-7KQ2",
    "PLS-261030-7KQ2-M9XDX",
    "PLS-261330-7KQ2-M9XD",
    "PLS-260230-7KQ2-M9XD",
    "PLS-261030-7KQ2-M9XU",
    "XLS-261030-7KQ2-M9XD",
    "PLS-261030-7KQ2-M9XD; DROP TABLE pulse_directions",
    "PLS-" + "1".repeat(100),
  ];
  for (const value of malformed) {
    it(`reject ${JSON.stringify(value)}`, () => {
      expect(checkPulseId(value, NOW)).toEqual({ ok: false, reason: "malformed" });
    });
  }

  it("mention detection catches both formats but not the word pls", () => {
    expect(PULSE_ID_MENTION.test("my id is PLS-261030-7KQ2-M9XD")).toBe(true);
    expect(PULSE_ID_MENTION.test("PLS-261030-502")).toBe(true);
    expect(PULSE_ID_MENTION.test("pls help me")).toBe(false);
  });
});

// ------------------------------------------------------------ input limits
describe("lead input limits", () => {
  const valid = () => ({
    lead: { name: "Synthetic Visitor", contact: "visitor@example.test", method: "Email" },
    context: { industry: "Logistics", friction: ["Paper dispatch"] },
    answers: ["We run couriers"],
  });

  it("accepts a well-formed submission and drops unknown context keys", () => {
    const result = validateLeadSubmission({ ...valid(), context: { industry: "Logistics", injected: "x" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toEqual({ industry: "Logistics" });
  });

  it("R4: rejects the 12,000-character answer instead of storing it", () => {
    const result = validateLeadSubmission({ ...valid(), answers: ["A".repeat(12_000)] });
    expect(result).toEqual({ ok: false, errors: { answers: true } });
  });

  it("accepts an answer exactly at the limit and rejects one character more", () => {
    expect(validateLeadSubmission({ ...valid(), answers: ["A".repeat(LEAD_LIMITS.answer)] }).ok).toBe(true);
    expect(validateLeadSubmission({ ...valid(), answers: ["A".repeat(LEAD_LIMITS.answer + 1)] }).ok).toBe(false);
  });

  it("rejects wrong types", () => {
    for (const body of [
      { ...valid(), lead: "visitor@example.test" },
      { ...valid(), answers: "one answer" },
      { ...valid(), context: ["array"] },
      { ...valid(), context: { budget: 15000 } },
      { ...valid(), lead: { name: ["N"], contact: "visitor@example.test" } },
    ]) {
      expect(validateLeadSubmission(body as Record<string, unknown>).ok).toBe(false);
    }
  });

  it("requires a name and a valid contact", () => {
    expect(validateLeadSubmission({ ...valid(), lead: { contact: "visitor@example.test" } }).ok).toBe(false);
    expect(validateLeadSubmission({ ...valid(), lead: { name: "N" } }).ok).toBe(false);
    expect(validateLeadSubmission({ ...valid(), lead: { name: "   ", contact: "visitor@example.test" } }).ok).toBe(false);
  });

  it("rejects unexpected top-level fields", () => {
    expect(validateLeadSubmission({ ...valid(), createdAt: "1999-01-01" })).toEqual({ ok: false, errors: { body: true } });
  });

  it("strips control characters", () => {
    const result = validateLeadSubmission({
      ...valid(),
      lead: { name: "Syn\u0000thetic\u0007", contact: "visitor@example.test" },
    });
    expect(result.ok && result.value.lead.name).toBe("Synthetic");
  });

  it("lets the browser fit long derived text to the limits before saving", () => {
    const fitted = fitSubmissionToLimits(
      { business: "B".repeat(900), friction: Array.from({ length: 14 }, () => "F".repeat(400)) },
      Array.from({ length: 25 }, () => "A".repeat(1_500))
    );
    const result = validateLeadSubmission({ lead: valid().lead, context: fitted.context, answers: fitted.answers });
    expect(result.ok).toBe(true);
  });
});

// ------------------------------------------------------------ Turnstile
describe("Turnstile verification", () => {
  const context = { action: "pulse_save" as const, ip: "203.0.113.9", requestId: "req-1" };
  const fetchMock = vi.fn();

  function siteverify(result: Record<string, unknown>, status = 200) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status }));
  }

  function sentForm(call = 0): URLSearchParams {
    return fetchMock.mock.calls[call][1].body as URLSearchParams;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubEnv("TURNSTILE_EXPECTED_HOSTNAME", "acevatech.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("accepts a valid token for the right hostname and action", async () => {
    siteverify({ success: true, hostname: "acevatech.com", action: "pulse_save" });
    expect(await verifyPulseTurnstile("good-token", context)).toBeNull();
    expect(sentForm().get("secret")).toBe("test-secret");
    expect(sentForm().get("response")).toBe("good-token");
    expect(sentForm().get("remoteip")).toBe("203.0.113.9");
  });

  it("requires a token", async () => {
    expect(await verifyPulseTurnstile("", context)).toBe("TURNSTILE_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyPulseTurnstile("bad", context)).toBe("TURNSTILE_INVALID");
  });

  it("treats an expired or replayed token as expired", async () => {
    siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyPulseTurnstile("used-before", context)).toBe("TURNSTILE_EXPIRED");
  });

  it("rejects a token issued for another hostname or another action", async () => {
    siteverify({ success: true, hostname: "evil.example", action: "pulse_save" });
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_INVALID");
    siteverify({ success: true, hostname: "acevatech.com", action: "contact" });
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_INVALID");
  });

  it("fails closed when Cloudflare is unreachable or errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_UNAVAILABLE");
    siteverify({}, 500);
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_UNAVAILABLE");
  });

  it("rejects an oversized token without calling Cloudflare", async () => {
    expect(await verifyPulseTurnstile("x".repeat(2_049), context)).toBe("TURNSTILE_INVALID");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send an untrusted client address", async () => {
    siteverify({ success: true, hostname: "acevatech.com", action: "pulse_save" });
    await verifyPulseTurnstile("t", { ...context, ip: UNTRUSTED_CLIENT });
    expect(sentForm().has("remoteip")).toBe(false);
  });

  it("never logs the token or the secret", async () => {
    siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    await verifyPulseTurnstile("token-marker-123", context);
    const logged = JSON.stringify([
      ...(console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls,
      ...(console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
    ]);
    expect(logged).not.toContain("token-marker-123");
    expect(logged).not.toContain("test-secret");
  });

  it("in production, cannot be switched off and fails closed without configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PULSE_REQUIRE_TURNSTILE", "false");
    expect(isPulseTurnstileRequired()).toBe(true);

    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_UNAVAILABLE");

    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubEnv("TURNSTILE_EXPECTED_HOSTNAME", "");
    expect(await verifyPulseTurnstile("t", context)).toBe("TURNSTILE_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("outside production, is required whenever a secret is set unless explicitly disabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isPulseTurnstileRequired()).toBe(true);
    vi.stubEnv("PULSE_REQUIRE_TURNSTILE", "false");
    expect(isPulseTurnstileRequired()).toBe(false);
    vi.stubEnv("PULSE_REQUIRE_TURNSTILE", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(isPulseTurnstileRequired()).toBe(false);
  });

  it("reads the token from either field name", () => {
    expect(readTurnstileToken({ turnstileToken: " a " })).toBe("a");
    expect(readTurnstileToken({ "cf-turnstile-response": "b" })).toBe("b");
    expect(readTurnstileToken({ turnstileToken: 5 })).toBe("");
  });
});

// ------------------------------------------------------------ client address
describe("trusted client address", () => {
  const req = (headers: Record<string, string>) => new Request("https://example.com", { headers });

  it("ignores forwarding headers unless a trusted proxy sets them", () => {
    expect(getTrustedClientIp(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" }))).toBe(UNTRUSTED_CLIENT);
  });

  it("uses x-real-ip, then the first x-forwarded-for entry, on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(getTrustedClientIp(req({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }))).toBe("5.6.7.8");
    expect(getTrustedClientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(getTrustedClientIp(req({}))).toBe(UNTRUSTED_CLIENT);
  });

  it("can be trusted explicitly behind another proxy", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    expect(getTrustedClientIp(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });
});

// ------------------------------------------------------------ shared rate limits
describe("shared rate limiting", () => {
  const rule = (value: string, limit = 5) => ({ dimension: "ip" as const, value, limit, windowMs: 60_000 });

  /** Requests load-balanced across two server instances, each with its own store object. */
  function twoInstances(): RateLimitStore {
    const a = new PostgresRateLimitStore();
    const b = new PostgresRateLimitStore();
    let n = 0;
    return { hit: (bucket, start, ms) => (n++ % 2 === 0 ? a : b).hit(bucket, start, ms) };
  }

  async function outcomes(count: number, call: () => Promise<void>) {
    const results = await Promise.allSettled(Array.from({ length: count }, call));
    return {
      passed: results.filter((r) => r.status === "fulfilled").length,
      limited: results.filter(
        (r) => r.status === "rejected" && (r.reason as { code?: string }).code === "RATE_LIMITED"
      ).length,
    };
  }

  it("holds across instances: 20 concurrent requests over two instances, exactly 5 pass", async () => {
    setRateLimitStoreForTests(twoInstances());
    const result = await outcomes(20, () => enforceRateLimits("t", [rule("203.0.113.1")], { onStoreError: "deny" }));
    expect(result).toEqual({ passed: 5, limited: 15 });
  });

  it("counts with one atomic upsert per hit, never a read-then-write", async () => {
    setRateLimitStoreForTests(new PostgresRateLimitStore());
    await enforceRateLimits("t", [rule("203.0.113.2")], { onStoreError: "deny" });
    const counted = fakeDb.state.statements.filter((s) => /pulse_rate_limits/.test(s) && !/CREATE TABLE/.test(s));
    expect(counted).toEqual([RATE_LIMIT_UPSERT_SQL.replace(/\s+/g, " ").trim()]);
    expect(RATE_LIMIT_UPSERT_SQL).toMatch(/ON CONFLICT \(bucket\) DO UPDATE/);
    expect(RATE_LIMIT_UPSERT_SQL).toMatch(/RETURNING hits/);
  });

  it("stores only hashed keys, never the address, email or reference", async () => {
    setRateLimitStoreForTests(new PostgresRateLimitStore());
    await enforceRateLimits(
      "t",
      [rule("203.0.113.3"), { dimension: "email", value: "visitor@example.test", limit: 3, windowMs: 60_000 }],
      { onStoreError: "deny" }
    );
    const keys = [...fakeDb.state.rateRows.keys()].join(" ");
    expect(keys).not.toContain("203.0.113.3");
    expect(keys).not.toContain("visitor@example.test");
    expect(keys).toMatch(/^t:ip:[0-9a-f]{40} t:email:[0-9a-f]{40}$/);
  });

  it("starts a new window after the old one ends", async () => {
    setRateLimitStoreForTests(new PostgresRateLimitStore());
    const t0 = Date.UTC(2026, 9, 30, 12, 0, 0);
    for (let n = 0; n < 5; n++) await enforceRateLimits("t", [rule("x")], { onStoreError: "deny", now: t0 });
    await expect(enforceRateLimits("t", [rule("x")], { onStoreError: "deny", now: t0 })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await expect(enforceRateLimits("t", [rule("x")], { onStoreError: "deny", now: t0 + 60_000 })).resolves.toBeUndefined();
  });

  it("counts every rule, so staying under one does not dodge another", async () => {
    const rules = (ip: string) => [
      rule(ip, 100),
      { dimension: "email" as const, value: "one@example.test", limit: 2, windowMs: 60_000 },
    ];
    await enforceRateLimits("t", rules("1.1.1.1"), { onStoreError: "deny" });
    await enforceRateLimits("t", rules("2.2.2.2"), { onStoreError: "deny" });
    await expect(enforceRateLimits("t", rules("3.3.3.3"), { onStoreError: "deny" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("refuses, generically, when the store is down and the policy is deny", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeDb.state.fail = true;
    setRateLimitStoreForTests(new PostgresRateLimitStore());
    const error = await enforceRateLimits("t", [rule("x")], { onStoreError: "deny" }).catch((e) => e);
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(error.body ?? {})).not.toMatch(/neon|10\.0\.0\.12/);
  });

  it("falls back to half the limit locally, never unlimited, when the policy is local", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeDb.state.fail = true;
    setRateLimitStoreForTests(new PostgresRateLimitStore());
    const result = await outcomes(10, () => enforceRateLimits("t", [rule("x", 10)], { onStoreError: "local" }));
    expect(result).toEqual({ passed: 5, limited: 5 });
  });

  it("times out a hanging store instead of waiting forever", async () => {
    vi.useFakeTimers();
    const hang = new Promise<never>(() => {});
    const raced = withTimeout(hang, "test", 2_000).catch((e: Error) => e.name);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(await raced).toBe("DatabaseUnavailableError");
  });
});

// ------------------------------------------------------------ verification tokens
describe("email verification tokens", () => {
  it("are 256-bit, URL-safe and distinct", () => {
    const tokens = new Set(Array.from({ length: 1_000 }, () => newVerificationToken().token));
    expect(tokens.size).toBe(1_000);
    for (const token of tokens) expect(isWellFormedToken(token)).toBe(true);
    expect(isWellFormedToken("x".repeat(42))).toBe(false);
    expect(isWellFormedToken("x".repeat(42) + "!")).toBe(false);
  });

  it("are stored as SHA-256 hashes", () => {
    const { token, tokenHash } = newVerificationToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("expire after a short, clamped, configurable time", () => {
    expect(verificationTtlMinutes()).toBe(30);
    vi.stubEnv("PULSE_VERIFY_TOKEN_TTL_MINUTES", "10");
    expect(verificationTtlMinutes()).toBe(10);
    vi.stubEnv("PULSE_VERIFY_TOKEN_TTL_MINUTES", "1440");
    expect(verificationTtlMinutes()).toBe(60);
    vi.stubEnv("PULSE_VERIFY_TOKEN_TTL_MINUTES", "1");
    expect(verificationTtlMinutes()).toBe(5);
  });

  describe("in the Postgres store", () => {
    const PULSE_ID = "PLS-261030-7KQ2-M9XD";

    it("redeem exactly once under concurrency", async () => {
      const store = new PostgresVerificationStore();
      const { token, tokenHash } = newVerificationToken();
      await store.create(tokenHash, PULSE_ID, new Date(Date.now() + 60_000));
      const results = await Promise.all(Array.from({ length: 10 }, () => store.redeem(hashToken(token), new Date())));
      expect(results.filter((r) => r === PULSE_ID)).toHaveLength(1);
      expect(results.filter((r) => r === null)).toHaveLength(9);
    });

    it("never store the raw token", async () => {
      const store = new PostgresVerificationStore();
      const { token, tokenHash } = newVerificationToken();
      await store.create(tokenHash, PULSE_ID, new Date(Date.now() + 60_000));
      expect(JSON.stringify([...fakeDb.state.tokenRows])).not.toContain(token);
    });

    it("refuse an expired token", async () => {
      const store = new PostgresVerificationStore();
      const { tokenHash } = newVerificationToken();
      await store.create(tokenHash, PULSE_ID, new Date(Date.now() - 1));
      expect(await store.redeem(tokenHash, new Date())).toBeNull();
    });

    it("supersede an earlier unused token", async () => {
      const store = new PostgresVerificationStore();
      const first = newVerificationToken();
      const second = newVerificationToken();
      await store.create(first.tokenHash, PULSE_ID, new Date(Date.now() + 60_000));
      await store.create(second.tokenHash, PULSE_ID, new Date(Date.now() + 60_000));
      expect(await store.redeem(first.tokenHash, new Date())).toBeNull();
      expect(await store.redeem(second.tokenHash, new Date())).toBe(PULSE_ID);
    });
  });
});

// ------------------------------------------------------------ store selection
describe("shared store selection", () => {
  it("never uses the database from tests, even with NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sharedStoresEnabled()).toBe(false);
  });

  it("can be forced either way explicitly", () => {
    vi.stubEnv("PULSE_SHARED_STORES", "postgres");
    expect(sharedStoresEnabled()).toBe(true);
    vi.stubEnv("PULSE_SHARED_STORES", "memory");
    expect(sharedStoresEnabled()).toBe(false);
  });
});
