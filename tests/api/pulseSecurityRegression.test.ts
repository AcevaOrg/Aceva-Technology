import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level regressions for the red-team findings R1–R5 (security audit,
 * 30 October 2026), with blueprint email switched ON for this file so the
 * hardened flow is exercised at its most exposed. R6 (lookup disclosure) is
 * covered in tests/api/pulseIdLookupRoute.test.ts and
 * tests/unit/pulseIdLookupPrivacy.test.ts; the shipped switch-off of blueprint
 * email in tests/api/pulseBlueprintEmailDisabled.test.ts.
 *
 * Resend and Cloudflare are mocks, the direction store an insert-only
 * in-memory map, and the rate-limit and verification stores in-memory. All
 * data is synthetic.
 */

const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>() }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  createDirection: async (direction: { pulseId: string }) => {
    if (store.rows.has(direction.pulseId)) return false;
    store.rows.set(direction.pulseId, structuredClone(direction));
    return true;
  },
  getDirection: async (id: string) => store.rows.get(id) ?? null,
}));

vi.mock("@/lib/pulse/features", () => ({
  PULSE_FEATURES: { blueprintEmail: true, pulseIdLookupDetails: false },
}));

import { POST as saveDirection } from "@/app/api/pulse/save-direction/route";
import { POST as requestLink } from "@/app/api/pulse/email-blueprint/route";
import { POST as confirmLink } from "@/app/api/pulse/email-blueprint/confirm/route";
import { MemoryVerificationStore, setVerificationStoreForTests } from "@/lib/pulse/emailVerification";
import { PULSE_ID_PATTERN } from "@/lib/pulse/pulseId";
import { MemoryRateLimitStore, setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";

const TEAM = "team@example.test";
const VICTIM = "unsuspecting.person@example.test";
const LURE = "Your ACEVA account is suspended. Verify now at https://evil.example/login";

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function lead(contact: string, extra: Record<string, unknown> = {}) {
  return { lead: { name: "Synthetic Visitor", contact, method: "Email" }, answers: ["We run couriers"], ...extra };
}

async function save(body: unknown, headers: Record<string, string> = {}) {
  const response = await saveDirection(post("/api/pulse/save-direction", body, { "x-real-ip": "198.51.100.1", ...headers }));
  return { status: response.status, body: await response.json() };
}

function recipients(): string[] {
  return send.mock.calls.map((call) => (call[0] as { to: string }).to);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  send.mockReset();
  send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  store.rows.clear();
  setRateLimitStoreForTests(new MemoryRateLimitStore());
  setVerificationStoreForTests(new MemoryVerificationStore());
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("CONTACT_TO_EMAIL", TEAM);
  vi.stubEnv("CONTACT_FROM_EMAIL", "ACEVA <hello@example.test>");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  setVerificationStoreForTests(null);
});

describe("R1: ACEVA's sender cannot be used as a relay", () => {
  it("the victim receives only a fixed confirmation notice, never the lure or a blueprint", async () => {
    const saved = await save(lead(VICTIM, { answers: [LURE], context: { business: LURE }, recommendedModules: [LURE] }));
    expect(saved.status).toBe(200);
    send.mockClear();

    const asked = await requestLink(
      post("/api/pulse/email-blueprint", { pulseId: saved.body.pulseId, contact: VICTIM }, { "x-real-ip": "198.51.100.2" })
    );
    expect(asked.status).toBe(202);

    expect(recipients()).toEqual([VICTIM]);
    const mail = send.mock.calls[0][0] as { text: string; subject: string };
    expect(mail.text).not.toContain("evil.example");
    expect(mail.text).not.toContain("suspended");
    expect(mail.text).not.toContain("RECOMMENDED SYSTEM ARCHITECTURE");
    expect(mail.text).toContain("If you did not ask for this, ignore this email");
  });

  it("an address in the request that differs from the saved one is never mailed", async () => {
    const saved = await save(lead("owner@example.test"));
    send.mockClear();
    await requestLink(post("/api/pulse/email-blueprint", { pulseId: saved.body.pulseId, contact: VICTIM }, { "x-real-ip": "198.51.100.3" }));
    expect(send).not.toHaveBeenCalled();
  });

  it("the team notification carries the lure defanged, so it cannot be clicked", async () => {
    await save(lead("owner@example.test", { context: { business: LURE } }));
    const text = (send.mock.calls[0][0] as { text: string }).text;
    expect(recipients()).toEqual([TEAM]);
    expect(text).not.toMatch(/https?:\/\/evil/);
  });

  it("a confirmation link alone, without the token, sends nothing", async () => {
    const response = await confirmLink(post("/api/pulse/email-blueprint/confirm", {}, { "x-real-ip": "198.51.100.4" }));
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("R2: references cannot be pre-claimed", () => {
  it("squatting the old ID space has no effect on real visitors", async () => {
    for (let n = 100; n < 110; n++) {
      await save(lead(`squatter${n}@example.test`, { pulseId: `PLS-261030-${n}` }), { "x-real-ip": `203.0.113.${n - 99}` });
    }
    const visitor = await save(lead("real.visitor@example.test", { pulseId: "PLS-261030-105" }), { "x-real-ip": "198.51.100.9" });

    expect(visitor.status).toBe(200);
    expect(visitor.body.pulseId).toMatch(PULSE_ID_PATTERN);
    expect([...store.rows.keys()].some((key) => key.startsWith("PLS-261030-1") && key.length === 14)).toBe(false);
  });

  it("concurrent saves get distinct references and none overwrites another", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, n) => save(lead(`c${n}@example.test`), { "x-real-ip": `203.0.113.${n + 1}` }))
    );
    const ids = results.map((r) => r.body.pulseId as string);
    expect(new Set(ids).size).toBe(25);
    for (let n = 0; n < 25; n++) {
      expect((store.rows.get(ids[n]) as { lead: { contact: string } }).lead.contact).toBe(`c${n}@example.test`);
    }
  });
});

