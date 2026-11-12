import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `next/headers` only works inside a request scope, so the page-side guards read from this store.
let cookieJar = new Map<string, string>();
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) as string } : undefined),
  }),
  headers: async () => requestHeaders,
}));

import {
  clearSessionCookie,
  getAdminSession,
  getRequestActor,
  getRequestSession,
  hashIp,
  requireAdminPage,
  requireAdminRequest,
  sanitizeNextPath,
  setSessionCookie,
} from "@/lib/admin/auth";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";
import { ApiError } from "@/lib/api/response";
import { RATE_LIMIT_RULES, resetRateLimitStore } from "@/lib/rateLimit";

const PASSKEY = "correct-horse-battery-staple";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_SESSION_HOURS", "8");
  resetRateLimitStore();
  cookieJar = new Map();
  requestHeaders = new Headers();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function sessionCookieHeader(extra = ""): Promise<string> {
  return `${extra}${getAdminCookieName()}=${await createSessionToken()}`;
}

function request(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

async function thrownCode(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected an ApiError to be thrown");
}

describe("sanitizeNextPath", () => {
  it("keeps a normal admin path, query included", () => {
    for (const path of [
      "/admin",
      "/admin/",
      "/admin/documents",
      "/admin/documents/new",
      "/admin/documents/3f2a?tab=files",
      "/admin/documents?category=certifications&q=100%25",
      "/admin/activity?action=login.failure&limit=50",
      "/admin/verification#top",
    ]) {
      expect(sanitizeNextPath(path), path).toBe(path);
    }
  });

  it("falls back to /admin for anything that is not a string", () => {
    for (const value of [undefined, null, 0, 1, true, {}, [], ["/admin/x"], () => "/admin"]) {
      expect(sanitizeNextPath(value)).toBe("/admin");
    }
  });

  it("rejects the open-redirect corpus", () => {
    const hostile = [
      "//evil.com",
      "//evil.com/admin",
      "///evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "\\/evil.com",
      "/admin\\..\\evil",
      "/admin/\\evil.com",
      "https://evil.com",
      "http://evil.com/admin",
      "HTTPS://evil.com",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "evil.com",
      "admin",
      "admin/documents",
      "",
      " ",
      " /admin",
      "/admin ",
      "/admin\n",
      "/admin\r\nSet-Cookie: a=b",
      "/\t/evil.com",
      "/\n/evil.com",
      "/admin/\u0000",
      "/admin/\u007f",
      "/admin/\u0085",
      "/admin/../..",
      "/admin/../../evil",
      "/admin/./x",
      "/admin/..",
      "/admin/%2e%2e/%2e%2e",
      "/admin/%2E%2E/",
      "/admin/..%2f..%2f",
      "/admin/%2e/x",
      "/admin%2F%2Fevil.com",
      "/admin/%2F%2Fevil.com",
      "/admin//evil.com",
      "/admin//",
      "/admin/x//y",
      "/%2F%2Fevil.com",
      "%2F%2Fevil.com",
      "%2Fevil.com",
      "/%5Cevil.com",
      "/admin/%5Cevil.com",
      "/admin/%5c",
      "/admin/%0d%0aSet-Cookie:a=b",
      "/admin/%09",
      "/admin/%00",
      "/admin/%252e%252e/",
      "/admin/%25252e%25252e/",
      "/admin/%25255c",
      "/admin/%E0%A4%A",
      "/administrator",
      "/adminx",
      "/admin@evil.com",
      "/admin.evil.com",
      "/Admin",
      "/ADMIN/documents",
      "/",
      "/about",
      "/api/admin/documents",
      "/mobile",
      "/admin/login",
      "/admin/login/",
      "/admin/login?next=/admin",
      "/admin/LOGIN",
      "/admin/login/extra",
      "/admin/login#x",
      `/admin/${"a".repeat(300)}`,
    ];
    for (const value of hostile) {
      expect(sanitizeNextPath(value), JSON.stringify(value)).toBe("/admin");
    }
  });

  it("accepts a path exactly at the length limit and rejects one over it", () => {
    const atLimit = `/admin/${"a".repeat(293)}`;
    expect(atLimit).toHaveLength(300);
    expect(sanitizeNextPath(atLimit)).toBe(atLimit);
    expect(sanitizeNextPath(`${atLimit}a`)).toBe("/admin");
  });

  it("allows a literal percent sign that arrives encoded", () => {
    expect(sanitizeNextPath("/admin/documents?q=100%25")).toBe("/admin/documents?q=100%25");
    expect(sanitizeNextPath("/admin/documents?q=a%20b")).toBe("/admin/documents?q=a%20b");
  });

  it("allows a // that only appears inside the query string", () => {
    expect(sanitizeNextPath("/admin/documents?ref=https://example.com")).toBe("/admin/documents?ref=https://example.com");
  });
});

describe("hashIp / getRequestActor", () => {
  it("returns 16 lowercase hex characters, stable per input", () => {
    const hash = hashIp("203.0.113.9");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hashIp("203.0.113.9")).toBe(hash);
    expect(hashIp("203.0.113.10")).not.toBe(hash);
    expect(hash).not.toContain("203");
  });

  it("is keyed: rotating the pass key changes every hash", () => {
    const before = hashIp("203.0.113.9");
    vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
    expect(hashIp("203.0.113.9")).not.toBe(before);
  });

  it("follows ADMIN_SESSION_SECRET when one is set", () => {
    const derived = hashIp("203.0.113.9");
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(40));
    const withSecret = hashIp("203.0.113.9");
    expect(withSecret).not.toBe(derived);
    vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
    expect(hashIp("203.0.113.9")).toBe(withSecret);
  });

  it("does not throw when the console is disabled", () => {
    vi.stubEnv("ADMIN_PASSKEY", "");
    expect(hashIp("203.0.113.9")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("builds the actor from the first forwarded address", () => {
    const actor = getRequestActor(request("https://aceva.test/x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }));
    expect(actor).toBe(`admin:${hashIp("203.0.113.9")}`);
    expect(actor).toMatch(/^admin:[0-9a-f]{16}$/);
    expect(getRequestActor(request("https://aceva.test/x"))).toBe(`admin:${hashIp("unknown")}`);
  });
});

describe("session cookie helpers", () => {
  const token = "v1.1.2.AAAAAAAAAAAAAAAAAAAAAA.signature";

  it("sets HttpOnly, SameSite=Strict, Path=/ and no Secure outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = NextResponse.json({});
    setSessionCookie(response, token);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain(`aceva_admin_session=${token}`);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=strict/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=28800/);
    expect(header).not.toMatch(/Secure/i);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("uses the __Host- name with Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({});
    setSessionCookie(response, token);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain(`__Host-aceva_admin_session=${token}`);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Path=\//);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("honours ADMIN_SESSION_HOURS for Max-Age", () => {
    vi.stubEnv("ADMIN_SESSION_HOURS", "2");
    const response = NextResponse.json({});
    setSessionCookie(response, token);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=7200/);
  });

  it("clears with the same attributes, so a __Host- cookie really is overwritten", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({});
    clearSessionCookie(response);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain("__Host-aceva_admin_session=;");
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/HttpOnly/i);
  });
});

