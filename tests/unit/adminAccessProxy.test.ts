import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";
import { createSessionToken } from "@/lib/admin/session";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const ROBOTS = "noindex, nofollow, noarchive";
const REAL_HOST = "acevatech.com";
const PREVIEW_HOST = "aceva-technology-git-feature-acevaorg.vercel.app";

function req(
  path: string,
  init: { method?: string; headers?: Record<string, string>; host?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = { ...init.headers };
  // Real deployments always deliver a Host header; the tests set it explicitly so the lock sees it.
  if (init.host !== null) headers.host = init.host ?? REAL_HOST;
  return new NextRequest(`https://${REAL_HOST}${path}`, { method: init.method ?? "GET", headers });
}

async function signedIn(path: string, host?: string | null, method = "GET"): Promise<NextRequest> {
  const token = await createSessionToken();
  return req(path, { method, host, headers: { cookie: `__Host-aceva_admin_session=${token}` } });
}

function isPassThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

function expectAdminPrivate(response: Response) {
  expect(response.headers.get("x-robots-tag")).toBe(ROBOTS);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

/** Everything observable about a response, for "these two answers are identical" assertions. */
async function fingerprint(response: Response) {
  return {
    status: response.status,
    body: await response.text(),
    headers: [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

const ADMIN_URLS: Array<[string, string]> = [
  ["GET", "/admin"],
  ["GET", "/admin/login"],
  ["GET", "/admin/documents"],
  ["POST", "/admin/documents/new"],
  ["POST", "/api/admin/login"],
  ["GET", "/api/admin/session"],
  ["GET", "/api/admin/documents"],
  ["DELETE", "/api/admin/documents/0b9d4c1e-7a52-4c3a-9d60-2f7f9f1c5b21"],
];

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com,www.acevatech.com");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MOBILE_PREVIEW_USERNAME", "");
  vi.stubEnv("MOBILE_PREVIEW_PASSWORD", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("host lock: an allowed host", () => {
  it("reaches the login page and the open API routes without a session", async () => {
    for (const [method, path] of [
      ["GET", "/admin/login"],
      ["POST", "/api/admin/login"],
      ["POST", "/api/admin/logout"],
      ["GET", "/api/admin/session"],
    ]) {
      const response = await proxy(req(path, { method }));
      expect(isPassThrough(response), path).toBe(true);
      expectAdminPrivate(response);
    }
  });

  it("is sent to the login page for a protected page, and gets 401 JSON for the API", async () => {
    const page = await proxy(req("/admin/documents"));
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location") as string).pathname).toBe("/admin/login");
    expectAdminPrivate(page);

    const api = await proxy(req("/api/admin/documents"));
    expect(api.status).toBe(401);
    expect((await api.json()).code).toBe("UNAUTHENTICATED");
    expectAdminPrivate(api);
  });

  it("passes a signed-in request through", async () => {
    const response = await proxy(await signedIn("/admin/documents"));
    expect(isPassThrough(response)).toBe(true);
    expectAdminPrivate(response);
  });

  it("also works for the second listed host", async () => {
    expect(isPassThrough(await proxy(req("/admin/login", { host: "www.acevatech.com" })))).toBe(true);
  });

  it.each([
    ["uppercase", "ACEVATECH.COM"],
    ["mixed case", "AcevaTech.Com"],
    ["with a port", "acevatech.com:443"],
    ["with a trailing dot", "acevatech.com."],
    ["with a trailing dot and a port", "ACEVATECH.COM.:8443"],
  ])("matches a Host header spelled %s", async (_label, host) => {
    expect(isPassThrough(await proxy(req("/admin/login", { host })))).toBe(true);
    expect((await proxy(req("/admin/documents", { host }))).status).toBe(307);
  });
});

describe("host lock: a host that is not listed", () => {
  it("answers every admin URL with the same private 404 as the disabled state, signed in or not", async () => {
    // The reference answer: what a disabled console says.
    vi.stubEnv("ADMIN_PASSKEY", "");
    const disabled = await fingerprint(await proxy(req("/admin/login")));
    vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
    expect(disabled.status).toBe(404);
    expect(disabled.body).toBe("Not found");

    const token = await createSessionToken();
    for (const [method, path] of ADMIN_URLS) {
      for (const cookie of [undefined, `__Host-aceva_admin_session=${token}`]) {
        const headers: Record<string, string> = cookie ? { cookie } : {};
        const response = await proxy(req(path, { method, host: PREVIEW_HOST, headers }));
        expect(response.status, `${method} ${path}`).toBe(404);
        expect(response.headers.get("location"), path).toBeNull();
        expectAdminPrivate(response);
        expect(await fingerprint(response), `${method} ${path}`).toEqual(disabled);
      }
    }
  });

  it("does not let a preview URL show the login page at all", async () => {
    const response = await proxy(req("/admin/login", { host: PREVIEW_HOST }));
    expect(response.status).toBe(404);
    expect(isPassThrough(response)).toBe(false);
    expect(await response.text()).toBe("Not found");
  });

  it("refuses look-alike hosts", async () => {
    for (const host of [
      "evilacevatech.com",
      "acevatech.com.evil.example",
      "acevatech.co",
      "sub.acevatech.com",
      "acevatech.com@evil.example",
      "acevatech.com, evil.example",
      "bad host",
      "127.0.0.1",
      "localhost",
    ]) {
      const response = await proxy(req("/admin/login", { host }));
      expect(response.status, host).toBe(404);
    }
  });

  it("refuses a request with no host at all", async () => {
    const response = await proxy(req("/admin/login", { host: null }));
    expect(response.status).toBe(404);
  });
});

describe("host lock: X-Forwarded-Host", () => {
  it("is used only when Host is missing", async () => {
    const viaForwarded = await proxy(req("/admin/login", { host: null, headers: { "x-forwarded-host": REAL_HOST } }));
    expect(isPassThrough(viaForwarded)).toBe(true);

    const unlisted = await proxy(req("/admin/login", { host: null, headers: { "x-forwarded-host": PREVIEW_HOST } }));
    expect(unlisted.status).toBe(404);
  });

  it("cannot rescue an unlisted Host", async () => {
    const response = await proxy(req("/admin/login", { host: PREVIEW_HOST, headers: { "x-forwarded-host": REAL_HOST } }));
    expect(response.status).toBe(404);
  });

  it("cannot smuggle a bad Host past a good forwarded value", async () => {
    const response = await proxy(req("/admin/login", { host: "bad host", headers: { "x-forwarded-host": REAL_HOST } }));
    expect(response.status).toBe(404);
  });

  it("does not turn a listed Host into a denial", async () => {
    const response = await proxy(req("/admin/login", { host: REAL_HOST, headers: { "x-forwarded-host": PREVIEW_HOST } }));
    expect(isPassThrough(response)).toBe(true);
  });
});

describe("host lock: localhost", () => {
  it.each(["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "LOCALHOST:3000"])(
    "is allowed outside production (%s)",
    async (host) => {
      for (const env of ["development", "test"]) {
        vi.stubEnv("NODE_ENV", env);
        expect(isPassThrough(await proxy(req("/admin/login", { host }))), `${env} ${host}`).toBe(true);
      }
    },
  );

  it.each(["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000"])("is denied in production (%s)", async (host) => {
    const response = await proxy(req("/admin/login", { host }));
    expect(response.status).toBe(404);
  });

  it("is still denied outside production for a non-loopback unlisted host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await proxy(req("/admin/login", { host: PREVIEW_HOST }))).status).toBe(404);
  });

  it("is allowed in production when it is listed on purpose", async () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com,localhost");
    expect(isPassThrough(await proxy(req("/admin/login", { host: "localhost:3000" })))).toBe(true);
  });
});

describe("host lock: configuration", () => {
  it.each([undefined, "", "   "])("means no restriction when ADMIN_ALLOWED_HOSTS is %j", async (value) => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", value);
    for (const host of [PREVIEW_HOST, "anything.example", "localhost"]) {
      expect(isPassThrough(await proxy(req("/admin/login", { host }))), host).toBe(true);
    }
    expect(isPassThrough(await proxy(req("/admin/login", { host: null })))).toBe(true);
  });

  it("ignores garbage entries and still enforces the valid ones", async () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "https://nope.example/, ,*.vercel.app,acevatech.com,under_score");
    expect(isPassThrough(await proxy(req("/admin/login", { host: REAL_HOST })))).toBe(true);
    expect((await proxy(req("/admin/login", { host: "nope.example" }))).status).toBe(404);
    expect((await proxy(req("/admin/login", { host: PREVIEW_HOST }))).status).toBe(404);
  });

  it("locks every host when the variable holds only garbage, instead of silently unlocking", async () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "https://acevatech.com/");
    expect((await proxy(req("/admin/login", { host: REAL_HOST }))).status).toBe(404);
    // Development still works so the owner can see the problem.
    vi.stubEnv("NODE_ENV", "development");
    expect(isPassThrough(await proxy(req("/admin/login", { host: "localhost:3000" })))).toBe(true);
  });

  it("reads the variable on every request, so a changed value takes effect without a restart of the module", async () => {
    expect(isPassThrough(await proxy(req("/admin/login", { host: PREVIEW_HOST })))).toBe(false);
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", `acevatech.com,${PREVIEW_HOST}`);
    expect(isPassThrough(await proxy(req("/admin/login", { host: PREVIEW_HOST })))).toBe(true);
  });
});

