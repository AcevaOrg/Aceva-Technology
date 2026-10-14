import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

// The direction store talks to Neon. Tests must never need a live database, so
// stand it up as an in-memory map with the same async contract.
const directionRows = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async (direction: { pulseId: string }) => {
    directionRows.set(direction.pulseId.trim().toUpperCase(), direction);
  },
  getDirection: async (pulseId: string) => directionRows.get(pulseId.trim().toUpperCase()) ?? null,
}));

// generateEmbedding calls the OpenAI embeddings endpoint for real whenever an
// API key is present, and these tests stub one in. That put a live network
// round trip inside a unit test — slow, and flaky when it timed out. Returning
// null is the documented "API unavailable" path, so retrieval falls back to
// keyword-only scoring and stays deterministic and offline.
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

import { generatePulseCompletion, keepCompetitiveChunks, diversifySources } from "@/lib/pulse/llm";
import { clearEnvCache } from "@/lib/pulse/env";
import { OUT_OF_SCOPE_REJECTION } from "@/lib/pulse/scope";
import { saveDirection } from "@/lib/pulse/directionStore";

describe("PULSE LLM Provider", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearEnvCache();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  });

  it("returns OpenAI answer on success", async () => {
    mockOpenAiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "ACEVA builds custom software." } }],
    });
    const result = await generatePulseCompletion("What software capabilities does ACEVA offer for custom app development?");
    expect(result.answer).toBe("ACEVA builds custom software.");
    expect(result.isFallback).toBe(false);
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();
  });

  it("resolves saved PULSE ID lookup without calling OpenAI", async () => {
    await saveDirection({
      pulseId: "PLS-260826-883",
      lead: { name: "Test Lead", contact: "test@example.com", method: "Email" },
      context: { industry: "Restaurant", intent: "Online Ordering" },
      recommendedModules: ["Digital menu", "Order tracking"],
      createdAt: new Date().toISOString(),
    });

    const result = await generatePulseCompletion("Tell me about PLS-260826-883");
    expect(result.answer).toContain("PLS-260826-883");
    expect(result.answer).toContain("Restaurant");
    // A lookup is not an answer to a discovery question.
    expect(result.isFallback).toBe(true);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("never discloses the saved lead name or contact for a PULSE ID", async () => {
    await saveDirection({
      pulseId: "PLS-260826-884",
      lead: { name: "Jordan Ellis", contact: "jordan@example.com", method: "Email" },
      context: { industry: "Logistics", intent: "Automate something" },
      recommendedModules: ["Dispatch control tower"],
      createdAt: new Date().toISOString(),
    });

    const result = await generatePulseCompletion("PLS-260826-884");

    // The project context is still returned — only the lead identity is withheld.
    expect(result.answer).toContain("PLS-260826-884");
    expect(result.answer).toContain("Dispatch control tower");
    expect(result.answer).not.toContain("Jordan Ellis");
    expect(result.answer).not.toContain("jordan@example.com");
    expect(result.answer).not.toMatch(/client name/i);
    expect(result.answer).not.toMatch(/contact info/i);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("passes multi-turn history to OpenAI payload", async () => {
    mockOpenAiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "It will take 4 weeks." } }],
    });

    const history = [
      { role: "user" as const, content: "I want a restaurant website" },
      { role: "assistant" as const, content: "We can build that for you." },
    ];

    const result = await generatePulseCompletion("How long will it take to build this software?", history);
    expect(result.answer).toBe("It will take 4 weeks.");
    expect(result.isFallback).toBe(false);
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();

    const callArgs = mockOpenAiCreate.mock.calls[0][0];
    expect(callArgs.messages.length).toBeGreaterThan(2);
  });

  it("returns friendly error when OpenAI fails with 429", async () => {
    const err = new Error("rate limit");
    (err as unknown as { status: number }).status = 429;
    mockOpenAiCreate.mockRejectedValueOnce(err);
    const result = await generatePulseCompletion("How do you build custom mobile apps?");
    expect(result.answer).toBe("I'm having trouble responding right now. Please try again in a moment.");
    expect(result.isFallback).toBe(true);
  });

  it("rejects out-of-scope without calling OpenAI", async () => {
    const result = await generatePulseCompletion("What is the capital of France?");
    expect(result.answer).toBe(OUT_OF_SCOPE_REJECTION);
    expect(result.isFallback).toBe(true);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("returns unavailable when API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    clearEnvCache();
    const result = await generatePulseCompletion("How do you build custom mobile apps?");
    expect(result.answer).toBe("PULSE is currently unavailable. Please try again later.");
    expect(result.isFallback).toBe(true);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("answers a message that mixes a real requirement with an off-topic aside", async () => {
    // This used to be rejected on the general-programming pattern by two gates
    // in a row — this module's own invalid/unclear check and the scope check —
    // throwing away a requirement that /api/chat had deliberately let through.
    mockOpenAiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "A restaurant mobile app — let's map that out." } }],
    });

    const result = await generatePulseCompletion(
      "Hi, I need a mobile app for my restaurant. Also, how does Python work?"
    );

    expect(result.isFallback).toBe(false);
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();
  });

  it("still rejects the same aside with no requirement attached", async () => {
    const result = await generatePulseCompletion("How does Python work?");

    expect(result.answer).toBe(OUT_OF_SCOPE_REJECTION);
    expect(result.isFallback).toBe(true);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });
});

