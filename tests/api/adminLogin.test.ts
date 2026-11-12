import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPgliteSql } from "../helpers/pgliteSql";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "@/app/api/admin/login/route";
import { hashIp } from "@/lib/admin/auth";
import { MIN_PASSKEY_LENGTH } from "@/lib/admin/config";
import { ensureAdminTables } from "@/lib/admin/tables";
import { resetLoginThrottleMemory, setLoginFailureDelayForTests } from "@/lib/admin/throttle";
import { verifySessionToken } from "@/lib/admin/session";
import { resetRateLimitStore } from "@/lib/rateLimit";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const URL_ = "https://aceva.test/api/admin/login";

let db: PGlite;
let close: () => Promise<void>;
let sharedSql: SqlClient;
let delays = 0;
let ipCounter = 0;

function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function login(body: unknown, headers: Record<string, string> = {}, ip = "198.51.100.200"): Request {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie") ?? "";
}

function tokenFrom(response: Response): string {
  const match = cookieFrom(response).match(/aceva_admin_session=([^;]+)/);
  return match ? match[1] : "";
}

async function auditActions(): Promise<string[]> {
  const result = await db.query<{ action: string }>("SELECT action FROM admin_audit_log ORDER BY id");
  return result.rows.map((r) => r.action);
}

beforeAll(async () => {
  const pg = await createPgliteSql();
  db = pg.db;
  close = pg.close;
  sharedSql = pg.sql;
  setSqlClientForTests(pg.sql);
  await ensureAdminTables();
}, 30_000);

afterAll(async () => {
  setSqlClientForTests(null);
  await close();
});

beforeEach(async () => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_SESSION_HOURS", "8");
  resetRateLimitStore();
  resetLoginThrottleMemory();
  delays = 0;
  setLoginFailureDelayForTests(async () => {
    delays += 1;
  });
  await db.query("DELETE FROM admin_login_attempts");
  await db.query("DELETE FROM admin_audit_log");
  // withRouteErrorHandling logs every expected rejection; keep the test output readable.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLoginFailureDelayForTests(null);
});

describe("POST /api/admin/login: success", () => {
  it("accepts the pass key, answers with the destination and sets a valid session cookie", async () => {
    const response = await POST(login({ passkey: PASSKEY }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, next: "/admin" });
    expect(response.headers.get("cache-control")).toBe("no-store");

    const verdict = await verifySessionToken(tokenFrom(response));
    expect(verdict.valid).toBe(true);
    if (verdict.valid) expect(verdict.expiresAt - verdict.issuedAt).toBe(8 * 3600 * 1000);
    expect(delays).toBe(0);
  });

  it("sets HttpOnly, SameSite=Strict and Path=/ with no Secure and no Domain outside production", async () => {
    const header = cookieFrom(await POST(login({ passkey: PASSKEY })));
    expect(header).toMatch(/^aceva_admin_session=v1\./);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=strict/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=28800/);
    expect(header).not.toMatch(/Secure/i);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("sets the __Host- cookie with Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const header = cookieFrom(await POST(login({ passkey: PASSKEY })));
    expect(header).toMatch(/^__Host-aceva_admin_session=v1\./);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=strict/i);
    expect(header).toMatch(/Path=\//);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("follows ADMIN_SESSION_HOURS", async () => {
    vi.stubEnv("ADMIN_SESSION_HOURS", "2");
    const response = await POST(login({ passkey: PASSKEY }));
    expect(cookieFrom(response)).toMatch(/Max-Age=7200/);
  });

  it("tolerates surrounding whitespace in the submitted key", async () => {
    expect((await POST(login({ passkey: `  ${PASSKEY}\n` }))).status).toBe(200);
  });

  it("echoes a safe next and replaces an unsafe one with /admin", async () => {
    const safe = await POST(login({ passkey: PASSKEY, next: "/admin/documents?tab=files" }, {}, freshIp()));
    expect((await safe.json()).next).toBe("/admin/documents?tab=files");

    for (const hostile of ["//evil.com", "https://evil.com", "/admin/login", "/\\evil.com", "javascript:alert(1)", "/admin/../x", 42, null, {}]) {
      const response = await POST(login({ passkey: PASSKEY, next: hostile }, {}, freshIp()));
      expect((await response.json()).next, JSON.stringify(hostile)).toBe("/admin");
    }
  });

  it("audits login.success with a hashed actor and never the key", async () => {
    await POST(login({ passkey: PASSKEY }, {}, "203.0.113.7"));
    const rows = await db.query<{ action: string; actor: string; detail: unknown }>("SELECT action, actor, detail FROM admin_audit_log");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].action).toBe("login.success");
    expect(rows.rows[0].actor).toBe(`admin:${hashIp("203.0.113.7")}`);
    expect(JSON.stringify(rows.rows)).not.toContain(PASSKEY);
    expect(JSON.stringify(rows.rows)).not.toContain("203.0.113.7");
  });
});

