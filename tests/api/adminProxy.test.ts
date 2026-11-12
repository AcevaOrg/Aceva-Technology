import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "../../proxy";
import { MIN_PASSKEY_LENGTH, sanitizeNextPath } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const ORIGIN = "https://aceva.test";
const ROBOTS = "noindex, nofollow, noarchive";

function req(path: string, init: { method?: string; headers?: Record<string, string> } = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers: init.headers });
}

async function signedIn(path: string, method = "GET", cookieName = "aceva_admin_session"): Promise<NextRequest> {
  const token = await createSessionToken();
  return req(path, { method, headers: { cookie: `${cookieName}=${token}` } });
}

/** True for NextResponse.next(), which is how a proxy says "carry on to the route". */
function isPassThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

/** Headers shared by every response, /mobile included. */
function expectPrivate(response: Response) {
  expect(response.headers.get("x-robots-tag")).toBe(ROBOTS);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
}

/** The admin branches add `Referrer-Policy: no-referrer`; /mobile deliberately does not. */
function expectAdminPrivate(response: Response) {
  expectPrivate(response);
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("MOBILE_PREVIEW_USERNAME", "");
  vi.stubEnv("MOBILE_PREVIEW_PASSWORD", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config", () => {
  it("matches /mobile and the whole admin surface", () => {
    expect(config.matcher).toEqual(["/mobile/:path*", "/admin", "/admin/:path*", "/api/admin/:path*"]);
  });
});

describe("admin disabled", () => {
  it("answers every admin URL with the same private 404, signed in or not", async () => {
    const token = await createSessionToken();
    vi.stubEnv("ADMIN_PASSKEY", "");
    for (const path of ["/admin", "/admin/login", "/admin/documents", "/api/admin/login", "/api/admin/session", "/api/admin/documents"]) {
      for (const headers of [undefined, { cookie: `aceva_admin_session=${token}` }]) {
        const response = await proxy(req(path, { headers }));
        expect(response.status, path).toBe(404);
        expect(await response.text(), path).toBe("Not found");
        expectAdminPrivate(response);
        expect(response.headers.get("location")).toBeNull();
      }
    }
  });

  it("treats a too-short pass key as disabled", async () => {
    vi.stubEnv("ADMIN_PASSKEY", "x".repeat(MIN_PASSKEY_LENGTH - 1));
    expect((await proxy(req("/admin"))).status).toBe(404);
    expect((await proxy(req("/admin/login"))).status).toBe(404);
  });
});

