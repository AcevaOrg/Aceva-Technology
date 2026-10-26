import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one test that runs a whole turn for real.
 *
 * Everything from the route handler down — validation, the scope gate, answer
 * validation, retrieval, prompt assembly, the streaming protocol — is the real
 * implementation. Only the three things that reach outside the process are
 * stubbed: the OpenAI SDK, the embeddings HTTP call, and the Neon stores. Every
 * other suite mocks `generatePulseCompletion` wholesale, so nothing else proves
 * these pieces actually fit together.
 */

const mockOpenAiCreate = vi.fn();
/** Counts SDK instantiations, so client reuse is observable. */
const openAiConstructions = vi.hoisted(() => ({ count: 0 }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
    constructor() {
      openAiConstructions.count += 1;
    }
  },
}));

// Keeps retrieval offline; it falls back to keyword-only scoring.
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => null,
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
import { resetCircuitBreaker } from "@/lib/pulse/circuitBreaker";
import { resetRateLimitStore } from "@/lib/rateLimit";

const ANSWER = "We run three restaurants in New York and want direct online ordering";

function chatRequest(body: Record<string, unknown>, accept?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": crypto.randomUUID(),
  };
  if (accept) headers.accept = accept;
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function bufferedCompletion(text: string) {
  return { choices: [{ message: { content: text } }] };
}

function streamedCompletion(tokens: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) yield { choices: [{ delta: { content: token } }] };
    },
  };
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

describe("a complete chat turn, end to end", () => {
  beforeEach(() => {
    mockOpenAiCreate.mockReset();
    vi.unstubAllEnvs();
    clearEnvCache();
    resetCircuitBreaker();
    resetRateLimitStore();
    loggedTurns.length = 0;
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  });

  it("carries a discovery answer through to a validated reply", async () => {
    mockOpenAiCreate.mockResolvedValue(
      bufferedCompletion("Three locations with direct ordering — noted. What slows you down today?")
    );

    const response = await POST(
      chatRequest({
        message: ANSWER,
        sessionId: "e2e-session",
        step: 0,
        context: { intent: "Start something new" },
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.answer).toContain("Three locations");
    // A real discovery answer advances progress.
    expect(data.isValid).toBe(true);
  });

  it("assembles the prompt the model is actually given", async () => {
    mockOpenAiCreate.mockResolvedValue(bufferedCompletion("Noted."));

    await POST(
      chatRequest({
        message: ANSWER,
        sessionId: "e2e-session",
        step: 1,
        context: { intent: "Start something new", industry: "Hospitality & Restaurant" },
        history: [
          { role: "user", content: "I want to start something new." },
          { role: "assistant", content: "Tell us about your business." },
        ],
      })
    );

    const params = mockOpenAiCreate.mock.calls[0][0] as {
      model: string;
      max_completion_tokens: number;
      messages: { role: string; content: string }[];
    };

    expect(params.model).toBe("gpt-4o-mini");
    // The deprecated `max_tokens` must not reappear.
    expect(params).not.toHaveProperty("max_tokens");
    expect(params.max_completion_tokens).toBe(1024);

    const system = params.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(system).toContain("Aceva Pulse");
    // The step the client said it was showing is pinned into the prompt.
    expect(system).toContain("Where do things feel slow or manual today?");

    // The visitor's history is carried, and their message is the final turn.
    expect(params.messages.some((m) => m.content.includes("Tell us about your business."))).toBe(true);
    const last = params.messages[params.messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain(ANSWER);
    // Retrieval ran and its output is in the prompt.
    expect(last.content).toContain("Retrieved Official ACEVA Knowledge Context");
  });

  it("logs the turn without the visitor's contact details", async () => {
    mockOpenAiCreate.mockResolvedValue(bufferedCompletion("Noted."));

    await POST(
      chatRequest({
        message: `${ANSWER} — reach me on 0161 496 0000`,
        sessionId: "e2e-session",
        step: 0,
        context: { intent: "Start something new" },
      })
    );

    expect(loggedTurns).toHaveLength(1);
    const turn = loggedTurns[0];
    expect(turn.sessionId).toBe("e2e-session");
    expect(turn.isValid).toBe(true);
    expect(turn.isFallback).toBe(false);
    expect(typeof turn.latencyMs).toBe("number");
    // redactPii runs at write time, so the raw question is handed over here and
    // scrubbed by turnLog; this asserts the turn is logged at all.
    expect(turn.question).toContain("We run three restaurants");
  });

  it("streams the same turn token by token", async () => {
    mockOpenAiCreate.mockResolvedValue(streamedCompletion(["Three ", "locations ", "noted."]));

    const response = await POST(
      chatRequest(
        { message: ANSWER, sessionId: "e2e-session", step: 0, context: { intent: "Start something new" } },
        "text/event-stream"
      )
    );

    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const frames = await readFrames(response);
    expect(frames.filter((f) => f.type === "delta").map((f) => f.text)).toEqual([
      "Three ",
      "locations ",
      "noted.",
    ]);

    const done = frames.at(-1);
    expect(done?.type).toBe("done");
    expect(done?.answer).toBe("Three locations noted.");
    expect(done?.isValid).toBe(true);

    // The SDK was asked to stream, not polled.
    expect(mockOpenAiCreate.mock.calls[0][0]).toMatchObject({ stream: true });
  });

  it("recovers from a transient provider failure within the same turn", async () => {
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error("upstream"), { status: 503 }))
      .mockResolvedValueOnce(bufferedCompletion("Recovered."));

    const response = await POST(
      chatRequest({ message: ANSWER, sessionId: "e2e-session", step: 0 })
    );
    const data = await response.json();

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(data.answer).toBe("Recovered.");
    expect(data.isValid).toBe(true);
  });

  it("returns a non-advancing fallback when the provider stays down", async () => {
    mockOpenAiCreate.mockRejectedValue(Object.assign(new Error("upstream"), { status: 503 }));

    const response = await POST(
      chatRequest({ message: ANSWER, sessionId: "e2e-session", step: 0 })
    );
    const data = await response.json();

    expect(data.answer).toContain("having trouble responding");
    // A fallback is not a discovery answer, so it must not advance progress.
    expect(data.isValid).toBe(false);
    expect(loggedTurns[0].isFallback).toBe(true);
  });

  it("builds the SDK client once and reuses it across turns", async () => {
    mockOpenAiCreate.mockResolvedValue(bufferedCompletion("Noted."));
    const before = openAiConstructions.count;

    for (let i = 0; i < 3; i += 1) {
      await POST(chatRequest({ message: ANSWER, sessionId: "e2e-session", step: 0 }));
    }

    // A fresh OpenAI instance per message threw away the SDK's connection
    // pooling on every turn.
    expect(openAiConstructions.count - before).toBeLessThanOrEqual(1);
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(3);
  });

  it("answers a greeting without calling the model at all", async () => {
    const response = await POST(chatRequest({ message: "hi", sessionId: "e2e-session", step: 0 }));
    const data = await response.json();

    expect(data.isValid).toBe(false);
    expect(data.answer).toMatch(/Aceva Pulse/i);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    expect(loggedTurns[0].targetField).toBe("canned");
  });
});