describe("R3: future-dated references are refused", () => {
  it("wherever a visitor can supply a reference", async () => {
    const saved = await save(lead("owner@example.test", { pulseId: "PLS-991231-999" }));
    expect(saved.body.pulseId).not.toBe("PLS-991231-999");

    const future = await requestLink(
      post("/api/pulse/email-blueprint", { pulseId: "PLS-991231-7KQ2-M9XD", contact: "owner@example.test" }, { "x-real-ip": "198.51.100.5" })
    );
    expect(future.status).toBe(400);
  });
});

describe("R4: oversized input is refused before storage, email or the model", () => {
  it("the 12,000-character answer is rejected and nothing is stored or sent", async () => {
    const result = await save(lead("owner@example.test", { answers: ["A".repeat(12_000)] }));
    expect(result.status).toBe(400);
    expect(result.body.errors).toEqual({ answers: true });
    expect(store.rows.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("a body over 16 KB is refused before it is parsed", async () => {
    const result = await save(JSON.stringify(lead("owner@example.test", { answers: ["A".repeat(20_000)] })));
    expect(result.status).toBe(413);
  });

  it("malformed JSON is refused", async () => {
    const result = await save("{\"lead\": ");
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("INVALID_JSON");
  });
});

describe("R5: limits are shared and cannot be dodged with headers", () => {
  it("off Vercel, rotating x-forwarded-for does not escape the save limit", async () => {
    vi.stubEnv("VERCEL", "");
    const statuses: number[] = [];
    for (let n = 0; n < 6; n++) {
      statuses.push((await save(lead(`r5-${n}@example.test`), { "x-forwarded-for": crypto.randomUUID(), "x-real-ip": crypto.randomUUID() })).status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("concurrent requests cannot overshoot the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, n) => save(lead(`burst${n}@example.test`), { "x-real-ip": "203.0.113.99" }))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(7);
    expect(store.rows.size).toBe(5);
  });
});

describe("Turnstile on the write routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubEnv("TURNSTILE_EXPECTED_HOSTNAME", "example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function siteverify(result: Record<string, unknown>) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
  }

  const cases: [string, Record<string, unknown> | null, string | undefined, number, string][] = [
    ["a missing token", null, undefined, 400, "TURNSTILE_REQUIRED"],
    ["an invalid token", { success: false, "error-codes": ["invalid-input-response"] }, "bad", 403, "TURNSTILE_INVALID"],
    ["a replayed token", { success: false, "error-codes": ["timeout-or-duplicate"] }, "used", 400, "TURNSTILE_EXPIRED"],
    ["a token for another action", { success: true, hostname: "example.com", action: "pulse_email" }, "t", 403, "TURNSTILE_INVALID"],
  ];
  for (const [label, result, token, status, code] of cases) {
    it(`save-direction refuses ${label}, storing and sending nothing`, async () => {
      if (result) siteverify(result);
      const response = await save(lead("owner@example.test", token ? { turnstileToken: token } : {}));
      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
      expect(store.rows.size).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });
  }

  it("save-direction accepts a valid token for its own action", async () => {
    siteverify({ success: true, hostname: "example.com", action: "pulse_save" });
    expect((await save(lead("owner@example.test", { turnstileToken: "good" }))).status).toBe(200);
  });

  it("the email route requires its own action", async () => {
    siteverify({ success: true, hostname: "example.com", action: "pulse_save" });
    const response = await requestLink(
      post("/api/pulse/email-blueprint", { pulseId: "PLS-261030-7KQ2-M9XD", contact: "owner@example.test", turnstileToken: "t" }, { "x-real-ip": "198.51.100.6" })
    );
    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await save(lead("owner@example.test", { turnstileToken: "t" }));
    expect(response.status).toBe(503);
    expect(store.rows.size).toBe(0);
  });
});

describe("session isolation", () => {
  it("one visitor cannot get another visitor's blueprint by quoting their reference", async () => {
    const a = await save(lead("visitor.a@example.test"), { "x-real-ip": "198.51.100.10" });
    send.mockClear();
    const asked = await requestLink(
      post("/api/pulse/email-blueprint", { pulseId: a.body.pulseId, contact: "visitor.b@example.test" }, { "x-real-ip": "198.51.100.11" })
    );
    const body = await asked.json();

    expect(asked.status).toBe(202);
    expect(JSON.stringify(body)).not.toContain("visitor.a@example.test");
    expect(send).not.toHaveBeenCalled();
  });

  it("the save response returns only the new reference", async () => {
    const saved = await save(lead("visitor.c@example.test"));
    expect(Object.keys(saved.body).sort()).toEqual(["ok", "pulseId"]);
  });
});