describe("without a session", () => {
  it("redirects a page navigation to the login page, remembering where it was going", async () => {
    const response = await proxy(req("/admin/documents/new?category=certifications"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/documents/new?category=certifications");
    // The query is percent-encoded as a single value, not spliced into the redirect URL.
    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login?next=%2Fadmin%2Fdocuments%2Fnew%3Fcategory%3Dcertifications`);
    expectAdminPrivate(response);
  });

  it("redirects /admin itself and HEAD requests", async () => {
    const root = await proxy(req("/admin"));
    expect(root.status).toBe(307);
    expect(new URL(root.headers.get("location") as string).searchParams.get("next")).toBe("/admin");
    const head = await proxy(req("/admin/activity", { method: "HEAD" }));
    expect(head.status).toBe(307);
  });

  it("answers /api/admin/* with the canonical 401 envelope, never a redirect", async () => {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const response = await proxy(req("/api/admin/documents", { method }));
      expect(response.status, method).toBe(401);
      expect(response.headers.get("location")).toBeNull();
      expectAdminPrivate(response);
      expect(response.headers.get("content-type")).toMatch(/application\/json/);
      if (method !== "HEAD") {
        const body = await response.json();
        expect(body).toMatchObject({ ok: false, code: "UNAUTHENTICATED", retryable: false });
        expect(body.requestId).toMatch(/^req_/);
        expect(body.error).toEqual(expect.any(String));
      }
    }
  });

  it("answers a non-GET page request (a Server Action post, say) with 401 JSON, not a redirect", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await proxy(req("/admin/documents/new", { method }));
      expect(response.status, method).toBe(401);
      expect((await response.json()).code).toBe("UNAUTHENTICATED");
      expectAdminPrivate(response);
    }
  });

  it("never lets a hostile path become an open redirect", async () => {
    // A hostile spelling is refused outright: no redirect, so there is nothing to steer anywhere.
    for (const path of ["/ADMIN", "/Admin/documents", "/admin//x", "/admin//evil.com", "/admin/%2e%2e/x", "/admin/..%2f", "/admin/%5Cevil.com"]) {
      const response = await proxy(req(path));
      expect(response.status, path).toBe(404);
      expect(response.headers.get("location"), path).toBeNull();
    }
    // A canonical path with a hostile query can only ever land on the login page of this origin.
    for (const path of ["/admin/documents?next=//evil.com", "/admin/documents?next=https://evil.com", "/admin?x=%0d%0aSet-Cookie:a=b"]) {
      const response = await proxy(req(path));
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get("location") as string);
      expect(location.origin, path).toBe(ORIGIN);
      expect(location.pathname, path).toBe("/admin/login");
    }
  });

  it("only ever puts a value in `next` that the login route would accept unchanged", async () => {
    for (const path of ["/admin", "/admin/documents", "/admin/documents/abc?tab=files&q=100%25", "/admin/verification?code=ACV-1"]) {
      const response = await proxy(req(path));
      const next = new URL(response.headers.get("location") as string).searchParams.get("next") as string;
      expect(sanitizeNextPath(next), path).toBe(next);
    }
  });

  it("does not redirect the login page to itself", async () => {
    // Open path: passes straight through (covered below). A look-alike that is NOT open must
    // still not produce a ?next= pointing at the login page.
    const response = await proxy(req("/admin/login/extra"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).searchParams.get("next")).toBe("/admin");
  });

  it("treats a garbage, expired, tampered or wrong-key cookie as no session", async () => {
    const good = await createSessionToken();
    const expired = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    const tampered = `${good.slice(0, -2)}${good.endsWith("AA") ? "BB" : "AA"}`;
    const otherKey = await (async () => {
      vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
      const token = await createSessionToken();
      vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
      return token;
    })();
    for (const token of ["garbage", "", expired, tampered, otherKey]) {
      const page = await proxy(req("/admin/documents", { headers: { cookie: `aceva_admin_session=${token}` } }));
      expect(page.status, token.slice(0, 12)).toBe(307);
      const api = await proxy(req("/api/admin/documents", { headers: { cookie: `aceva_admin_session=${token}` } }));
      expect(api.status, token.slice(0, 12)).toBe(401);
    }
  });

  it("reads the __Host- cookie in production and ignores the development name", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isPassThrough(await proxy(await signedIn("/admin/documents", "GET", "__Host-aceva_admin_session")))).toBe(true);
    const wrongName = await proxy(await signedIn("/admin/documents", "GET", "aceva_admin_session"));
    expect(wrongName.status).toBe(307);
  });
});

describe("allow-list", () => {
  it.each([
    ["GET", "/admin/login"],
    ["GET", "/admin/login/"],
    ["HEAD", "/admin/login"],
    ["POST", "/admin/login"],
    ["POST", "/api/admin/login"],
    ["POST", "/api/admin/login/"],
    ["POST", "/api/admin/logout"],
    ["GET", "/api/admin/session"],
    ["GET", "/api/admin/session/"],
  ])("lets %s %s through without a session, privately", async (method, path) => {
    const response = await proxy(req(path, { method }));
    expect(isPassThrough(response)).toBe(true);
    expect(response.status).toBe(200);
    expectAdminPrivate(response);
  });

  it.each([
    // Canonical spellings that are not on the list: they need a session.
    ["/admin/login/x", 307],
    ["/admin/loginx", 307],
    ["/admin/login.json", 307],
    ["/admin", 307],
    ["/admin/", 307],
    ["/api/admin", 401],
    ["/api/admin/", 401],
    ["/api/admin/logins", 401],
    ["/api/admin/login/x", 401],
    ["/api/admin/session/x", 401],
    ["/api/admin/documents", 401],
    // Any other spelling of the same names is not an entrance at all: a plain 404.
    ["/admin/login//", 404],
    ["/admin//login", 404],
    ["/admin/%6Cogin", 404],
    ["/admin/login%2F", 404],
    ["/admin/login%2Fx", 404],
    ["/admin/login;x", 404],
    ["/admin/Login", 404],
    ["/api/admin/login//", 404],
    ["/api/admin//login", 404],
    ["/api/admin/%6Cogin", 404],
    ["/api/admin/Login", 404],
  ])("does not open the look-alike %s", async (path, status) => {
    const response = await proxy(req(path));
    expect(isPassThrough(response), path).toBe(false);
    expect(response.status, path).toBe(status);
    expectAdminPrivate(response);
  });

  it.each(["/ADMIN/LOGIN", "/Admin/Login/", "/API/ADMIN/LOGOUT", "/Api/Admin/Session"])(
    "treats the case variant %s as no entrance, signed in or not",
    async (path) => {
      for (const request of [req(path), await signedIn(path), req(path, { method: "POST" })]) {
        const response = await proxy(request);
        expect(response.status, path).toBe(404);
        expect(isPassThrough(response), path).toBe(false);
        expect(await response.text()).toBe("Not found");
        expectAdminPrivate(response);
      }
    },
  );

  it("judges the path after the URL parser has resolved dot segments, like the router does", async () => {
    // WHATWG URL parsing collapses these before the proxy sees them, so the allow-list can neither
    // be reached through "/admin/login/../documents" nor be denied for "/admin/./login".
    const closed = await proxy(req("/admin/login/../documents"));
    expect(isPassThrough(closed)).toBe(false);
    expect(closed.status).toBe(307);
    expect(isPassThrough(await proxy(req("/admin/./login")))).toBe(true);
  });

  it("does not open /admin/login for a different path that merely ends the same way", async () => {
    for (const path of ["/x/admin/login", "/admin/documents/admin/login", "/api/admin/documents/login"]) {
      // Not under the admin surface at all (the matcher would not send these), so the proxy has
      // no business passing them: they fall to the strict gate.
      const response = await proxy(req(path));
      expect(isPassThrough(response), path).toBe(false);
    }
  });
});

describe("with a valid session", () => {
  it("passes admin pages and APIs through, privately, for every method", async () => {
    for (const [method, path] of [
      ["GET", "/admin"],
      ["GET", "/admin/documents?tab=1"],
      ["HEAD", "/admin/activity"],
      ["POST", "/admin/documents/new"],
      ["GET", "/api/admin/documents"],
      ["POST", "/api/admin/documents"],
      ["PATCH", "/api/admin/documents/abc"],
      ["DELETE", "/api/admin/documents/abc"],
    ]) {
      const response = await proxy(await signedIn(path, method));
      expect(isPassThrough(response), `${method} ${path}`).toBe(true);
      expect(response.status).toBe(200);
      expectAdminPrivate(response);
    }
  });

  it("also passes the open paths", async () => {
    const response = await proxy(await signedIn("/admin/login"));
    expect(isPassThrough(response)).toBe(true);
    expectAdminPrivate(response);
  });

  it("passes a trailing slash on, but refuses every other odd spelling even with a session", async () => {
    expect(isPassThrough(await proxy(await signedIn("/admin/documents/")))).toBe(true);
    for (const path of ["/ADMIN", "/admin//x", "/admin/%64ocuments", "/admin/documents%2F", "/admin/documents;x"]) {
      const response = await proxy(await signedIn(path));
      expect(isPassThrough(response), path).toBe(false);
      expect(response.status, path).toBe(404);
    }
  });
});

describe("/mobile preview gate (unchanged)", () => {
  const credentials = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

  beforeEach(() => {
    vi.stubEnv("MOBILE_PREVIEW_USERNAME", "preview");
    vi.stubEnv("MOBILE_PREVIEW_PASSWORD", "s3cret-preview");
  });

  it("answers 404 with only the robots header when the credentials are not configured", async () => {
    vi.stubEnv("MOBILE_PREVIEW_USERNAME", "");
    const response = await proxy(req("/mobile"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(response.headers.get("x-robots-tag")).toBe(ROBOTS);
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("www-authenticate")).toBeNull();

    vi.stubEnv("MOBILE_PREVIEW_USERNAME", "preview");
    vi.stubEnv("MOBILE_PREVIEW_PASSWORD", "");
    expect((await proxy(req("/mobile/home"))).status).toBe(404);
  });

  it("challenges a request with no credentials", async () => {
    const response = await proxy(req("/mobile"));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Authentication required");
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="ACEVA mobile preview", charset="UTF-8"');
    expect(response.headers.get("x-robots-tag")).toBe(ROBOTS);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("challenges wrong, malformed and non-Basic credentials", async () => {
    for (const authorization of [
      credentials("preview", "wrong"),
      credentials("wrong", "s3cret-preview"),
      "Basic !!!not-base64!!!",
      "Basic ",
      "Bearer abc",
      credentials("preview", ""),
    ]) {
      const response = await proxy(req("/mobile/page", { headers: { authorization } }));
      expect(response.status, authorization).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("Basic realm=");
    }
  });

  it("lets the right credentials through with the same headers as before", async () => {
    for (const path of ["/mobile", "/mobile/", "/mobile/a/b"]) {
      const response = await proxy(req(path, { headers: { authorization: credentials("preview", "s3cret-preview") } }));
      expect(isPassThrough(response), path).toBe(true);
      expectPrivate(response);
    }
  });

  it("is not unlocked by an admin session, and does not unlock admin", async () => {
    const token = await createSessionToken();
    const mobile = await proxy(req("/mobile", { headers: { cookie: `aceva_admin_session=${token}` } }));
    expect(mobile.status).toBe(401);

    const basic = { authorization: credentials("preview", "s3cret-preview") };
    const admin = await proxy(req("/admin/documents", { headers: basic }));
    expect(admin.status).toBe(307);
    const adminApi = await proxy(req("/api/admin/documents", { headers: basic }));
    expect(adminApi.status).toBe(401);
  });

  it("does not reveal the mobile gate when only the admin console is configured", async () => {
    vi.stubEnv("MOBILE_PREVIEW_USERNAME", "");
    expect((await proxy(req("/mobile"))).status).toBe(404);
    expect((await proxy(req("/admin/login"))).status).toBe(200);
  });
});
