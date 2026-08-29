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

  it("returns 200 and answer for valid message payload", async () => {
    const response = await POST(createChatRequest({ message: "What is ACEVA?" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ answer: "**ACEVA Official Answer**", isValid: true });
    expect(mockGeneratePulseCompletion).toHaveBeenCalledOnce();
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
