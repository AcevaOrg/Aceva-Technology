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

describe("Pulse Response Quality, Tone, & Accuracy Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue(
      "That sounds like a great project. What are the key features and target audience for your application?"
    );
  });

  it("1. Greetings & Casual Check-ins: Provides polite, natural greeting and invites project discovery (isValid: false)", async () => {
    for (const msg of ["Hi", "Hello", "How are you doing?", "Good morning"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/hello|doing great|welcome|build/i);
    }
  });

  it("2. Company FAQ & Capabilities: Provides clear, professional description of ACEVA's services (isValid: false)", async () => {
    for (const msg of ["What does ACEVA do?", "Where is ACEVA located?", "What is ACEVA Technologies?"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toContain("ACEVA Technologies is a digital engineering agency");
      expect(data.answer).toMatch(/web platforms|mobile apps|software systems/i);
    }
  });

  it("3. General Tech Trivia: Acknowledges topic politely and redirects back to project discovery (isValid: false)", async () => {
    const triviaQuestions = [
      "What is the difference between Java and Python?",
      "Why was Ruby popular in the 2010s?",
      "Why is Python popular?",
    ];
    for (const msg of triviaQuestions) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/interesting|specifically designed|software project/i);
    }
  });

  it("4. General Knowledge & Math: Polite rejection returning to project discovery (isValid: false)", async () => {
    for (const msg of ["What is the capital of France?", "Calculate 25*25", "How deep is the ocean?"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/specifically designed|software project|build/i);
    }
  });

  it("5. Nonsense & Gibberish: Natural, non-punitive clarification request (isValid: false)", async () => {
    for (const msg of ["hdgjsabdasvjvdahs", "asdfghjkl", "qazxswedc"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toContain("I didn't quite catch that.");
      expect(data.answer).toContain("project description or specific question");
    }
  });

  it("6. Explicit Single Requirement: Returns isValid: true and engages in technical discovery", async () => {
    const response = await POST(createChatRequest({ message: "I want to build a mobile app for my restaurant." }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
    expect(data.answer).toBeTruthy();
    expect(mockGeneratePulseCompletion).toHaveBeenCalled();
  });

  it("7. Mixed Intent Input: Returns isValid: true and extracts valid project info", async () => {
    const response = await POST(
      createChatRequest({ message: "Hi, I need a mobile app for my restaurant. Also, how does Python work?" })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
    expect(mockGeneratePulseCompletion).toHaveBeenCalled();
  });

  it("8. Direct Negotiation / Answer Preference: Returns isValid: true for direct team alignment answers", async () => {
    const response = await POST(
      createChatRequest({ message: "I will discuss budget with the ACEVA team directly" })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
  });
});
