import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Blueprint email with email ownership verification (P1, 30 October 2026).
 *
 * Step 1, /api/pulse/email-blueprint, answers every well-formed request the
 * same way and, only when the reference and address match a saved direction,
 * emails a single-use confirmation link to the STORED address. Step 2,
 * /api/pulse/email-blueprint/confirm, redeems the token once and sends a
 * fixed-template blueprint. The feature ships switched off; these tests turn
 * the flag on for this file only (the shipped refusal is covered in
 * tests/api/pulseBlueprintEmailDisabled.test.ts).
 *
 * Resend is a spy, the direction store an in-memory map, and the
 * verification and rate-limit stores are injected in-memory stores. All data
 * is synthetic.
 */

const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>(), failRead: false }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  createDirection: async () => true,
  getDirection: async (id: string) => {
    if (store.failRead) throw new Error("neon: connection terminated unexpectedly at 10.0.0.12:5432");
    return store.rows.get(id) ?? null;
  },
}));

vi.mock("@/lib/pulse/features", () => ({
  PULSE_FEATURES: { blueprintEmail: true, pulseIdLookupDetails: false },
}));

import { POST as requestLink, VERIFICATION_REQUESTED_MESSAGE } from "@/app/api/pulse/email-blueprint/route";
import { POST as confirm } from "@/app/api/pulse/email-blueprint/confirm/route";
import { renderBlueprintEmail, renderVerificationEmail, validateRecipient } from "@/lib/pulse/blueprintEmail";
import {
  hashToken,
  MemoryVerificationStore,
  newVerificationToken,
  setVerificationStoreForTests,
} from "@/lib/pulse/emailVerification";
import { generatePulseId } from "@/lib/pulse/pulseId";
import { MemoryRateLimitStore, setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";
import type { SavedDirection } from "@/lib/pulse/directionStore";

const OWNER = "jordan.owner@example.test";
const LURE = "Your account is suspended. Verify at https://evil.example/login";
let verifications: MemoryVerificationStore;

function direction(overrides: Record<string, unknown> = {}): SavedDirection {
  return {
    pulseId: generatePulseId(),
    lead: { name: "Jordan Ellis", contact: OWNER, method: "Email" },
    context: { intent: "Automate something", industry: "Logistics", goals: ["Live operations"] },
    answers: ["We run a courier fleet", "Dispatch is on paper"],
    recommendedModules: ["Dispatch control tower"],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as SavedDirection;
}

function saved(overrides: Record<string, unknown> = {}): SavedDirection {
  const row = direction(overrides);
  store.rows.set(row.pulseId, row);
  return row;
}

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": `198.51.100.${Math.floor(Math.random() * 250)}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ask = (body: unknown, headers?: Record<string, string>) =>
  requestLink(post("/api/pulse/email-blueprint", body, headers));
const redeem = (body: unknown, headers?: Record<string, string>) =>
  confirm(post("/api/pulse/email-blueprint/confirm", body, headers));

/** The response with its per-request id removed, so two answers can be compared exactly. */
async function shape(response: Response) {
  const body = await response.json();
  delete body.requestId;
  return { status: response.status, body };
}

function sentMail(index = 0) {
  return send.mock.calls[index][0] as { to: string; subject: string; text: string; html?: string };
}

function tokenFrom(text: string): string {
  const match = text.match(/#token=([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error("no token link in the email");
  return match[1];
}

beforeEach(() => {
  vi.unstubAllEnvs();
  send.mockReset();
  send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  store.rows.clear();
  store.failRead = false;
  verifications = new MemoryVerificationStore();
  setVerificationStoreForTests(verifications);
  setRateLimitStoreForTests(new MemoryRateLimitStore());
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("CONTACT_FROM_EMAIL", "ACEVA <hello@example.test>");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  setVerificationStoreForTests(null);
});

describe("step 1: requesting a confirmation link", () => {
  it("emails a single-use link, not the blueprint, to the stored address", async () => {
    const row = saved();
    const response = await ask({ pulseId: row.pulseId, contact: OWNER });

    expect(response.status).toBe(202);
    expect((await response.json()).message).toBe(VERIFICATION_REQUESTED_MESSAGE);
    expect(send).toHaveBeenCalledOnce();
    const mail = sentMail();
    expect(mail.to).toBe(OWNER);
    expect(mail.html).toBeUndefined();
    expect(mail.text).toContain("/pulse/verify#token=");
    expect(mail.text).not.toContain("RECOMMENDED SYSTEM ARCHITECTURE");
  });

  it("stores only a hash of the token", async () => {
    const row = saved();
    await ask({ pulseId: row.pulseId, contact: OWNER });
    const token = tokenFrom(sentMail().text);

    expect(verifications.rows.has(token)).toBe(false);
    expect(verifications.rows.has(hashToken(token))).toBe(true);
    expect(JSON.stringify([...verifications.rows])).not.toContain(token);
  });

  it("matches the address case- and whitespace-insensitively, and a lowercase reference", async () => {
    const row = saved();
    const response = await ask({ pulseId: row.pulseId.toLowerCase(), contact: `  ${OWNER.toUpperCase()} ` });
    expect(response.status).toBe(202);
    expect(sentMail().to).toBe(OWNER);
  });

  it("R1: never mails an address from the request that differs from the stored one", async () => {
    const row = saved();
    await ask({ pulseId: row.pulseId, contact: "stranger@example.test" });
    expect(send).not.toHaveBeenCalled();
  });

  it("answers identically for a match, a wrong address, an unknown reference and a phone contact", async () => {
    const owner = saved();
    const phone = saved({ lead: { name: "P", contact: "+44 7700 900456", method: "Phone" } });
    const answers = [
      await shape(await ask({ pulseId: owner.pulseId, contact: OWNER })),
      await shape(await ask({ pulseId: owner.pulseId, contact: "stranger@example.test" })),
      await shape(await ask({ pulseId: generatePulseId(), contact: OWNER })),
      await shape(await ask({ pulseId: phone.pulseId, contact: "stranger@example.test" })),
    ];
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    expect(send).toHaveBeenCalledOnce();
  });

  it("answers identically when the store is down, without exposing the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const row = saved();
    const healthy = await shape(await ask({ pulseId: row.pulseId, contact: "stranger@example.test" }));
    store.failRead = true;
    const outage = await shape(await ask({ pulseId: row.pulseId, contact: OWNER }));

    expect(outage).toEqual(healthy);
    expect(JSON.stringify(outage)).not.toMatch(/neon|10\.0\.0\.12/);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing when email is not configured, with the same answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("CONTACT_FROM_EMAIL", "");
    const row = saved();
    expect((await ask({ pulseId: row.pulseId, contact: OWNER })).status).toBe(202);
    expect(send).not.toHaveBeenCalled();
  });

  const now = Date.now();
  const rejected: [string, unknown][] = [
    ["a legacy guessable reference", "PLS-261030-502"],
    ["a future-dated reference (R3)", generatePulseId(new Date(now + 3 * 86_400_000))],
    ["an expired reference", generatePulseId(new Date(now - 730 * 86_400_000))],
    ["an impossible date", "PLS-261332-7KQ2-M9XD"],
    ["a reference with excluded letters", "PLS-261030-ILOU-M9XD"],
    ["a sql-ish reference", "PLS-261030-7KQ2-M9XD' OR 1=1 --"],
    ["a non-string reference", 12345],
  ];
  for (const [label, pulseId] of rejected) {
    it(`refuses ${label} before any lookup`, async () => {
      const response = await ask({ pulseId, contact: OWNER });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
      expect(send).not.toHaveBeenCalled();
    });
  }

  const badRecipients = [
    "",
    "not-an-address",
    "a@example.test,b@example.test",
    "a@example.test\r\nBcc: b@example.test",
    "Name <a@example.test>",
  ];
  for (const contact of badRecipients) {
    it(`refuses the recipient ${JSON.stringify(contact)}`, async () => {
      const row = saved();
      expect((await ask({ pulseId: row.pulseId, contact })).status).toBe(400);
      expect(send).not.toHaveBeenCalled();
    });
  }

  it("refuses unexpected fields, malformed JSON, oversized bodies, foreign origins and non-JSON", async () => {
    const row = saved();
    expect((await ask({ pulseId: row.pulseId, contact: OWNER, to: "stranger@example.test" })).status).toBe(400);
    expect((await ask("{not json")).status).toBe(400);
    expect((await ask({ pulseId: row.pulseId, contact: OWNER, turnstileToken: "x".repeat(3_000) })).status).toBe(413);
    expect((await ask({ pulseId: row.pulseId, contact: OWNER }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await ask("x", { "content-type": "text/plain" })).status).toBe(415);
    expect(send).not.toHaveBeenCalled();
  });

  it("limits requests per address across client addresses", async () => {
    const row = saved();
    const statuses: number[] = [];
    for (let n = 0; n < 4; n++) {
      statuses.push((await ask({ pulseId: row.pulseId, contact: OWNER }, { "x-real-ip": `203.0.113.${n + 1}` })).status);
    }
    expect(statuses).toEqual([202, 202, 202, 429]);
  });

  it("limits requests per reference, whatever address is tried", async () => {
    const row = saved();
    const statuses: number[] = [];
    for (let n = 0; n < 4; n++) {
      statuses.push(
        (await ask({ pulseId: row.pulseId, contact: `guess${n}@example.test` }, { "x-real-ip": `203.0.113.${n + 1}` })).status
      );
    }
    expect(statuses).toEqual([202, 202, 202, 429]);
  });

  it("limits requests per client address", async () => {
    const statuses: number[] = [];
    for (let n = 0; n < 6; n++) {
      statuses.push(
        (await ask({ pulseId: generatePulseId(), contact: `p${n}@example.test` }, { "x-real-ip": "203.0.113.50" })).status
      );
    }
    expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(statuses[5]).toBe(429);
  });

  it("refuses rather than allowing unlimited requests when the rate-limit store is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitStoreForTests({
      hit: async () => {
        throw new Error("store down");
      },
    });
    const row = saved();
    expect((await ask({ pulseId: row.pulseId, contact: OWNER })).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("step 2: redeeming the link", () => {
  async function linkFor(row: SavedDirection): Promise<string> {
    send.mockClear();
    await ask({ pulseId: row.pulseId, contact: OWNER });
    const token = tokenFrom(sentMail().text);
    send.mockClear();
    return token;
  }

  it("sends a fixed-template blueprint to the stored address", async () => {
    const row = saved({
      lead: { name: `Click ${LURE}`, contact: OWNER, method: "Email" },
      answers: [LURE, "<script>alert(1)</script>"],
      recommendedModules: [LURE],
    });
    const response = await redeem({ token: await linkFor(row) });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    const mail = sentMail();
    expect(mail.to).toBe(OWNER);
    expect(mail.html).toBeUndefined();
    expect(mail.text).toContain(row.pulseId);
    expect(mail.text).toContain("RECOMMENDED SYSTEM ARCHITECTURE");
    expect(mail.text).not.toContain("evil.example");
    expect(mail.text).not.toContain("<script>");
    expect(mail.text).not.toContain("Click");
  });

  it("works once: a replayed token is refused and nothing more is sent", async () => {
    const token = await linkFor(saved());
    expect((await redeem({ token })).status).toBe(200);
    const replay = await redeem({ token });

    expect(replay.status).toBe(400);
    expect((await replay.json()).code).toBe("VALIDATION_FAILED");
    expect(send).toHaveBeenCalledOnce();
  });

  it("sends exactly one email when the same token is redeemed concurrently", async () => {
    const token = await linkFor(saved());
    const statuses = (await Promise.all(Array.from({ length: 8 }, () => redeem({ token })))).map((r) => r.status);

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 400)).toHaveLength(7);
    expect(send).toHaveBeenCalledOnce();
  });

  it("refuses an expired link", async () => {
    const row = saved();
    const { token, tokenHash } = newVerificationToken();
    await verifications.create(tokenHash, row.pulseId, new Date(Date.now() - 1_000));
    expect((await redeem({ token })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses an earlier link once a newer one has been requested", async () => {
    const row = saved();
    const first = await linkFor(row);
    const second = await linkFor(row);
    expect((await redeem({ token: first })).status).toBe(400);
    expect((await redeem({ token: second })).status).toBe(200);
  });

  it("gives tampered, unknown and malformed tokens the same refusal", async () => {
    const token = await linkFor(saved());
    const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1);
    const refusals = [
      await shape(await redeem({ token: tampered })),
      await shape(await redeem({ token: newVerificationToken().token })),
      await shape(await redeem({ token: "short" })),
      await shape(await redeem({ token, extra: true })),
    ];
    for (const refusal of refusals) expect(refusal).toEqual(refusals[0]);
    expect(refusals[0].status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("never logs the token", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    for (const spy of spies) spy.mockImplementation(() => {});
    const token = await linkFor(saved());
    await redeem({ token });
    await redeem({ token });
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(token);
  });

  it("reports a verification-store outage generically", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setVerificationStoreForTests({
      create: async () => undefined,
      redeem: async () => {
        throw new Error("neon: connection terminated at 10.0.0.12");
      },
    });
    const response = await redeem({ token: newVerificationToken().token });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toMatch(/neon|10\.0\.0\.12/);
  });

  it("reports a provider rejection as an upstream error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const token = await linkFor(saved());
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad" } });
    expect((await redeem({ token })).status).toBe(502);
  });
});

describe("email templates", () => {
  it("builds the verification link from the configured https site URL only", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.test");
    expect(renderVerificationEmail({ pulseId: "PLS-261030-7KQ2-M9XD", token: "t", ttlMinutes: 30 }).text).toContain(
      "https://www.example.test/pulse/verify#token=t"
    );
    for (const bad of ["http://insecure.example", "https://evil.example/path", "javascript:alert(1)"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", bad);
      expect(renderVerificationEmail({ pulseId: "PLS-261030-7KQ2-M9XD", token: "t", ttlMinutes: 30 }).text).toContain(
        "https://acevatech.com/pulse/verify#token=t"
      );
    }
  });

  it("keeps every dynamic value to one line, so headers cannot be injected", () => {
    const { subject } = renderVerificationEmail({ pulseId: "PLS-1\r\nBcc: x@example.test", token: "t", ttlMinutes: 30 });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("puts nothing the visitor typed into the blueprint", () => {
    const { text } = renderBlueprintEmail(
      direction({
        lead: { name: "Visitor Name Marker", contact: OWNER, method: "Email" },
        answers: ["Answer marker https://evil.example"],
        recommendedModules: ["Stored module marker"],
      })
    );
    expect(text).not.toContain("Visitor Name Marker");
    expect(text).not.toContain("Answer marker");
    expect(text).not.toContain("Stored module marker");
    expect(text).not.toContain("evil.example");
  });

  it("validates recipients strictly", () => {
    expect(validateRecipient(" Jordan@Example.Test ")).toBe("jordan@example.test");
    for (const bad of [
      undefined,
      42,
      "",
      "a@b",
      "a@example.test;b@example.test",
      "<a@example.test>",
      "a@example.test\nBcc: b@example.test",
    ]) {
      expect(validateRecipient(bad)).toBeNull();
    }
  });
});