describe("getRequestSession / requireAdminRequest", () => {
  it("returns the session for a valid cookie among others", async () => {
    const cookie = await sessionCookieHeader("theme=dark; ");
    const session = await getRequestSession(request("https://aceva.test/api/admin/x", { headers: { cookie: `${cookie}; other=1` } }));
    expect(session).not.toBeNull();
    expect(session && session.expiresAt > session.issuedAt).toBe(true);
  });

  it("returns null without a cookie, with a bad one, or with a similarly named one", async () => {
    expect(await getRequestSession(request("https://aceva.test/x"))).toBeNull();
    expect(await getRequestSession(request("https://aceva.test/x", { headers: { cookie: "aceva_admin_session=garbage" } }))).toBeNull();
    const token = await createSessionToken();
    expect(await getRequestSession(request("https://aceva.test/x", { headers: { cookie: `x_aceva_admin_session=${token}` } }))).toBeNull();
    expect(await getRequestSession(request("https://aceva.test/x", { headers: { cookie: `aceva_admin_session_2=${token}` } }))).toBeNull();
  });

  it("reads the __Host- cookie in production and ignores the dev name there", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const token = await createSessionToken();
    const hostCookie = request("https://aceva.test/x", { headers: { cookie: `__Host-aceva_admin_session=${token}` } });
    expect(await getRequestSession(hostCookie)).not.toBeNull();
    const devCookie = request("https://aceva.test/x", { headers: { cookie: `aceva_admin_session=${token}` } });
    expect(await getRequestSession(devCookie)).toBeNull();
  });

  it("throws NOT_FOUND when the console is disabled, whatever the cookie says", async () => {
    const cookie = await sessionCookieHeader();
    vi.stubEnv("ADMIN_PASSKEY", "");
    const error = await thrownCode(requireAdminRequest(request("https://aceva.test/api/admin/x", { headers: { cookie } })));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("throws NOT_FOUND on a host outside ADMIN_ALLOWED_HOSTS, even with a valid session", async () => {
    const cookie = await sessionCookieHeader();
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "example.com");
    const elsewhere = request("https://aceva.test/api/admin/x", { headers: { cookie, host: "preview-123.vercel.app" } });
    expect((await thrownCode(requireAdminRequest(elsewhere))).code).toBe("NOT_FOUND");
    const listed = request("https://example.com/api/admin/x", { headers: { cookie, host: "example.com" } });
    await expect(requireAdminRequest(listed)).resolves.toMatchObject({ issuedAt: expect.any(Number) });
  });

  it("throws UNAUTHENTICATED without a valid session", async () => {
    expect((await thrownCode(requireAdminRequest(request("https://aceva.test/api/admin/x")))).code).toBe("UNAUTHENTICATED");
    const bad = request("https://aceva.test/api/admin/x", { headers: { cookie: "aceva_admin_session=v1.1.2.x.y" } });
    expect((await thrownCode(requireAdminRequest(bad))).code).toBe("UNAUTHENTICATED");
  });

  it("rejects an expired session", async () => {
    const token = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    const req = request("https://aceva.test/api/admin/x", { headers: { cookie: `aceva_admin_session=${token}` } });
    expect((await thrownCode(requireAdminRequest(req))).code).toBe("UNAUTHENTICATED");
  });

  it("returns the session for GET and HEAD without an origin check", async () => {
    const cookie = await sessionCookieHeader();
    for (const method of ["GET", "HEAD"]) {
      const session = await requireAdminRequest(
        request("https://aceva.test/api/admin/x", { method, headers: { cookie, origin: "https://evil.example" } }),
      );
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    }
  });

  it("enforces same origin on mutating methods", async () => {
    const cookie = await sessionCookieHeader();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const cross = request("https://aceva.test/api/admin/x", { method, headers: { cookie, origin: "https://evil.example" } });
      expect((await thrownCode(requireAdminRequest(cross))).code, method).toBe("FORBIDDEN_ORIGIN");

      const same = request("https://aceva.test/api/admin/x", { method, headers: { cookie, origin: "https://aceva.test" } });
      await expect(requireAdminRequest(same)).resolves.toBeTruthy();

      const none = request("https://aceva.test/api/admin/x", { method, headers: { cookie } });
      await expect(requireAdminRequest(none)).resolves.toBeTruthy();
    }
  });

  it("checks authentication before origin", async () => {
    const cross = request("https://aceva.test/api/admin/x", { method: "POST", headers: { origin: "https://evil.example" } });
    expect((await thrownCode(requireAdminRequest(cross))).code).toBe("UNAUTHENTICATED");
  });

  it("applies the admin-api rate limit per client address, with retryAfter", async () => {
    const cookie = await sessionCookieHeader();
    const make = (ip: string) => request("https://aceva.test/api/admin/x", { headers: { cookie, "x-forwarded-for": ip } });
    for (let i = 0; i < RATE_LIMIT_RULES["admin-api"]; i += 1) {
      await requireAdminRequest(make("198.51.100.1"));
    }
    const error = await thrownCode(requireAdminRequest(make("198.51.100.1")));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.options.retryAfter).toBeGreaterThan(0);
    expect(error.options.retryAfter).toBeLessThanOrEqual(60);
    // Another address has its own budget.
    await expect(requireAdminRequest(make("198.51.100.2"))).resolves.toBeTruthy();
  });

  it("does not spend rate-limit budget on unauthenticated requests", async () => {
    const cookie = await sessionCookieHeader();
    for (let i = 0; i < RATE_LIMIT_RULES["admin-api"] + 20; i += 1) {
      await thrownCode(requireAdminRequest(request("https://aceva.test/api/admin/x", { headers: { "x-forwarded-for": "198.51.100.1" } })));
    }
    await expect(
      requireAdminRequest(request("https://aceva.test/api/admin/x", { headers: { cookie, "x-forwarded-for": "198.51.100.1" } })),
    ).resolves.toBeTruthy();
  });
});