describe("host lock: scope", () => {
  it("leaves the /mobile Basic-auth gate alone", async () => {
    vi.stubEnv("MOBILE_PREVIEW_USERNAME", "preview");
    vi.stubEnv("MOBILE_PREVIEW_PASSWORD", "s3cret-preview");
    const challenged = await proxy(req("/mobile", { host: PREVIEW_HOST }));
    expect(challenged.status).toBe(401);
    expect(challenged.headers.get("www-authenticate")).toContain("Basic realm=");
    // The mobile gate never grew the admin headers.
    expect(challenged.headers.get("referrer-policy")).toBeNull();

    const authorization = `Basic ${btoa("preview:s3cret-preview")}`;
    const allowed = await proxy(req("/mobile/page", { host: PREVIEW_HOST, headers: { authorization } }));
    expect(isPassThrough(allowed)).toBe(true);
    expect(allowed.headers.get("referrer-policy")).toBeNull();
  });

  it("does not make the disabled-/mobile 404 any different", async () => {
    const response = await proxy(req("/mobile", { host: PREVIEW_HOST }));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBeNull();
  });
});

describe("Referrer-Policy on every admin-branch response", () => {
  it("is no-referrer for pass-through, redirect, 401 and both kinds of 404", async () => {
    const responses: Response[] = [
      await proxy(req("/admin/login")), // pass-through, open path
      await proxy(await signedIn("/admin/documents")), // pass-through, session
      await proxy(req("/admin/documents")), // 307
      await proxy(req("/api/admin/documents")), // 401
      await proxy(req("/admin/documents", { method: "POST" })), // 401, non-navigation
      await proxy(req("/admin/login", { host: PREVIEW_HOST })), // 404, host lock
      await proxy(req("/admin//login")), // 404, non-canonical path
    ];
    vi.stubEnv("ADMIN_PASSKEY", "");
    responses.push(await proxy(req("/admin"))); // 404, disabled
    for (const response of responses) expectAdminPrivate(response);
  });
});
