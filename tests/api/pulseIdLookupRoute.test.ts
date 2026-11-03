import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PULSE ID lookup through the real /api/chat route, buffered and streamed,
 * with the shipped feature flags (lookup details off).
 *
 * What a browser receives for an existing ID, someone else's ID, a missing ID
 * and a malformed ID must be identical, must read nothing from the store, and
 * must carry no saved detail. The store is an in-memory mock holding synthetic
 * data only, and the model is mocked so a message that falls through to normal
 * chat stays offline.
 */

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>(), lookups: [] as string[] }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async (pulseId: string) => {
    store.lookups.push(pulseId);
    return store.rows.get(pulseId.trim().toUpperCase()) ?? null;
  },
}));

vi.mock("@/lib/pulse/turnLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/turnLog")>()),
  logChatTurn: () => undefined,
}));

import { POST } from "@/app/api/chat/route";
import { clearEnvCache } from "@/lib/pulse/env";
import { PULSE_ID_LOOKUP_REPLY } from "@/lib/pulse/llm";
import { resetRateLimitStore } from "@/lib/rateLimit";
import { setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";

const VALID_ID = "PLS-261030-201";

function request(message: string, stream = false) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": crypto.randomUUID(),
  };
  if (stream) headers.accept = "text/event-stream";
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message, sessionId: "synthetic-visitor-b" }),
  });
}

async function read(response: Response, stream: boolean): Promise<{ answer: string; isValid: boolean }> {
  if (!stream) {
    const body = await response.json();
    return { answer: body.answer as string, isValid: body.isValid as boolean };
  }
  const frames = (await response.text())
    .split("\n\n")
    .map((block) => block.replace(/^data:\s*/, "").trim())
    .filter(Boolean)
    .map((payload) => JSON.parse(payload) as { type: string; answer?: string; isValid?: boolean });
  const done = frames.find((frame) => frame.type === "done");
  return { answer: done?.answer ?? "", isValid: Boolean(done?.isValid) };
}

/** Everything a visitor other than the owner must never see. */
const PRIVATE = [
  /Example Street/,
  /Synthetic Bakery/,
  /7700\s?900456/,
  /Orders arrive by phone/,
  /synthetic\.owner@/,
  /Synthetic Owner/,
  /\$15k/,
  /6 Weeks/,
  /Restaurant/,
  /Digital Ordering/,
];

