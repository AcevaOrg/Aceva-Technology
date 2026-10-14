import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

import { POST } from "@/app/api/chat/route";
import { readSseFrames } from "@/components/pulse/PulseContext";
import { resetRateLimitStore } from "@/lib/rateLimit";

const VALID_ANSWER = "We run three restaurants and want direct online ordering";

function chatRequest(body: unknown, accept?: string) {
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

const SSE = "text/event-stream, application/json";

/** Drains a streamed response into the frames the client would see. */
async function frames(response: Response) {
  const out: Record<string, unknown>[] = [];
  for await (const frame of readSseFrames(response.body as ReadableStream<Uint8Array>)) {
    out.push(frame as unknown as Record<string, unknown>);
  }
  return out;
}

/** Emits `tokens` through the route's onToken sink, then resolves. */
function streamingCompletion(tokens: string[], isFallback = false) {
  return async (..._args: unknown[]) => {
    const options = _args[4] as { onToken?: (t: string) => void } | undefined;
    for (const token of tokens) options?.onToken?.(token);
    return { answer: tokens.join(""), isFallback };
  };
}

describe("/api/chat streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
  });

  it("streams deltas then a done frame carrying the authoritative answer", async () => {
    mockGeneratePulseCompletion.mockImplementation(streamingCompletion(["Three ", "locations ", "noted."]));

    const response = await POST(chatRequest({ message: VALID_ANSWER }, SSE));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    const received = await frames(response);
    expect(received.filter((f) => f.type === "delta").map((f) => f.text)).toEqual([
      "Three ",
      "locations ",
      "noted.",
    ]);

    const done = received.at(-1);
    expect(done?.type).toBe("done");
    expect(done?.answer).toBe("Three locations noted.");
    expect(done?.isValid).toBe(true);
  });

  it("passes an onToken sink and the request signal to the model layer", async () => {
    mockGeneratePulseCompletion.mockImplementation(streamingCompletion(["x"]));

    await frames(await POST(chatRequest({ message: VALID_ANSWER }, SSE)));

    const options = mockGeneratePulseCompletion.mock.calls[0][4] as Record<string, unknown>;
    expect(typeof options.onToken).toBe("function");
    expect(options.signal).toBeDefined();
  });

  it("marks a fallback reply isValid: false and still emits it as a delta", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({
      answer: "PULSE is currently unavailable. Please try again later.",
      isFallback: true,
    });

    const received = await frames(await POST(chatRequest({ message: VALID_ANSWER }, SSE)));

    // No tokens came from the provider, so the route supplies one delta itself.
    expect(received.filter((f) => f.type === "delta")).toHaveLength(1);
    const done = received.at(-1);
    expect(done?.type).toBe("done");
    expect(done?.isValid).toBe(false);
    expect(done?.answer).toContain("currently unavailable");
  });

  it("reports a mid-stream failure in-band, not as an HTTP status", async () => {
    mockGeneratePulseCompletion.mockImplementation(async (..._args: unknown[]) => {
      const options = _args[4] as { onToken?: (t: string) => void } | undefined;
      options?.onToken?.("partial ");
      throw new Error("provider exploded");
    });

    const response = await POST(chatRequest({ message: VALID_ANSWER }, SSE));
    // Headers were already sent, so the status cannot change.
    expect(response.status).toBe(200);

    const received = await frames(response);
    expect(received[0]).toEqual({ type: "delta", text: "partial " });

    const last = received.at(-1);
    expect(last?.type).toBe("error");
    expect(last?.code).toBe("INTERNAL_ERROR");
    expect(received.some((f) => f.type === "done")).toBe(false);
  });

  it("streams canned replies through the same protocol", async () => {
    for (const message of ["hi", "asdfghjkl", "Who are you?"]) {
      const received = await frames(await POST(chatRequest({ message }, SSE)));

      expect(received.filter((f) => f.type === "delta")).toHaveLength(1);
      const done = received.at(-1);
      expect(done?.type).toBe("done");
      expect(done?.isValid).toBe(false);
      expect(String(done?.answer).length).toBeGreaterThan(0);
      expect(mockGeneratePulseCompletion).not.toHaveBeenCalled();
    }
  });

  it("applies the closing-statement rewrite to the done frame, not the deltas", async () => {
    // The route strips questions from the final discovery reply after the fact,
    // which is exactly why the client must reconcile to done.answer.
    mockGeneratePulseCompletion.mockImplementation(
      streamingCompletion(["Noted, that is plenty to work with. ", "Shall we proceed?"])
    );

    const received = await frames(
      await POST(
        chatRequest(
          {
            message: "Around $15k",
            history: [{ role: "assistant", content: "What is your budget?" }],
          },
          SSE
        )
      )
    );

    const deltas = received.filter((f) => f.type === "delta").map((f) => f.text).join("");
    const done = received.at(-1);

    expect(deltas).toContain("Shall we proceed?");
    expect(done?.isValid).toBe(true);
    expect(String(done?.answer)).not.toContain("?");
  });
});

