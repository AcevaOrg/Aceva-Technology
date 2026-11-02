import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PULSE ID mention while the direction store is down.
 *
 * Before Phase 3, a rejected `getDirection` escaped `generatePulseCompletion`:
 * the buffered route answered 500 and the streamed route sent an in-band
 * INTERNAL_ERROR frame. Since the 30 October 2026 containment the shipped
 * configuration does not read the store for a PULSE ID at all, so an outage
 * cannot surface. The second block switches lookup details on, through a
 * mutable flag, to keep the outage guard on that path covered too. The store
 * is mocked at the module boundary; nothing here reaches a database.
 */

const flags = vi.hoisted(() => ({ blueprintEmail: false, pulseIdLookupDetails: false }));
vi.mock("@/lib/pulse/features", () => ({ PULSE_FEATURES: flags }));

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

const store = vi.hoisted(() => ({ down: true, reads: 0 }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => {
    store.reads += 1;
    if (store.down) throw new Error("neon: connection terminated unexpectedly");
    return null;
  },
}));

const loggedTurns = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/lib/pulse/turnLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/turnLog")>()),
  logChatTurn: (turn: Record<string, unknown>) => {
    loggedTurns.push(turn);
  },
}));

import { POST } from "@/app/api/chat/route";
import { clearEnvCache } from "@/lib/pulse/env";
import { PULSE_ID_LOOKUP_REPLY } from "@/lib/pulse/llm";
import { resetRateLimitStore } from "@/lib/rateLimit";

function chatRequest(message: string, accept?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": crypto.randomUUID(),
  };
  if (accept) headers.accept = accept;
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message, sessionId: "synthetic-session" }),
  });
}

async function readFrames(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((block) =>
      block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    )
    .filter(Boolean)
    .map((payload) => JSON.parse(payload) as Record<string, unknown>);
}

function reset(detailsOn: boolean) {
  flags.pulseIdLookupDetails = detailsOn;
  mockOpenAiCreate.mockReset();
  vi.unstubAllEnvs();
  clearEnvCache();
  resetRateLimitStore();
  loggedTurns.length = 0;
  store.down = true;
  store.reads = 0;
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
}

describe("as shipped: a store outage cannot reach a PULSE ID reply", () => {
  beforeEach(() => reset(false));

  it("answers buffered with the fixed reply and never touches the store", async () => {
    const response = await POST(chatRequest("Can you look up PLS-260826-883 for me?"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer).toBe(PULSE_ID_LOOKUP_REPLY);
    expect(body.isValid).toBe(false);
    expect(store.reads).toBe(0);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("answers streamed with a done frame, not an error frame", async () => {
    const frames = await readFrames(await POST(chatRequest("PLS-260826-883", "text/event-stream")));
    expect(frames.map((frame) => frame.type)).not.toContain("error");
    expect(frames.find((frame) => frame.type === "done")?.answer).toBe(PULSE_ID_LOOKUP_REPLY);
  });

  it("records the turn as a fallback for drop-off analysis", async () => {
    await POST(chatRequest("PLS-260826-883"));
    expect(loggedTurns).toHaveLength(1);
    expect(loggedTurns[0]).toMatchObject({ isFallback: true, isValid: false });
  });
});

describe("with lookup details switched on, the outage guard still holds", () => {
  beforeEach(() => reset(true));

  it("answers with the fixed reply, not a 500, and leaks nothing about the failure", async () => {
    const response = await POST(chatRequest("PLS-260826-883"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(store.reads).toBe(1);
    expect(body.answer).toBe(PULSE_ID_LOOKUP_REPLY);
    expect(body.answer).not.toMatch(/neon|connection terminated/i);
  });
});
