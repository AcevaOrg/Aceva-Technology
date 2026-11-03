import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Analytics across every response path of /api/chat (P2, 30 October 2026).
 *
 * The model layer and the turn-log write are mocked: `logChatTurn` is a spy,
 * so these tests see exactly which turns the route reports, without any
 * database. All data is synthetic.
 */

const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

const logged = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@/lib/pulse/turnLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/turnLog")>()),
  logChatTurn: (turn: Record<string, unknown>) => {
    logged.push(turn);
  },
}));

import { POST } from "@/app/api/chat/route";
import { readSseFrames } from "@/components/pulse/PulseContext";
import { resetRateLimitStore } from "@/lib/rateLimit";
import { setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";

const PROJECT_ANSWER = "We run three restaurants and want direct online ordering";
const SSE = "text/event-stream, application/json";

function chat(body: Record<string, unknown>, stream = false) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (stream) headers.accept = SSE;
  return POST(
    new Request("https://example.com/api/chat", { method: "POST", headers, body: JSON.stringify(body) })
  );
}

async function drain(response: Response) {
  const frames: Record<string, unknown>[] = [];
  for await (const frame of readSseFrames(response.body as ReadableStream<Uint8Array>)) {
    frames.push(frame as unknown as Record<string, unknown>);
  }
  return frames;
}

function tokens(list: string[], isFallback = false) {
  return async (..._args: unknown[]) => {
    const options = _args[4] as { onToken?: (t: string) => void } | undefined;
    for (const token of list) options?.onToken?.(token);
    return { answer: list.join(""), isFallback };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  logged.length = 0;
  resetRateLimitStore();
  setRateLimitStoreForTests(null);
});

describe("each response path logs exactly one turn", () => {
  it("canned, buffered", async () => {
    const response = await chat({ message: "Hi", sessionId: "s-canned-b" });
    expect(response.status).toBe(200);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ sessionId: "s-canned-b", targetField: "canned", isFallback: true, streamed: false });
    expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
  });

  it("canned, streamed", async () => {
    await drain(await chat({ message: "Hi", sessionId: "s-canned-s" }, true));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ sessionId: "s-canned-s", targetField: "canned", streamed: true });
  });

  it("model turn, buffered", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });
    const response = await chat({ message: PROJECT_ANSWER, sessionId: "s-buffered", step: 0 });
    expect(response.status).toBe(200);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ sessionId: "s-buffered", streamed: false, isFallback: false, step: 0 });
    expect(typeof logged[0].requestId).toBe("string");
  });

  it("model turn, streamed", async () => {
    mockGeneratePulseCompletion.mockImplementation(tokens(["Three ", "noted."]));
    await drain(await chat({ message: PROJECT_ANSWER, sessionId: "s-streamed" }, true));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ sessionId: "s-streamed", streamed: true, isFallback: false });
  });

  it("fallback, streamed", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "PULSE is currently unavailable.", isFallback: true });
    await drain(await chat({ message: PROJECT_ANSWER, sessionId: "s-fallback" }, true));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ isFallback: true, isValid: false });
  });

  it("mid-stream failure: one failed turn, reported in-band", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGeneratePulseCompletion.mockImplementation(async (..._args: unknown[]) => {
      (_args[4] as { onToken?: (t: string) => void }).onToken?.("partial ");
      throw new Error("provider exploded");
    });
    const frames = await drain(await chat({ message: PROJECT_ANSWER, sessionId: "s-fail" }, true));
    expect(frames.at(-1)?.type).toBe("error");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ errorCode: "INTERNAL_ERROR", streamed: true });
  });

  it("buffered failure: one failed turn, and the route still answers with an error status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGeneratePulseCompletion.mockRejectedValue(new Error("provider exploded"));
    const response = await chat({ message: PROJECT_ANSWER, sessionId: "s-fail-b" });
    expect(response.status).toBe(500);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ errorCode: "INTERNAL_ERROR", streamed: false });
  });
});

describe("duplicates and disconnects", () => {
  it("a visitor who disconnects mid-stream yields one completed turn, not a second failed one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let settled!: () => void;
    const finished = new Promise<void>((resolve) => (settled = resolve));

    mockGeneratePulseCompletion.mockImplementation(async (..._args: unknown[]) => {
      (_args[4] as { onToken?: (t: string) => void }).onToken?.("First ");
      await gate;
      setTimeout(settled, 0);
      return { answer: "First answer.", isFallback: false };
    });

    const response = await chat({ message: PROJECT_ANSWER, sessionId: "s-disconnect" }, true);
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    await reader.read();
    await reader.cancel();
    release();
    await finished;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ sessionId: "s-disconnect", isFallback: false });
    expect(logged[0].errorCode).toBeUndefined();
  });

  it("ten turns in one session give ten turns with distinct request ids, all on that session", async () => {
    mockGeneratePulseCompletion.mockImplementation(tokens(["ok"]));
    for (let n = 0; n < 10; n++) {
      await drain(await chat({ message: `${PROJECT_ANSWER} number ${n}`, sessionId: "s-ten" }, n % 2 === 0));
    }
    expect(logged).toHaveLength(10);
    expect(new Set(logged.map((turn) => turn.requestId)).size).toBe(10);
    expect(logged.every((turn) => turn.sessionId === "s-ten")).toBe(true);
  });

  it("keeps sessions apart and labels a missing session anonymous", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });
    await chat({ message: PROJECT_ANSWER, sessionId: "s-a" });
    await chat({ message: PROJECT_ANSWER, sessionId: "s-b" });
    await chat({ message: PROJECT_ANSWER });
    expect(logged.map((turn) => turn.sessionId)).toEqual(["s-a", "s-b", "anonymous"]);
  });

  it("lets a short follow-up reach the model only when there is a conversation to refer back to", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Yes.", isFallback: false });
    const history = [
      { role: "user", content: PROJECT_ANSWER },
      { role: "assistant", content: "Direct ordering fits. How many orders a day?" },
    ];
    await chat({ message: "Can you do that?", sessionId: "s-follow", history });
    expect(mockGeneratePulseCompletion).toHaveBeenCalledOnce();

    mockGeneratePulseCompletion.mockClear();
    await chat({ message: "Can you do that?", sessionId: "s-opener" });
    expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
  });

  it("does not log requests that never became turns", async () => {
    await chat({ message: "" });
    await POST(new Request("https://example.com/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" }));
    expect(logged).toHaveLength(0);
  });
});
