import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The database target guard (P2, 30 October 2026) and the observability of
 * turn-log writes. The Neon driver is mocked; every host below is synthetic.
 */

const sqlMock = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []));
vi.mock("@neondatabase/serverless", () => ({ neon: () => sqlMock }));
vi.mock("next/server", () => ({ after: () => undefined }));

import { checkDatabaseTarget, endpointIdFromHost } from "@/lib/pulse/dbTarget";
import { DatabaseUnavailableError, getSql } from "@/lib/pulse/db";
import { clearEnvCache } from "@/lib/pulse/env";
import { getDirection } from "@/lib/pulse/directionStore";
import { logChatTurn, recordChatTurn } from "@/lib/pulse/turnLog";

const PROD = "ep-prod-synthetic-123456";
const PREVIEW = "ep-preview-synthetic-654321";
const url = (endpoint: string, pooled = true) =>
  `postgresql://role:secret-password@${endpoint}${pooled ? "-pooler" : ""}.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`;

/** Leaves the test-runner rule, so the deployment rules apply. */
function asDeployment(env: Record<string, string>) {
  vi.stubEnv("VITEST", "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  sqlMock.mockClear();
  clearEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  clearEnvCache();
});

describe("endpoint ids", () => {
  it("are the same for the pooled and direct hosts", () => {
    expect(endpointIdFromHost(`${PROD}-pooler.c-2.us-east-1.aws.neon.tech`)).toBe(PROD);
    expect(endpointIdFromHost(`${PROD}.c-2.us-east-1.aws.neon.tech`)).toBe(PROD);
  });
});

describe("the database target guard", () => {
  it("refuses every real host under the test runner", () => {
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: false, reason: "test-runner" });
    expect(checkDatabaseTarget("postgresql://mock:mock@mock.invalid/mock").ok).toBe(true);
  });

  it("refuses when no endpoint has been approved", () => {
    asDeployment({ VERCEL_ENV: "production" });
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: false, reason: "endpoint-unconfigured" });
  });

  it("lets production use exactly its approved endpoint", () => {
    asDeployment({ VERCEL_ENV: "production", PULSE_DB_ENDPOINT: PROD, PULSE_DB_PRODUCTION_ENDPOINT: PROD });
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: true, endpoint: PROD });
    expect(checkDatabaseTarget(url(PROD, false)).ok).toBe(true);
    expect(checkDatabaseTarget(url(PREVIEW))).toMatchObject({ ok: false, reason: "endpoint-mismatch" });
  });

  it("refuses production if its approved endpoint disagrees with the declared production one", () => {
    asDeployment({ VERCEL_ENV: "production", PULSE_DB_ENDPOINT: PREVIEW, PULSE_DB_PRODUCTION_ENDPOINT: PROD });
    expect(checkDatabaseTarget(url(PREVIEW))).toMatchObject({ ok: false, reason: "endpoint-mismatch" });
  });

  it("refuses a preview still wired to the production database, the situation found in the audit", () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PREVIEW, PULSE_DB_PRODUCTION_ENDPOINT: PROD });
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: false, reason: "endpoint-mismatch" });
  });

  it("refuses a preview approved for the production endpoint by mistake", () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PROD, PULSE_DB_PRODUCTION_ENDPOINT: PROD });
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: false, reason: "production-database-outside-production" });
  });

  it("refuses a preview that cannot prove it is off production", () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PREVIEW });
    expect(checkDatabaseTarget(url(PREVIEW))).toMatchObject({ ok: false, reason: "production-endpoint-unknown" });
  });

  it("lets a preview use its own branch", () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PREVIEW, PULSE_DB_PRODUCTION_ENDPOINT: PROD });
    expect(checkDatabaseTarget(url(PREVIEW))).toMatchObject({ ok: true, runtime: "preview" });
  });

  it("refuses local development on production unless an operator opts in from a workstation", () => {
    asDeployment({ PULSE_DB_ENDPOINT: PROD, PULSE_DB_PRODUCTION_ENDPOINT: PROD, VERCEL_ENV: "" });
    expect(checkDatabaseTarget(url(PROD))).toMatchObject({ ok: false, runtime: "local", reason: "production-database-outside-production" });

    vi.stubEnv("PULSE_DB_ALLOW_PRODUCTION", "1");
    expect(checkDatabaseTarget(url(PROD)).ok).toBe(true);

    vi.stubEnv("VERCEL", "1");
    expect(checkDatabaseTarget(url(PROD)).ok).toBe(false);
  });

  it("never honours the operator opt-in on a preview", () => {
    asDeployment({ VERCEL_ENV: "preview", VERCEL: "1", PULSE_DB_ENDPOINT: PROD, PULSE_DB_PRODUCTION_ENDPOINT: PROD, PULSE_DB_ALLOW_PRODUCTION: "1" });
    expect(checkDatabaseTarget(url(PROD)).ok).toBe(false);
  });

  it("refuses a malformed connection string", () => {
    asDeployment({ VERCEL_ENV: "production", PULSE_DB_ENDPOINT: PROD });
    expect(checkDatabaseTarget("not a url")).toMatchObject({ ok: false, reason: "invalid-url" });
  });
});