describe("no single knowledge file monopolises the context window", () => {
  const hit = (id: string, score: number) =>
    ({ score, chunk: { id } } as unknown as Parameters<typeof diversifySources>[0][number]);
  const ids = (results: ReturnType<typeof diversifySources>) =>
    results.map((r) => (r.chunk as unknown as { id: string }).id);

  it("caps one file at three chunks and fills the rest from elsewhere", () => {
    // The real shape of "What technologies do you use?": ten consecutive
    // sections of tech-stack-and-architecture.md scoring 0.680-0.706, which
    // took all five slots. capabilities.md's "Technology guidance" section —
    // the one that actually lists the stack — never reached the model, so the
    // reply opened by claiming it had no confirmed information.
    const kept = diversifySources([
      hit("tech-stack-and-architecture-chunk-11", 0.706),
      hit("tech-stack-and-architecture-chunk-13", 0.7),
      hit("tech-stack-and-architecture-chunk-10", 0.694),
      hit("tech-stack-and-architecture-chunk-6", 0.693),
      hit("tech-stack-and-architecture-chunk-9", 0.685),
      hit("tech-stack-and-architecture-chunk-3", 0.683),
      hit("capabilities-chunk-3", 0.67),
      hit("company-chunk-1", 0.62),
    ]);

    expect(ids(kept)).toEqual([
      "tech-stack-and-architecture-chunk-11",
      "tech-stack-and-architecture-chunk-13",
      "tech-stack-and-architecture-chunk-10",
      "capabilities-chunk-3",
      "company-chunk-1",
    ]);
  });

  it("leaves a question whose answer really is three sections of one file alone", () => {
    // "Do you sign NDAs?" is answered by all three sections of
    // nda-and-confidentiality.md. The cap must not break that.
    const kept = diversifySources([
      hit("nda-and-confidentiality-chunk-1", 0.77),
      hit("nda-and-confidentiality-chunk-2", 0.625),
      hit("nda-and-confidentiality-chunk-3", 0.585),
      hit("tech-stack-and-architecture-chunk-12", 0.311),
      hit("comprehensive-project-guides-chunk-12", 0.289),
    ]);

    expect(ids(kept)).toHaveLength(5);
    expect(ids(kept).filter((id) => id.startsWith("nda-"))).toHaveLength(3);
  });

  it("preserves score order and returns at most five", () => {
    const kept = diversifySources(
      Array.from({ length: 30 }, (_, i) => hit(`file${i % 7}-chunk-${i}`, 1 - i / 100))
    );

    expect(kept).toHaveLength(5);
    const scores = kept.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("passes a short or empty result set through", () => {
    expect(diversifySources([])).toEqual([]);
    expect(ids(diversifySources([hit("a-chunk-1", 0.9), hit("b-chunk-1", 0.5)]))).toEqual([
      "a-chunk-1",
      "b-chunk-1",
    ]);
  });
});

describe("retrieved context is held to a relevance band", () => {
  /** Only `score` matters here; the chunk is a label for the assertion. */
  const hit = (id: string, score: number) =>
    ({ score, chunk: { id } } as unknown as Parameters<typeof keepCompetitiveChunks>[0][number]);

  const ids = (results: ReturnType<typeof keepCompetitiveChunks>) =>
    results.map((r) => (r.chunk as unknown as { id: string }).id);

  it("drops chunks detached from the best match", () => {
    // The real shape of "Do you sign NDAs?": three chunks from
    // nda-and-confidentiality.md, then session security and a feature list with
    // nothing to say about NDAs — all five previously handed to the model under
    // the heading "Retrieved Official ACEVA Knowledge Context".
    const kept = keepCompetitiveChunks([
      hit("nda-1", 0.77),
      hit("nda-2", 0.625),
      hit("nda-3", 0.585),
      hit("tech-stack-12", 0.311),
      hit("guides-12", 0.289),
    ]);

    expect(ids(kept)).toEqual(["nda-1", "nda-2", "nda-3"]);
  });

  it("keeps a chunk that is merely a little behind the best match", () => {
    // rescue-sprint.md at 0.436 against product-rescue.md at 0.687 answers
    // "Can you rescue a half-finished app?" and must survive.
    const kept = keepCompetitiveChunks([
      hit("product-rescue-1", 0.687),
      hit("product-rescue-2", 0.57),
      hit("how-aceva-helps-3", 0.478),
      hit("rescue-sprint-1", 0.436),
      hit("how-aceva-helps-2", 0.392),
    ]);

    expect(ids(kept)).toContain("rescue-sprint-1");
  });

  it("never prunes below three chunks, however weak the top match", () => {
    // "Are you hiring?" tops out at 0.189 against careers.md and is still the
    // right answer, so a weak top score must not starve the model.
    const kept = keepCompetitiveChunks([
      hit("careers-2", 0.189),
      hit("careers-3", 0.161),
      hit("careers-1", 0.151),
      hit("how-aceva-helps-24", 0.042),
      hit("guides-12", 0.039),
    ]);

    expect(kept.length).toBeGreaterThanOrEqual(3);
  });

  it("passes short result sets through untouched", () => {
    expect(keepCompetitiveChunks([])).toEqual([]);
    expect(ids(keepCompetitiveChunks([hit("a", 0.9), hit("b", 0.1)]))).toEqual(["a", "b"]);
  });
});
