import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Blueprint email is switched off at the API (security containment, 30 October
 * 2026), with the shipped feature flags — nothing here mocks them.
 *
 * The vulnerability: anyone could save a direction with a stranger's email as
 * the contact and visitor-written text or links in the answers, then call
 * /api/pulse/email-blueprint with that same pair, and ACEVA's verified sender
 * would deliver the text to the stranger. The route now refuses every request
 * before reading the body, the store or the email provider. Resend is a spy,
 * the store an in-memory map, and all data synthetic.
 */

const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>(), reads: 0 }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  createDirection: async (direction: { pulseId: string }) => {
    if (store.rows.has(direction.pulseId)) return false;
    store.rows.set(direction.pulseId, direction);
    return true;
  },
  getDirection: async (pulseId: string) => {
    store.reads += 1;
    return store.rows.get(pulseId.trim().toUpperCase()) ?? null;
  },
}));

import { POST as emailBlueprint, GET as emailBlueprintGet } from "@/app/api/pulse/email-blueprint/route";
import { POST as saveDirection } from "@/app/api/pulse/save-direction/route";
import { POST as confirmBlueprint } from "@/app/api/pulse/email-blueprint/confirm/route";
import VerifyPage from "@/app/pulse/verify/page";
import { API_ERROR_MESSAGES, RETRYABLE_API_ERROR_CODES } from "@/lib/api/errorCodes";
import { MemoryRateLimitStore, setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";

function resetRateLimitStore() {
  setRateLimitStoreForTests(new MemoryRateLimitStore());
}

const TEAM = "team@example.test";
const VICTIM = "unsuspecting.person@example.test";
const LURE = "Your ACEVA account is suspended. Verify now at https://evil.example/login";

function post(url: string, body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID(), ...headers },
    body,
  });
}

/** The response with its per-request id removed, so two refusals can be compared. */
async function shape(response: Response) {
  const body = await response.json();
  delete body.requestId;
  return { status: response.status, body };
}

describe("the blueprint email API is refused at the server", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    store.rows.clear();
    store.reads = 0;
    resetRateLimitStore();
    // A configured provider: the refusal must not depend on email being unconfigured.
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_TO_EMAIL", TEAM);
  });

  it("refuses even a request that previously succeeded, and sends nothing", async () => {
    store.rows.set("PLS-261030-301", {
      pulseId: "PLS-261030-301",
      lead: { name: "Synthetic Owner", contact: "owner@example.test", method: "Email" },
      createdAt: "2026-10-30T10:00:00.000Z",
    });

    const response = await emailBlueprint(post("/api/pulse/email-blueprint", JSON.stringify({ pulseId: "PLS-261030-301", contact: "owner@example.test" })));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, code: "FEATURE_DISABLED", retryable: false });
    expect(body.error).toBe(API_ERROR_MESSAGES.FEATURE_DISABLED);
    expect(send).not.toHaveBeenCalled();
    expect(store.reads, "the store was read").toBe(0);
  });

  it("gives every request the same answer, so nothing can be probed through it", async () => {
    const requests: [string, Request][] = [
      ["owner pair", post("/api/pulse/email-blueprint", JSON.stringify({ pulseId: "PLS-261030-301", contact: "owner@example.test" }))],
      ["unknown id", post("/api/pulse/email-blueprint", JSON.stringify({ pulseId: "PLS-261030-999", contact: VICTIM }))],
      ["malformed id", post("/api/pulse/email-blueprint", JSON.stringify({ pulseId: "PLS-123", contact: VICTIM }))],
      ["empty object", post("/api/pulse/email-blueprint", "{}")],
      ["invalid JSON", post("/api/pulse/email-blueprint", "{not json")],
      ["wrong content type", post("/api/pulse/email-blueprint", "x", { "content-type": "text/plain" })],
      ["foreign origin", post("/api/pulse/email-blueprint", "{}", { origin: "https://evil.example" })],
      ["oversized body", post("/api/pulse/email-blueprint", JSON.stringify({ pulseId: "PLS-261030-301", contact: "x".repeat(10_000) }))],
    ];

    const shapes = [];
    for (const [label, request] of requests) {
      const result = await shape(await emailBlueprint(request));
      expect(result.status, label).toBe(503);
      shapes.push(result);
    }
    for (const result of shapes) expect(result).toEqual(shapes[0]);
    expect(send).not.toHaveBeenCalled();
    expect(store.reads).toBe(0);
  });

  it("does not count a refusal as retryable, so the UI offers no retry", () => {
    expect(RETRYABLE_API_ERROR_CODES.has("FEATURE_DISABLED")).toBe(false);
  });

  it("still answers other methods as before", async () => {
    const response = emailBlueprintGet(new Request("https://example.com/api/pulse/email-blueprint"));
    expect(response.status).toBe(405);
  });
});

describe("the relay attack end to end", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    store.rows.clear();
    store.reads = 0;
    resetRateLimitStore();
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_TO_EMAIL", TEAM);
  });

  it("delivers nothing to the stranger whose address was used", async () => {
    // Step 1: save a direction under the victim's address, carrying the lure.
    const saved = await saveDirection(post("/api/pulse/save-direction", JSON.stringify({
      lead: { name: "Account Security", contact: VICTIM, method: "Email" },
      answers: [LURE],
      recommendedModules: [LURE],
    })));
    expect(saved.status).toBe(200);
    const { pulseId } = await saved.json();

    // Step 2: ask ACEVA to email the "blueprint" to that address.
    const mailed = await emailBlueprint(post("/api/pulse/email-blueprint", JSON.stringify({ pulseId, contact: VICTIM })));
    expect(mailed.status).toBe(503);

    // The only email that left is the lead notification to ACEVA's own inbox.
    const recipients = send.mock.calls.map((call) => (call[0] as { to: string }).to);
    expect(recipients).toEqual([TEAM]);
    expect(recipients).not.toContain(VICTIM);
  });
});

describe("the confirmation step is switched off with it", () => {
  beforeEach(() => {
    send.mockReset();
    resetRateLimitStore();
    vi.stubEnv("RESEND_API_KEY", "test-key");
  });

  it("refuses every confirmation before reading the token or the store", async () => {
    const token = "A".repeat(43);
    const response = await confirmBlueprint(post("/api/pulse/email-blueprint/confirm", JSON.stringify({ token })));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("FEATURE_DISABLED");
    expect(store.reads).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("serves no verification page", () => {
    expect(() => VerifyPage()).toThrow();
  });
});
