import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => null,
}));

// Keeps the unit test offline; retrieval falls back to keyword-only scoring.
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

import { generatePulseCompletion } from "@/lib/pulse/llm";
import { clearEnvCache } from "@/lib/pulse/env";
import { resetCircuitBreaker, getPrimaryCircuitStatus } from "@/lib/pulse/circuitBreaker";

const QUESTION = "I want to build a web application for restaurant ordering.";

/** An error the classifier treats as retryable (HTTP 5xx). */
function serverError() {
  return Object.assign(new Error("upstream exploded"), { status: 503 });
}

/** An error the classifier treats as terminal (bad key). */
function authError() {
  return Object.assign(new Error("invalid api key"), { status: 401 });
}

/** A client mistake — our bug, not the provider's. */
function badRequest() {
  return Object.assign(new Error("malformed"), { status: 400 });
}

function completion(text: string) {
  return { choices: [{ message: { content: text } }] };
}

describe("provider resilience", () => {
  beforeEach(() => {
    mockOpenAiCreate.mockReset();
    vi.unstubAllEnvs();
    clearEnvCache();
    resetCircuitBreaker();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  });

  describe("retry", () => {
    it("retries a retryable failure and returns the eventual answer", async () => {
      mockOpenAiCreate
        .mockRejectedValueOnce(serverError())
        .mockResolvedValueOnce(completion("Recovered on the second attempt."));

      const result = await generatePulseCompletion(QUESTION);

      expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
      expect(result.answer).toBe("Recovered on the second attempt.");
      expect(result.isFallback).toBe(false);
    });

    it("gives up after three attempts", async () => {
      mockOpenAiCreate.mockRejectedValue(serverError());

      const result = await generatePulseCompletion(QUESTION);

      expect(mockOpenAiCreate).toHaveBeenCalledTimes(3);
      expect(result.isFallback).toBe(true);
      expect(result.answer).toContain("having trouble responding");
    });

    it("does not retry a terminal failure", async () => {
      mockOpenAiCreate.mockRejectedValue(authError());

      const result = await generatePulseCompletion(QUESTION);

      expect(mockOpenAiCreate).toHaveBeenCalledOnce();
      expect(result.isFallback).toBe(true);
    });

    it("retries an empty completion", async () => {
      mockOpenAiCreate
        .mockResolvedValueOnce(completion(""))
        .mockResolvedValueOnce(completion("Second time lucky."));

      const result = await generatePulseCompletion(QUESTION);

      expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
      expect(result.answer).toBe("Second time lucky.");
    });

    it("never retries once tokens have reached the client", async () => {
      // Retrying mid-stream would print the reply twice on screen.
      mockOpenAiCreate.mockImplementationOnce(async () => ({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: "partial " } }] };
          throw serverError();
        },
      }));

      const tokens: string[] = [];
      const result = await generatePulseCompletion(QUESTION, undefined, undefined, "t", {
        onToken: (delta) => tokens.push(delta),
      });

      expect(mockOpenAiCreate).toHaveBeenCalledOnce();
      expect(tokens).toEqual(["partial "]);
      expect(result.isFallback).toBe(true);
    });

    it("does not retry when the caller aborted", async () => {
      const controller = new AbortController();
      mockOpenAiCreate.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      });

      const result = await generatePulseCompletion(QUESTION, undefined, undefined, "t", {
        signal: controller.signal,
      });

      expect(mockOpenAiCreate).toHaveBeenCalledOnce();
      expect(result.isFallback).toBe(true);
    });
  });

  describe("circuit breaker", () => {
    it("opens after repeated provider failures and stops calling out", async () => {
      mockOpenAiCreate.mockRejectedValue(authError());

      // Each call is one terminal failure; three trips the breaker.
      await generatePulseCompletion(QUESTION);
      await generatePulseCompletion(QUESTION);
      await generatePulseCompletion(QUESTION);
      expect(getPrimaryCircuitStatus().isAvailable).toBe(false);

      mockOpenAiCreate.mockClear();
      const result = await generatePulseCompletion(QUESTION);

      // No network round trip at all while the circuit is open.
      expect(mockOpenAiCreate).not.toHaveBeenCalled();
      expect(result.isFallback).toBe(true);
      expect(result.answer).toContain("currently unavailable");
    });

    it("a success resets the failure count", async () => {
      mockOpenAiCreate.mockRejectedValueOnce(authError());
      await generatePulseCompletion(QUESTION);
      expect(getPrimaryCircuitStatus().failures).toBe(1);

      mockOpenAiCreate.mockResolvedValueOnce(completion("fine now"));
      await generatePulseCompletion(QUESTION);

      expect(getPrimaryCircuitStatus().failures).toBe(0);
      expect(getPrimaryCircuitStatus().isAvailable).toBe(true);
    });

    it("does not count our own malformed request against the provider", async () => {
      // A 400 is our bug; tripping the breaker on it would take the bot down.
      mockOpenAiCreate.mockRejectedValue(badRequest());

      await generatePulseCompletion(QUESTION);
      await generatePulseCompletion(QUESTION);
      await generatePulseCompletion(QUESTION);
      await generatePulseCompletion(QUESTION);

      expect(getPrimaryCircuitStatus().failures).toBe(0);
      expect(getPrimaryCircuitStatus().isAvailable).toBe(true);
    });

    it("does not count a caller abort against the provider", async () => {
      const controller = new AbortController();
      mockOpenAiCreate.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      });

      await generatePulseCompletion(QUESTION, undefined, undefined, "t", { signal: controller.signal });

      expect(getPrimaryCircuitStatus().failures).toBe(0);
    });
  });
});