describe("refusals fail safely and say nothing secret", () => {
  it("getSql throws a DatabaseUnavailableError naming the reason, never the URL or host", () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PREVIEW, PULSE_DB_PRODUCTION_ENDPOINT: PROD, DATABASE_URL: url(PROD) });
    let error: unknown;
    try {
      getSql();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    const message = (error as Error).message;
    expect(message).toContain("endpoint-mismatch");
    expect(message).not.toContain(PROD);
    expect(message).not.toContain("secret-password");
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("stores refuse before any query", async () => {
    asDeployment({ VERCEL_ENV: "preview", PULSE_DB_ENDPOINT: PREVIEW, PULSE_DB_PRODUCTION_ENDPOINT: PROD, DATABASE_URL: url(PROD) });
    await expect(getDirection("PLS-261030-7KQ2-M9XD")).rejects.toBeInstanceOf(DatabaseUnavailableError);
    await expect(
      recordChatTurn({ sessionId: "s", requestId: "r", question: "q", isValid: false, isFallback: false, streamed: false, latencyMs: 1 })
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe("turn-log observability", () => {
  function productionTarget() {
    asDeployment({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      PULSE_DB_ENDPOINT: "mock",
      DATABASE_URL: "postgresql://mock:mock@mock.invalid/mock",
    });
  }
  const turn = {
    sessionId: "synthetic-session",
    requestId: "req-observable",
    question: "Call me on +44 7700 900456 about my bakery",
    isValid: true,
    isFallback: false,
    streamed: true,
    latencyMs: 10,
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("logs one 'recorded' line per stored row, with the request id and nothing the visitor typed", async () => {
    productionTarget();
    sqlMock.mockResolvedValue([{ id: "1" }]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logChatTurn(turn);
    await flush();
    expect(info).toHaveBeenCalledWith("[turnLog] recorded", { requestId: "req-observable" });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/bakery|7700/);
  });

  it("reports a repeat for the same request as a duplicate, not a second row", async () => {
    productionTarget();
    sqlMock.mockResolvedValue([]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logChatTurn(turn);
    await flush();
    expect(info).toHaveBeenCalledWith("[turnLog] duplicate ignored", { requestId: "req-observable" });
  });

  it("writes only if no row exists for the request id", async () => {
    productionTarget();
    sqlMock.mockResolvedValue([{ id: "1" }]);
    await recordChatTurn(turn);
    const insert = sqlMock.mock.calls.find((call) => /INSERT INTO chat_turns/.test((call[0] as string[]).join("?")));
    expect((insert?.[0] as string[]).join("?")).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM chat_turns WHERE request_id = \?::text\)/);
  });

  it("logs a failed write as '[turnLog] failed' without the question or the connection string", async () => {
    productionTarget();
    sqlMock.mockRejectedValue(new Error("neon: connection terminated unexpectedly"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => logChatTurn(turn)).not.toThrow();
    await flush();
    expect(error.mock.calls[0][0]).toBe("[turnLog] failed to record chat turn");
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toMatch(/bakery|7700|mock:mock/);
  });
});