describe("POST /api/admin/login: rejection", () => {
  async function rejection(body: unknown, ip = freshIp()) {
    const response = await POST(login(body, {}, ip));
    const data = await response.json();
    return { response, data };
  }

  it("answers 401 UNAUTHENTICATED, sets no cookie and waits", async () => {
    const { response, data } = await rejection({ passkey: "wrong-wrong-wrong-wrong" });
    expect(response.status).toBe(401);
    expect(cookieFrom(response)).toBe("");
    expect(data).toMatchObject({ ok: false, code: "UNAUTHENTICATED", retryable: false });
    expect(data.requestId).toMatch(/^req_/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(delays).toBe(1);
  });

  it("gives an identical answer whether the key was empty, short, long, close or the wrong type", async () => {
    const attempts: unknown[] = [
      "",
      "x",
      "short",
      PASSKEY.slice(0, -1),
      `${PASSKEY}x`,
      `${PASSKEY.slice(0, -1)}B`,
      PASSKEY.toLowerCase(),
      "a".repeat(300),
      12345,
      null,
      true,
      [PASSKEY],
      { passkey: PASSKEY },
    ];
    const seen = new Set<string>();
    for (const passkey of attempts) {
      const { response, data } = await rejection({ passkey });
      expect(response.status, JSON.stringify(passkey)?.slice(0, 40)).toBe(401);
      seen.add(JSON.stringify({ error: data.error, code: data.code, retryable: data.retryable, keys: Object.keys(data).sort() }));
    }
    expect(seen.size).toBe(1);
    expect([...seen][0]).not.toMatch(/short|long|close|length|character|typo/i);
  });

  it("treats a missing passkey field like any other wrong key", async () => {
    const { response, data } = await rejection({});
    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHENTICATED");
  });

  it("audits login.failure without the attempted key", async () => {
    await rejection({ passkey: "my-secret-guess-1234" });
    expect(await auditActions()).toEqual(["login.failure"]);
    const rows = await db.query("SELECT * FROM admin_audit_log");
    expect(JSON.stringify(rows.rows)).not.toContain("my-secret-guess");
  });

  it("never logs the attempted or the real pass key", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "info")];
    for (const spy of spies) spy.mockImplementation(() => undefined);
    await rejection({ passkey: "my-secret-guess-1234" });
    await POST(login({ passkey: PASSKEY }, {}, freshIp()));
    const output = spies.flatMap((spy) => spy.mock.calls.map((call) => JSON.stringify(call))).join("\n");
    expect(output).not.toContain("my-secret-guess");
    expect(output).not.toContain(PASSKEY);
  });
});

