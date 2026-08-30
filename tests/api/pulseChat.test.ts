import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock generatePulseCompletion
const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

import { POST } from "@/app/api/chat/route";

function createChatRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue("**ACEVA Official Answer**");
  });

  it("returns 200 and isValid: false for casual FAQ or greeting input", async () => {
    const response = await POST(createChatRequest({ message: "What is ACEVA Technologies?" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(false);
  });

  it("returns 200 and isValid: false for non-discovery queries, general knowledge, ACEVA internal inquiries, and incoherent questions", async () => {
    const nonDiscoveryQueries = [
      "Hi",
      "Hello",
      "How are you?",
      "Who are you, you",
      "Java 8 is better than Java 26",
      "What is Java?",
      "What is Python?",
      "What does Python do?",
      "Why was Python created?",
      "Explain how blockchain works.",
      "What is the difference between Java and Python?",
      "Why was Ruby popular in the 2010s?",
      "What is the capital of France?",
      "How does the stock market work?",
      "Who invented the telephone?",
      "What does ACEVA do?",
      "How is ACEVA works?",
      "Who works at ACEVA?",
      "Who is the lead at ACEVA?",
      "Who is the CEO of ACEVA?",
      "Who is Shiva?",
      "Tell me about Shiva",
    ];
    for (const msg of nonDiscoveryQueries) {
      const response = await POST(createChatRequest({ message: msg, history: [{ role: "user", content: "Prev message" }] }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
    }
  });

  it("returns 200 and isValid: false for gibberish or random character input", async () => {
    for (const gibberish of ["hdgjsabdasvjvdahs", "asdfghjkl", "xyz123abc"]) {
      const response = await POST(createChatRequest({ message: gibberish }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
    }
  });

  it("returns 200 and isValid: true for explicit project scope, refactoring, and discovery step answers", async () => {
    const projectInputs = [
      "I want to build a web application for restaurant ordering.",
      "I want to improve my Java code from Java to Kotlin",
      "We need to rebuild our mobile app for iOS and Android",
      "I will discuss that with ACEVA's team directly",
      "We run three neighborhood restaurants in New York",
      "Flexible timeline and budget window",
    ];
    for (const msg of projectInputs) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(true);
    }
  });

  it("returns 400 when message field is missing", async () => {
    const response = await POST(createChatRequest({ query: "What is ACEVA?" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Missing or invalid 'message' field");
    expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
  });

  it("returns 400 when message is empty", async () => {
    const response = await POST(createChatRequest({ message: "   " }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("'message' cannot be empty");
    expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
  });

  it("returns 400 when message exceeds 1000 characters", async () => {
    const longMessage = "a".repeat(1001);
    const response = await POST(createChatRequest({ message: longMessage }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("exceeds maximum length");
    expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
  });

  it("returns 400 when JSON body is malformed", async () => {
    const req = new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: "{ invalid json ",
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid JSON request body");
  });
});