describe("page guards", () => {
  async function digestOf(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (error) {
      return String((error as { digest?: unknown }).digest ?? "");
    }
    return "";
  }

  it("getAdminSession reads the cookie from next/headers", async () => {
    expect(await getAdminSession()).toBeNull();
    cookieJar.set(getAdminCookieName(), await createSessionToken());
    const session = await getAdminSession();
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
    cookieJar.set(getAdminCookieName(), "garbage");
    expect(await getAdminSession()).toBeNull();
  });

  it("getAdminSession is null when the console is disabled", async () => {
    cookieJar.set(getAdminCookieName(), await createSessionToken());
    vi.stubEnv("ADMIN_PASSKEY", "");
    expect(await getAdminSession()).toBeNull();
  });

  it("requireAdminPage returns the session when signed in", async () => {
    cookieJar.set(getAdminCookieName(), await createSessionToken());
    await expect(requireAdminPage("/admin/documents")).resolves.toMatchObject({ issuedAt: expect.any(Number) });
  });

  it("requireAdminPage redirects to the login page with an encoded, sanitised next", async () => {
    const digest = await digestOf(requireAdminPage("/admin/documents?tab=files"));
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/admin/login?next=%2Fadmin%2Fdocuments%3Ftab%3Dfiles");
  });

  it("requireAdminPage never redirects to a hostile next", async () => {
    for (const hostile of ["//evil.com", "https://evil.com", "/admin/login", undefined]) {
      const digest = await digestOf(requireAdminPage(hostile));
      expect(digest).toContain("/admin/login?next=%2Fadmin;");
      expect(digest).not.toContain("evil");
    }
  });

  it("requireAdminPage is a 404 on a host outside ADMIN_ALLOWED_HOSTS, even with a valid session", async () => {
    cookieJar.set(getAdminCookieName(), await createSessionToken());
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "example.com");
    requestHeaders = new Headers({ host: "preview-123.vercel.app" });
    const blocked = await digestOf(requireAdminPage("/admin/documents"));
    expect(blocked).toContain("404");
    requestHeaders = new Headers({ host: "example.com" });
    await expect(requireAdminPage("/admin/documents")).resolves.toMatchObject({ issuedAt: expect.any(Number) });
  });

  it("requireAdminPage is a 404 when the console is disabled", async () => {
    vi.stubEnv("ADMIN_PASSKEY", "");
    const digest = await digestOf(requireAdminPage("/admin"));
    expect(digest).toContain("404");
    expect(digest).not.toContain("NEXT_REDIRECT");
  });
});