describe("/api/chat non-stream fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Buffered reply.", isFallback: false });
  });

  it("returns buffered JSON when the caller does not ask for a stream", async () => {
    const response = await POST(chatRequest({ message: VALID_ANSWER }));

    expect(response.headers.get("content-type")).toContain("application/json");
    const data = await response.json();
    expect(data).toMatchObject({ ok: true, answer: "Buffered reply.", isValid: true });
  });

  it("does not request streaming from the model layer on the buffered path", async () => {
    await POST(chatRequest({ message: VALID_ANSWER }));

    const options = mockGeneratePulseCompletion.mock.calls[0][4] as Record<string, unknown>;
    expect(options.onToken).toBeUndefined();
  });

  it("stays buffered for an Accept header that does not name the stream type", async () => {
    for (const accept of ["application/json", "*/*", "text/plain"]) {
      const response = await POST(chatRequest({ message: VALID_ANSWER }, accept));
      expect(response.headers.get("content-type")).toContain("application/json");
    }
  });

  it("still rejects a bad request as JSON even when a stream was requested", async () => {
    const response = await POST(chatRequest({ nope: 1 }, SSE));

    // Validation happens before the stream is committed, so the status is real.
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe("VALIDATION_FAILED");
  });
});

describe("readSseFrames", () => {
  function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
  }

  async function collect(stream: ReadableStream<Uint8Array>) {
    const out: unknown[] = [];
    for await (const frame of readSseFrames(stream)) out.push(frame);
    return out;
  }

  it("parses whole frames", async () => {
    const parsed = await collect(
      streamOf('data: {"type":"delta","text":"a"}\n\ndata: {"type":"done","answer":"a","isValid":true}\n\n')
    );
    expect(parsed).toEqual([
      { type: "delta", text: "a" },
      { type: "done", answer: "a", isValid: true },
    ]);
  });

  it("reassembles a frame split across chunk boundaries", async () => {
    // Network chunking does not respect frame boundaries.
    const parsed = await collect(streamOf('data: {"type":"del', 'ta","text":"split"}', "\n\n"));
    expect(parsed).toEqual([{ type: "delta", text: "split" }]);
  });

  it("keeps going past a malformed frame", async () => {
    const parsed = await collect(
      streamOf('data: {oops\n\ndata: {"type":"done","answer":"ok","isValid":false}\n\n')
    );
    expect(parsed).toEqual([{ type: "done", answer: "ok", isValid: false }]);
  });

  it("ignores comments, blank frames and a trailing partial", async () => {
    const parsed = await collect(
      streamOf(': keep-alive\n\n\n\ndata: {"type":"delta","text":"x"}\n\ndata: {"type":"de')
    );
    expect(parsed).toEqual([{ type: "delta", text: "x" }]);
  });

  it("preserves text that contains newlines and colons", async () => {
    const payload = JSON.stringify({ type: "delta", text: "line one\nline: two" });
    const parsed = await collect(streamOf(`data: ${payload}\n\n`));
    expect(parsed).toEqual([{ type: "delta", text: "line one\nline: two" }]);
  });
});
