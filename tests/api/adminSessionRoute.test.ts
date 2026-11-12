import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "@/app/api/admin/session/route";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken, verifySessionToken } from "@/lib/admin/session";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const URL_ = "https://aceva.test/api/admin/session";

function ask(cookie?: string): Request {
  return new Request(URL_, { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/admin/session", () => {
  it("reports an anonymous visitor as not authenticated, with 200", async () => {
    const response = await GET(ask());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, authenticated: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports a valid session with its expiry", async () => {
    const token = await createSessionToken();
    const verdict = await verifySessionToken(token);
    const response = await GET(ask(`${getAdminCookieName()}=${token}`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ ok: true, authenticated: true, expiresAt: verdict.valid ? verdict.expiresAt : -1 });
    expect(data.expiresAt).toBeGreaterThan(Date.now());
  });

  it("never answers 401: expired, tampered and garbage sessions are just not authenticated", async () => {
    const expired = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    const good = await createSessionToken();
    const tampered = `${good.slice(0, -2)}${good.endsWith("AA") ? "BB" : "AA"}`;
    for (const cookie of [
      `${getAdminCookieName()}=${expired}`,
      `${getAdminCookieName()}=${tampered}`,
      `${getAdminCookieName()}=garbage`,
      `${getAdminCookieName()}=`,
      "other=1",
    ]) {
      const response = await GET(ask(cookie));
      expect(response.status, cookie).toBe(200);
      expect(await response.json(), cookie).toEqual({ ok: true, authenticated: false });
    }
  });

  it("does not accept a session signed for a different pass key", async () => {
    const token = await createSessionToken();
    vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
    const response = await GET(ask(`${getAdminCookieName()}=${token}`));
    expect(await response.json()).toEqual({ ok: true, authenticated: false });
  });

  it("answers 404 when the console is disabled", async () => {
    const token = await createSessionToken();
    vi.stubEnv("ADMIN_PASSKEY", "");
    const response = await GET(ask(`${getAdminCookieName()}=${token}`));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });

  it("does not set or clear any cookie", async () => {
    const response = await GET(ask());
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers other methods with a JSON 405 and OPTIONS with 204", async () => {
    for (const handler of [POST, PUT, PATCH, DELETE]) {
      const response = await handler(new Request(URL_, { method: "POST" }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, OPTIONS");
    }
    expect(OPTIONS().status).toBe(204);
  });
});