describe("POST /api/admin/login: disabled console", () => {
  it("answers 404 NOT_FOUND to everything, even the right key, and sets no cookie", async () => {
    for (const value of ["", "   ", "x".repeat(MIN_PASSKEY_LENGTH - 1)]) {
      vi.stubEnv("ADMIN_PASSKEY", value);
      const response = await POST(login({ passkey: value || PASSKEY }));
      expect(response.status, value).toBe(404);
      expect((await response.json()).code).toBe("NOT_FOUND");
      expect(cookieFrom(response)).toBe("");
    }
    expect(delays).toBe(0);
    expect(await auditActions()).toEqual([]);
  });

  it("does not even look at the body, origin or content type", async () => {
    vi.stubEnv("ADMIN_PASSKEY", "");
    const response = await POST(
      new Request(URL_, { method: "POST", headers: { "content-type": "text/plain", origin: "https://evil.example" }, body: "x" }),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/admin/login: lockout", () => {
  it("locks a client after five failures, persistently, and reports a long retryAfter", async () => {
    const ip = freshIp();
    for (let i = 1; i <= 5; i += 1) {
      resetRateLimitStore(); // isolate the persistent lockout from the per-minute limiter
      const response = await POST(login({ passkey: `wrong-guess-number-${i}` }, {}, ip));
      expect(response.status, `attempt ${i}`).toBe(401);
    }

    resetRateLimitStore();
    const locked = await POST(login({ passkey: PASSKEY }, {}, ip));
    expect(locked.status).toBe(429);
    const data = await locked.json();
    expect(data).toMatchObject({ ok: false, code: "RATE_LIMITED", retryable: true });
    // The in-process limiter would say at most 60 seconds; the persistent lock says about 15 minutes.
    expect(data.retryAfter).toBeGreaterThan(60);
    expect(data.retryAfter).toBeLessThanOrEqual(900);
    expect(locked.headers.get("retry-after")).toBe(String(data.retryAfter));
    expect(cookieFrom(locked)).toBe("");

    // Even the correct key is refused while locked, and it does not extend the lock.
    resetRateLimitStore();
    const again = await POST(login({ passkey: PASSKEY }, {}, ip));
    expect(again.status).toBe(429);
  });

  it("audits login.locked on the failure that trips the lock", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      resetRateLimitStore();
      await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip));
    }
    expect(await auditActions()).toEqual(["login.failure", "login.failure", "login.failure", "login.failure", "login.locked"]);
  });

  it("answers the tripping failure with the same generic 401, not a revealing 429", async () => {
    const ip = freshIp();
    let last: Response | undefined;
    for (let i = 0; i < 5; i += 1) {
      resetRateLimitStore();
      last = await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip));
    }
    expect(last?.status).toBe(401);
  });

  it("does not lock other clients", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      resetRateLimitStore();
      await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip));
    }
    const other = await POST(login({ passkey: PASSKEY }, {}, freshIp()));
    expect(other.status).toBe(200);
  });

  it("a successful sign-in resets the failure count", async () => {
    const ip = freshIp();
    for (let i = 0; i < 4; i += 1) {
      resetRateLimitStore();
      await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip));
    }
    resetRateLimitStore();
    expect((await POST(login({ passkey: PASSKEY }, {}, ip))).status).toBe(200);

    // Four more failures would have been the 5th-8th. None of them locks, and the right key still works.
    for (let i = 0; i < 4; i += 1) {
      resetRateLimitStore();
      expect((await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip))).status).toBe(401);
    }
    resetRateLimitStore();
    expect((await POST(login({ passkey: PASSKEY }, {}, ip))).status).toBe(200);
  });

  it("lets the client back in after the lock expires", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      resetRateLimitStore();
      await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip));
    }
    await db.query("UPDATE admin_login_attempts SET locked_until = now() - interval '1 second'");
    resetRateLimitStore();
    expect((await POST(login({ passkey: PASSKEY }, {}, ip))).status).toBe(200);
  });

  it("applies the per-minute in-process limiter first, with a short retryAfter", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      // Right key: the persistent throttle never sees a failure, only the in-process limiter counts.
      expect((await POST(login({ passkey: PASSKEY }, {}, ip))).status).toBe(200);
    }
    const limited = await POST(login({ passkey: PASSKEY }, {}, ip));
    expect(limited.status).toBe(429);
    const data = await limited.json();
    expect(data.code).toBe("RATE_LIMITED");
    expect(data.retryAfter).toBeGreaterThan(0);
    expect(data.retryAfter).toBeLessThanOrEqual(60);
  });
});

