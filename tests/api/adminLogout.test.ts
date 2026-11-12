import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPgliteSql } from "../helpers/pgliteSql";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "@/app/api/admin/logout/route";
import { hashIp } from "@/lib/admin/auth";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";
import { ensureAdminTables } from "@/lib/admin/tables";
import { resetRateLimitStore } from "@/lib/rateLimit";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const URL_ = "https://aceva.test/api/admin/logout";

let db: PGlite;
let close: () => Promise<void>;
let sharedSql: SqlClient;

function logout(headers: Record<string, string> = {}): Request {
  return new Request(URL_, { method: "POST", headers: { "x-forwarded-for": "203.0.113.5", ...headers } });
}

async function withSession(headers: Record<string, string> = {}): Promise<Request> {
  return logout({ cookie: `${getAdminCookieName()}=${await createSessionToken()}`, ...headers });
}

async function auditRows() {
  const result = await db.query<{ action: string; actor: string }>("SELECT action, actor FROM admin_audit_log ORDER BY id");
  return result.rows;
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
  resetRateLimitStore();
  await db.query("DELETE FROM admin_audit_log");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/logout", () => {
  it("clears the cookie and audits the sign-out of a valid session", async () => {
    const response = await POST(await withSession());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");

    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^aceva_admin_session=;/);
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=strict/i);

    expect(await auditRows()).toEqual([{ action: "logout", actor: `admin:${hashIp("203.0.113.5")}` }]);
  });

  it("clears the cookie even when the session is missing, garbage or expired, and does not audit", async () => {
    const expired = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    const cases = [
      logout(),
      logout({ cookie: `${getAdminCookieName()}=garbage` }),
      logout({ cookie: `${getAdminCookieName()}=${expired}` }),
      logout({ cookie: "unrelated=1" }),
    ];
    for (const request of cases) {
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie") ?? "").toMatch(/^aceva_admin_session=;.*Max-Age=0/);
    }
    expect(await auditRows()).toEqual([]);
  });

  it("clears the production cookie with every attribute the __Host- prefix demands", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(await withSession());
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^__Host-aceva_admin_session=;/);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=0/);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("refuses a cross-origin request and leaves the cookie alone", async () => {
    const response = await POST(await withSession({ origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN_ORIGIN");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await auditRows()).toEqual([]);
  });

  it("accepts its own origin", async () => {
    expect((await POST(await withSession({ origin: "https://aceva.test" }))).status).toBe(200);
  });

  it("answers 404 when the console is disabled", async () => {
    const request = await withSession();
    vi.stubEnv("ADMIN_PASSKEY", "");
    const response = await POST(request);
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("still succeeds when the audit write fails", async () => {
    setSqlClientForTests(async () => {
      throw new Error("down");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const response = await POST(await withSession());
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
    } finally {
      setSqlClientForTests(sharedSql);
    }
  });

  it("answers other methods with a JSON 405 and OPTIONS with 204", async () => {
    for (const handler of [GET, HEAD, PUT, PATCH, DELETE]) {
      const response = await handler(new Request(URL_));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST, OPTIONS");
    }
    expect(OPTIONS().status).toBe(204);
  });
});
