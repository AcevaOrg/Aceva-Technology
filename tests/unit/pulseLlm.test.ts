import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

import { generatePulseCompletion } from "@/lib/pulse/llm";
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
    expect(result).toBe("ACEVA builds custom software.");
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();
  });

  it("resolves saved PULSE ID lookup without calling OpenAI", async () => {
    saveDirection({
      pulseId: "PLS-260826-883",
      lead: { name: "Test Lead", contact: "test@example.com", method: "Email" },
      context: { industry: "Restaurant", intent: "Online Ordering" },
      recommendedModules: ["Digital menu", "Order tracking"],
      createdAt: new Date().toISOString(),
    });

    const result = await generatePulseCompletion("Tell me about PLS-260826-883");
    expect(result).toContain("PLS-260826-883");
    expect(result).toContain("Test Lead");
    expect(result).toContain("Restaurant");
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
    expect(result).toBe("It will take 4 weeks.");
    expect(mockOpenAiCreate).toHaveBeenCalledOnce();

    const callArgs = mockOpenAiCreate.mock.calls[0][0];
    expect(callArgs.messages.length).toBeGreaterThan(2);
  });

  it("returns friendly error when OpenAI fails with 429", async () => {
    const err = new Error("rate limit");
    (err as unknown as { status: number }).status = 429;
    mockOpenAiCreate.mockRejectedValueOnce(err);
    const result = await generatePulseCompletion("How do you build custom mobile apps?");
    expect(result).toBe("I'm having trouble responding right now. Please try again in a moment.");
  });

  it("rejects out-of-scope without calling OpenAI", async () => {
    const result = await generatePulseCompletion("What is the capital of France?");
    expect(result).toBe(OUT_OF_SCOPE_REJECTION);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });

  it("returns unavailable when API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    clearEnvCache();
    const result = await generatePulseCompletion("How do you build custom mobile apps?");
    expect(result).toBe("PULSE is currently unavailable. Please try again later.");
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
  });
});