describe("POST /api/admin/login: request hygiene", () => {
  it("rejects a cross-origin request before touching the pass key", async () => {
    const response = await POST(login({ passkey: PASSKEY }, { origin: "https://evil.example" }, freshIp()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN_ORIGIN");
    expect(cookieFrom(response)).toBe("");
  });

  it("accepts the request's own origin", async () => {
    expect((await POST(login({ passkey: PASSKEY }, { origin: "https://aceva.test" }, freshIp()))).status).toBe(200);
  });

  it("rejects a malformed Origin header", async () => {
    expect((await POST(login({ passkey: PASSKEY }, { origin: "not a url" }, freshIp()))).status).toBe(403);
  });

  it("rejects non-JSON content types with 415", async () => {
    const response = await POST(login("passkey=abc", { "content-type": "application/x-www-form-urlencoded" }, freshIp()));
    expect(response.status).toBe(415);
    const text = await POST(login("{}", { "content-type": "text/plain" }, freshIp()));
    expect(text.status).toBe(415);
  });

  it("rejects an oversized body with 413, by declared length and by streamed length", async () => {
    const big = JSON.stringify({ passkey: PASSKEY, padding: "x".repeat(2_100) });
    expect(big.length).toBeGreaterThan(2_048);
    const declared = await POST(login(big, {}, freshIp()));
    expect(declared.status).toBe(413);
    expect((await declared.json()).code).toBe("PAYLOAD_TOO_LARGE");

    // No Content-Length: the limit must still hold while streaming.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    // `duplex` is required by undici for streamed bodies and is not in every DOM typing.
    const init = {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": freshIp() },
      body: stream,
      duplex: "half",
    } as RequestInit;
    const streamed = await POST(new Request(URL_, init));
    expect(streamed.status).toBe(413);
  });

  it("accepts a body just under 2 KB", async () => {
    const body = JSON.stringify({ passkey: PASSKEY, next: `/admin/${"a".repeat(250)}` });
    expect(body.length).toBeLessThan(2_048);
    expect((await POST(login(body, {}, freshIp()))).status).toBe(200);
  });

  it("rejects malformed JSON and non-object bodies with 400", async () => {
    for (const body of ["{not json", "null", "[]", '"a string"', "42"]) {
      const response = await POST(login(body, {}, freshIp()));
      expect(response.status, body).toBe(400);
      expect((await response.json()).code).toBe("INVALID_JSON");
    }
  });

  it("answers other methods with a JSON 405 and OPTIONS with 204", async () => {
    for (const handler of [GET, HEAD, PUT, PATCH, DELETE]) {
      const response = await handler(new Request(URL_));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST, OPTIONS");
    }
    const body = await GET(new Request(URL_)).json();
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
    const options = OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("POST, OPTIONS");
  });
});

describe("POST /api/admin/login: database outage", () => {
  const broken: SqlClient = async () => {
    throw new Error("connection to postgresql://user:hunter2@ep-secret.neon.tech/db failed");
  };

  beforeEach(() => {
    setSqlClientForTests(broken);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    setSqlClientForTests(sharedSql);
    resetLoginThrottleMemory();
  });

  it("still signs the owner in", async () => {
    const response = await POST(login({ passkey: PASSKEY }, {}, freshIp()));
    expect(response.status).toBe(200);
    expect((await verifySessionToken(tokenFrom(response))).valid).toBe(true);
  });

  it("still rejects a wrong key, and still locks after five failures (in memory)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      resetRateLimitStore();
      expect((await POST(login({ passkey: "wrong-guess-number-x" }, {}, ip))).status).toBe(401);
    }
    resetRateLimitStore();
    const locked = await POST(login({ passkey: PASSKEY }, {}, ip));
    expect(locked.status).toBe(429);
    expect((await locked.json()).retryAfter).toBeGreaterThan(60);
  });

  it("never leaks the connection string", async () => {
    const response = await POST(login({ passkey: "wrong-guess-number-x" }, {}, freshIp()));
    expect(JSON.stringify(await response.json())).not.toMatch(/hunter2|postgresql|neon\.tech/);
  });
});
