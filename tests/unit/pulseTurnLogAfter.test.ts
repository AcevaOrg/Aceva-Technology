import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The analytics write must outlive the response.
 *
 * `logChatTurn` is fire-and-forget by design, but on a serverless host the
 * invocation can be frozen as soon as the response ends, which discards a
 * write that has not settled. Production showed exactly that: seven completed
 * turns in the function logs, five rows in `chat_turns`. The fix hands the
 * in-flight promise to Next's `after`, which keeps the invocation alive until
 * it settles. These tests pin that contract against mocked `after` and a
 * mocked driver; nothing here reaches a database.
 */

const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: afterMock }));

const sqlMock = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []));
vi.mock("@neondatabase/serverless", () => ({ neon: () => sqlMock }));

import { logChatTurn } from "@/lib/pulse/turnLog";
import { clearEnvCache } from "@/lib/pulse/env";

const turn = {
  sessionId: "synthetic-session",
  requestId: "req_after",
  question: "does the write outlive the response?",
  isValid: false,
  isFallback: false,
  streamed: true,
  latencyMs: 12,
};

/** Lets the fire-and-forget chain run to completion. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The INSERT was issued. The DDL runs once per process, so its count is not a stable signal. */
function insertIssued(): boolean {
  return sqlMock.mock.calls.some((call) => {
    const strings = call[0] as TemplateStringsArray | undefined;
    return Array.isArray(strings) && /INSERT INTO chat_turns/i.test(strings.join("?"));
  });
}

describe("logChatTurn keeps the function alive until the write settles", () => {
  beforeEach(() => {
    sqlMock.mockClear();
    afterMock.mockReset();
    // The production path, where writes are not suppressed.
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://mock:mock@mock.invalid/mock");
    // The approved production target, as lib/pulse/dbTarget.ts requires.
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PULSE_DB_ENDPOINT", "mock");
    clearEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers the in-flight write with after()", async () => {
    logChatTurn(turn);
    await settle();

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(afterMock.mock.calls[0][0]).toBeInstanceOf(Promise);
    expect(insertIssued()).toBe(true);
  });

  it("still writes when there is no request scope to extend", async () => {
    // Outside a route handler — a script, a test — Next throws synchronously.
    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope.");
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => logChatTurn(turn)).not.toThrow();
    await settle();

    expect(insertIssued()).toBe(true);
    // The silent fallback is the one failure mode a production check could
    // not otherwise see, so it must be logged.
    expect(warn).toHaveBeenCalledWith(
      "[turnLog] after() unavailable; the write is not kept alive",
      expect.objectContaining({ requestId: "req_after", reason: expect.stringContaining("outside a request scope") })
    );
  });

  it("logs nothing about after() when it accepts the write", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logChatTurn(turn);
    await settle();
    expect(warn).not.toHaveBeenCalledWith("[turnLog] after() unavailable; the write is not kept alive", expect.anything());
  });

  it("hands after() a promise that never rejects, so a failed write cannot fail the response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sqlMock.mockRejectedValueOnce(new Error("neon: connection terminated unexpectedly"));

    logChatTurn(turn);
    const registered = afterMock.mock.calls[0][0] as Promise<unknown>;
    await expect(registered).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      "[turnLog] failed to record chat turn",
      expect.objectContaining({ requestId: "req_after", reason: expect.stringContaining("connection terminated") })
    );
  });

  it("does nothing at all when writes are suppressed", async () => {
    vi.stubEnv("PULSE_DISABLE_TURN_LOG", "1");

    logChatTurn(turn);
    await settle();

    expect(afterMock).not.toHaveBeenCalled();
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