describe("PULSE ID lookup through /api/chat, as shipped", () => {
  beforeEach(() => {
    mockOpenAiCreate.mockReset();
    mockOpenAiCreate.mockResolvedValue({ choices: [{ message: { content: "Tell me about your project." } }] });
    vi.unstubAllEnvs();
    clearEnvCache();
    resetRateLimitStore();
    setRateLimitStoreForTests(null);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    store.lookups.length = 0;
    store.rows.clear();
    store.rows.set(VALID_ID, {
      pulseId: VALID_ID,
      lead: { name: "Synthetic Owner", contact: "synthetic.owner@example.test", method: "Email" },
      context: { industry: "Hospitality & Restaurant", intent: "Start something new", timeline: "6 Weeks", budget: "$15k" },
      answers: ["We are Synthetic Bakery at 9 Example Street, call me on +44 7700 900456", "Orders arrive by phone and get lost"],
      recommendedModules: ["Digital Ordering & Menu Catalog Engine — web menu and cart."],
      createdAt: "2026-10-30T10:00:00.000Z",
    });
  });

  for (const stream of [false, true]) {
    const mode = stream ? "streamed" : "buffered";

    it(`${mode}: an existing and a missing ID get byte-identical answers`, async () => {
      const existing = await read(await POST(request(`Can you pull up ${VALID_ID.toLowerCase()}?`, stream)), stream);
      const missing = await read(await POST(request("Can you pull up pls-261030-999?", stream)), stream);

      expect(existing.answer).toBe(PULSE_ID_LOOKUP_REPLY);
      expect(missing.answer).toBe(existing.answer);
      expect(existing.isValid).toBe(false);
      for (const secret of PRIVATE) expect(existing.answer).not.toMatch(secret);
      expect(store.lookups, "the store was read").toEqual([]);
      expect(mockOpenAiCreate).not.toHaveBeenCalled();
    });
  }

  it("malformed IDs reveal nothing and never reach the store", async () => {
    for (const message of ["PLS-123", "PLS-26103-201", "PLS-ABCDEF-201", "PLS-261399-201", "Look up PLS-261030-2010"]) {
      const response = await POST(request(message));
      const { answer } = await read(response, false);

      expect(response.status, message).toBe(200);
      for (const secret of PRIVATE) expect(answer, message).not.toMatch(secret);
    }
    expect(store.lookups).toEqual([]);
  });

  it("the frontend's lookup flow, which sends the ID as a chat message, gets the same reply", async () => {
    // PulseMessages' "LOOKUP SAVED PULSE ID" form posts the trimmed ID as a
    // chat message, exactly like this.
    const { answer } = await read(await POST(request(VALID_ID)), false);
    expect(answer).toBe(PULSE_ID_LOOKUP_REPLY);
  });

  it("ordinary chat still reaches the model", async () => {
    const { answer } = await read(await POST(request("We run a bakery and want online ordering")), false);
    expect(answer).toBe("Tell me about your project.");
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();
  });

  it("guessing is still capped at the chat rate limit of 20 a minute per client", async () => {
    const headers = { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" };
    let lastStatus = 0;
    for (let n = 0; n < 21; n++) {
      const id = `PLS-261030-${String(100 + n).padStart(3, "0")}`;
      const response = await POST(
        new Request("https://example.com/api/chat", { method: "POST", headers, body: JSON.stringify({ message: id }) })
      );
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
    expect(store.lookups).toEqual([]);
  });
});

describe("PULSE ID lookups have their own shared limit (R5)", () => {
  function lookup(id: string, headers: Record<string, string>, sessionId?: string) {
    return POST(
      new Request("https://example.com/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ message: id, ...(sessionId ? { sessionId } : {}) }),
      })
    );
  }

  async function statuses(count: number, make: (n: number) => Promise<Response>) {
    const out: number[] = [];
    for (let n = 0; n < count; n++) out.push((await make(n)).status);
    return out;
  }

  beforeEach(() => {
    mockOpenAiCreate.mockReset();
    mockOpenAiCreate.mockResolvedValue({ choices: [{ message: { content: "Tell me about your project." } }] });
    vi.unstubAllEnvs();
    clearEnvCache();
    resetRateLimitStore();
    setRateLimitStoreForTests(null);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  });

  it("a fresh forged x-forwarded-for on every request no longer buys a fresh bucket", async () => {
    const result = await statuses(11, (n) =>
      lookup(`PLS-261030-${100 + n}`, { "x-forwarded-for": crypto.randomUUID() }, crypto.randomUUID())
    );
    expect(result.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(result[10]).toBe(429);
  });

  it("limits one browser session even when it arrives from many addresses", async () => {
    vi.stubEnv("VERCEL", "1");
    const result = await statuses(11, (n) => lookup(`PLS-261030-${100 + n}`, { "x-real-ip": `203.0.113.${n + 1}` }, "one-session"));
    expect(result[9]).toBe(200);
    expect(result[10]).toBe(429);
  });

  it("limits one address even when it rotates session ids", async () => {
    vi.stubEnv("VERCEL", "1");
    const result = await statuses(11, (n) => lookup(`PLS-261030-${100 + n}`, { "x-real-ip": "203.0.113.200" }, `session-${n}`));
    expect(result[9]).toBe(200);
    expect(result[10]).toBe(429);
  });

  it("does not count ordinary chat against the lookup limit", async () => {
    vi.stubEnv("VERCEL", "1");
    const headers = { "x-real-ip": "203.0.113.201" };
    await statuses(10, (n) => lookup(`PLS-261030-${100 + n}`, headers, "s"));
    const chat = await lookup("We run a bakery and want online ordering", headers, "s");
    expect(chat.status).toBe(200);
  });

  it("falls back to a stricter local limit, not to no limit, when the shared store is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setRateLimitStoreForTests({
      hit: async () => {
        throw new Error("store down");
      },
    });
    vi.stubEnv("VERCEL", "1");
    const result = await statuses(6, (n) => lookup(`PLS-261030-${100 + n}`, { "x-real-ip": "203.0.113.202" }, "s2"));
    expect(result.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(result[5]).toBe(429);
    // Ordinary chat is unaffected by the outage.
    expect((await lookup("We run a bakery and want online ordering", { "x-real-ip": "203.0.113.202" }, "s2")).status).toBe(200);
  });
});
