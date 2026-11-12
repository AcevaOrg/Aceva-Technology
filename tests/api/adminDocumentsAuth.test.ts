import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as actionsRoute from "@/app/api/admin/documents/[id]/actions/route";
import * as fileRoute from "@/app/api/admin/documents/[id]/file/route";
import * as qrRoute from "@/app/api/admin/documents/[id]/qr/route";
import * as itemRoute from "@/app/api/admin/documents/[id]/route";
import * as referenceRoute from "@/app/api/admin/documents/next-reference/route";
import * as listRoute from "@/app/api/admin/documents/route";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";
import { setSqlClientForTests, DatabaseNotConfiguredError, type SqlClient } from "@/lib/db";
import {
  API,
  PASSKEY,
  deleteRequest,
  documentForm,
  enableAdmin,
  formRequest,
  getRequest,
  idContext,
  jsonRequest,
  payloadFor,
  readBody,
} from "./adminDocumentsHarness";

/**
 * Every route in the admin document API, called directly: no cookie is 401, a disabled console
 * is 404, a cross-origin mutation is 403, and none of those reach the database.
 */

const ID = "11111111-2222-4333-8444-555555555555";

interface Endpoint {
  name: string;
  mutates: boolean;
  build: (headers?: Record<string, string>, authed?: boolean) => Promise<Request>;
  call: (request: Request) => Promise<Response>;
}

const ENDPOINTS: Endpoint[] = [
  {
    name: "GET /api/admin/documents",
    mutates: false,
    build: (headers, authed) => getRequest(API, { headers, authed }),
    call: (request) => listRoute.GET(request),
  },
  {
    name: "POST /api/admin/documents",
    mutates: true,
    build: (headers, authed) => formRequest("POST", API, documentForm(payloadFor("financial_report")), { headers, authed }),
    call: (request) => listRoute.POST(request),
  },
  {
    name: "GET /api/admin/documents/[id]",
    mutates: false,
    build: (headers, authed) => getRequest(`${API}/${ID}`, { headers, authed }),
    call: (request) => itemRoute.GET(request, idContext(ID)),
  },
  {
    name: "PATCH /api/admin/documents/[id]",
    mutates: true,
    build: (headers, authed) => formRequest("PATCH", `${API}/${ID}`, documentForm(payloadFor("financial_report")), { headers, authed }),
    call: (request) => itemRoute.PATCH(request, idContext(ID)),
  },
  {
    name: "DELETE /api/admin/documents/[id]",
    mutates: true,
    build: (headers, authed) => deleteRequest(`${API}/${ID}`, { headers, authed }),
    call: (request) => itemRoute.DELETE(request, idContext(ID)),
  },
  {
    name: "POST /api/admin/documents/[id]/actions",
    mutates: true,
    build: (headers, authed) => jsonRequest("POST", `${API}/${ID}/actions`, { action: "publish" }, { headers, authed }),
    call: (request) => actionsRoute.POST(request, idContext(ID)),
  },
  {
    name: "GET /api/admin/documents/[id]/qr",
    mutates: false,
    build: (headers, authed) => getRequest(`${API}/${ID}/qr`, { headers, authed }),
    call: (request) => qrRoute.GET(request, idContext(ID)),
  },
  {
    name: "GET /api/admin/documents/[id]/file",
    mutates: false,
    build: (headers, authed) => getRequest(`${API}/${ID}/file?role=primary`, { headers, authed }),
    call: (request) => fileRoute.GET(request, idContext(ID)),
  },
  {
    name: "GET /api/admin/documents/next-reference",
    mutates: false,
    build: (headers, authed) => getRequest(`${API}/next-reference?category=experience_letter`, { headers, authed }),
    call: (request) => referenceRoute.GET(request),
  },
];

let queries: ReturnType<typeof vi.fn>;

/** A database that fails loudly if anything reaches it, and remembers that it was reached. */
function installTripwire(): void {
  queries = vi.fn(async () => {
    throw new Error("the database must not be reached");
  });
  setSqlClientForTests(queries as unknown as SqlClient);
}

beforeEach(() => {
  enableAdmin();
  installTripwire();
});

afterEach(() => {
  setSqlClientForTests(null);
  vi.unstubAllEnvs();
});

function expectEnvelope(body: Record<string, unknown>, code: string): void {
  expect(body.ok).toBe(false);
  expect(body.code).toBe(code);
  expect(typeof body.error).toBe("string");
  expect(typeof body.requestId).toBe("string");
  expect(Object.keys(body)).not.toContain("document");
  expect(Object.keys(body)).not.toContain("items");
}

describe.each(ENDPOINTS)("$name", (endpoint) => {
  it("answers 401 without a session cookie", async () => {
    const response = await endpoint.call(await endpoint.build({}, false));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expectEnvelope(await readBody(response), "UNAUTHENTICATED");
    expect(queries).not.toHaveBeenCalled();
  });

  it("answers 401 for a garbage, tampered, foreign or expired cookie", async () => {
    const good = await createSessionToken();
    const expired = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    const cookies = [
      `${getAdminCookieName()}=garbage`,
      `${getAdminCookieName()}=${good.slice(0, -2)}xx`,
      `${getAdminCookieName()}=${expired}`,
      `${getAdminCookieName()}=`,
      `other_cookie=${good}`,
    ];
    for (const cookie of cookies) {
      const response = await endpoint.call(await endpoint.build({ cookie }, false));
      expect(response.status).toBe(401);
      expectEnvelope(await readBody(response), "UNAUTHENTICATED");
    }
    expect(queries).not.toHaveBeenCalled();
  });

  it("answers 404 when the console is disabled, session or not", async () => {
    const request = await endpoint.build();
    for (const passkey of ["", "short"]) {
      vi.stubEnv("ADMIN_PASSKEY", passkey);
      const withSession = await endpoint.call(request.clone());
      expect(withSession.status).toBe(404);
      expectEnvelope(await readBody(withSession), "NOT_FOUND");
      const without = await endpoint.call(await endpoint.build({}, false));
      expect(without.status).toBe(404);
    }
    vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
    expect(queries).not.toHaveBeenCalled();
  });

  if (endpoint.mutates) {
    it("answers 403 to a cross-origin request that carries a valid session", async () => {
      const response = await endpoint.call(await endpoint.build({ origin: "https://evil.example" }));
      expect(response.status).toBe(403);
      expectEnvelope(await readBody(response), "FORBIDDEN_ORIGIN");
      expect(queries).not.toHaveBeenCalled();
    });

    it("checks the session before the origin, so a stranger learns nothing about origins", async () => {
      const response = await endpoint.call(await endpoint.build({ origin: "https://evil.example" }, false));
      expect(response.status).toBe(401);
    });

    it("refuses an unparsable Origin header", async () => {
      const response = await endpoint.call(await endpoint.build({ origin: "not a url" }));
      expect(response.status).toBe(403);
    });
  }
});

/* ------------------------------------------------------------------ *
 * Rate limit                                                           *
 * ------------------------------------------------------------------ */

describe("rate limiting", () => {
  it("allows 120 authenticated requests a minute and then answers 429 with Retry-After", async () => {
    const build = () => getRequest(`${API}/next-reference`);
    for (let i = 0; i < 120; i += 1) {
      const response = await referenceRoute.GET(await build());
      // 400 (no category) proves the guard let the request through to the handler.
      expect(response.status).toBe(400);
    }
    const limited = await referenceRoute.GET(await build());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expectEnvelope(await readBody(limited), "RATE_LIMITED");
  });

  it("does not count unauthenticated requests", async () => {
    for (let i = 0; i < 130; i += 1) {
      expect((await referenceRoute.GET(await getRequest(`${API}/next-reference`, { authed: false }))).status).toBe(401);
    }
    expect((await referenceRoute.GET(await getRequest(`${API}/next-reference`))).status).toBe(400);
  });
});

/* ------------------------------------------------------------------ *
 * Unused verbs                                                         *
 * ------------------------------------------------------------------ */

type Verb = (request: Request) => Response | Promise<Response>;

describe("unused methods", () => {
  const cases: Array<[string, string[], Record<string, Verb | undefined>]> = [
    ["/api/admin/documents", ["GET", "POST"], { HEAD: listRoute.HEAD, PUT: listRoute.PUT, PATCH: listRoute.PATCH, DELETE: listRoute.DELETE }],
    ["/api/admin/documents/[id]", ["GET", "PATCH", "DELETE"], { HEAD: itemRoute.HEAD, POST: itemRoute.POST, PUT: itemRoute.PUT }],
    [
      "/api/admin/documents/[id]/actions",
      ["POST"],
      { GET: actionsRoute.GET, HEAD: actionsRoute.HEAD, PUT: actionsRoute.PUT, PATCH: actionsRoute.PATCH, DELETE: actionsRoute.DELETE },
    ],
    ["/api/admin/documents/[id]/qr", ["GET"], { HEAD: qrRoute.HEAD, POST: qrRoute.POST, PUT: qrRoute.PUT, PATCH: qrRoute.PATCH, DELETE: qrRoute.DELETE }],
    ["/api/admin/documents/[id]/file", ["GET"], { HEAD: fileRoute.HEAD, POST: fileRoute.POST, PUT: fileRoute.PUT, PATCH: fileRoute.PATCH, DELETE: fileRoute.DELETE }],
    [
      "/api/admin/documents/next-reference",
      ["GET"],
      { HEAD: referenceRoute.HEAD, POST: referenceRoute.POST, PUT: referenceRoute.PUT, PATCH: referenceRoute.PATCH, DELETE: referenceRoute.DELETE },
    ],
  ];

  it.each(cases)("%s answers a JSON 405 naming the allowed methods", async (_route, allowed, verbs) => {
    for (const [method, handler] of Object.entries(verbs)) {
      expect(handler, `${method} must be exported`).toBeDefined();
      const response = await handler!(new Request(API, { method }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe([...allowed, "OPTIONS"].join(", "));
      if (method !== "HEAD") expectEnvelope(await readBody(response), "METHOD_NOT_ALLOWED");
    }
  });

  it("answers OPTIONS with 204 and the allowed methods on every route", () => {
    const options: Array<[() => Response, string]> = [
      [listRoute.OPTIONS, "GET, POST, OPTIONS"],
      [itemRoute.OPTIONS, "GET, PATCH, DELETE, OPTIONS"],
      [actionsRoute.OPTIONS, "POST, OPTIONS"],
      [qrRoute.OPTIONS, "GET, OPTIONS"],
      [fileRoute.OPTIONS, "GET, OPTIONS"],
      [referenceRoute.OPTIONS, "GET, OPTIONS"],
    ];
    for (const [handler, allow] of options) {
      const response = handler();
      expect(response.status).toBe(204);
      expect(response.headers.get("allow")).toBe(allow);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Malformed ids                                                        *
 * ------------------------------------------------------------------ */

const BAD_IDS = [
  "not-a-uuid",
  "../../etc/passwd",
  "1",
  `${ID}x`,
  `${ID}'; DROP TABLE documents;--`,
  "11111111-2222-4333-8444-55555555555g",
  "%00",
  "null",
  "undefined",
  "next-reference-ish",
];

describe("malformed ids", () => {
  const ID_ROUTES: Array<[string, (id: string) => Promise<Response>]> = [
    ["GET", async (id) => itemRoute.GET(await getRequest(`${API}/${id}`), idContext(id))],
    ["PATCH", async (id) => itemRoute.PATCH(await formRequest("PATCH", `${API}/${id}`, documentForm(payloadFor("financial_report"))), idContext(id))],
    ["DELETE", async (id) => itemRoute.DELETE(await deleteRequest(`${API}/${id}`), idContext(id))],
    ["actions", async (id) => actionsRoute.POST(await jsonRequest("POST", `${API}/${id}/actions`, { action: "archive" }), idContext(id))],
    ["qr", async (id) => qrRoute.GET(await getRequest(`${API}/${id}/qr`), idContext(id))],
    ["file", async (id) => fileRoute.GET(await getRequest(`${API}/${id}/file`), idContext(id))],
  ];

  it.each(ID_ROUTES)("%s answers 404, not 500, and never reaches the database", async (_name, call) => {
    for (const bad of BAD_IDS) {
      const response = await call(bad);
      expect(response.status, bad).toBe(404);
      expectEnvelope(await readBody(response), "NOT_FOUND");
    }
    expect(queries).not.toHaveBeenCalled();
  });

  it("checks the session before the id, so ids cannot be probed without signing in", async () => {
    const response = await itemRoute.GET(await getRequest(`${API}/not-a-uuid`, { authed: false }), idContext("not-a-uuid"));
    expect(response.status).toBe(401);
  });
});

/* ------------------------------------------------------------------ *
 * Database trouble                                                     *
 * ------------------------------------------------------------------ */

const SECRET_URL = "postgres://admin:hunter2@db.internal:5432/app";
const CALM = "The document database is not available right now. Please try again in a moment.";

describe("database trouble", () => {
  const OUTAGE_CALLS: Array<[string, () => Promise<Response>]> = [
    ["list", async () => listRoute.GET(await getRequest(API))],
    ["create", async () => listRoute.POST(await formRequest("POST", API, documentForm(payloadFor("financial_report"))))],
    ["get", async () => itemRoute.GET(await getRequest(`${API}/${ID}`), idContext(ID))],
    ["update", async () => itemRoute.PATCH(await formRequest("PATCH", `${API}/${ID}`, documentForm(payloadFor("financial_report"))), idContext(ID))],
    ["delete", async () => itemRoute.DELETE(await deleteRequest(`${API}/${ID}`), idContext(ID))],
    ["action", async () => actionsRoute.POST(await jsonRequest("POST", `${API}/${ID}/actions`, { action: "archive" }), idContext(ID))],
    ["qr", async () => qrRoute.GET(await getRequest(`${API}/${ID}/qr`), idContext(ID))],
    ["file", async () => fileRoute.GET(await getRequest(`${API}/${ID}/file`), idContext(ID))],
    ["next-reference", async () => referenceRoute.GET(await getRequest(`${API}/next-reference?category=experience_letter`))],
  ];

  it.each(OUTAGE_CALLS)("%s answers a calm 503 when the database cannot be reached", async (_name, call) => {
    setSqlClientForTests(async () => {
      throw Object.assign(new Error(`connect ECONNREFUSED ${SECRET_URL}`), { code: "ECONNREFUSED" });
    });
    const response = await call();
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("postgres://");
    expect(text).not.toContain("ECONNREFUSED");
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.error).toBe(CALM);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.retryable).toBe(true);
  });

  it.each(OUTAGE_CALLS)("%s answers 503 when no database is configured", async (_name, call) => {
    setSqlClientForTests(async () => {
      throw new DatabaseNotConfiguredError();
    });
    const response = await call();
    expect(response.status).toBe(503);
    expect((await readBody(response)).error).toBe(CALM);
  });

  it.each(OUTAGE_CALLS)("%s answers a generic 500 for an unexpected failure, without its text", async (_name, call) => {
    setSqlClientForTests(async () => {
      throw new Error(`kaboom-secret-9f3 ${SECRET_URL}`);
    });
    const response = await call();
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("kaboom");
    expect(text).not.toContain("hunter2");
    expect(JSON.parse(text).code).toBe("INTERNAL_ERROR");
  });

  it("logs the cause of an unexpected failure on the server only", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setSqlClientForTests(async () => {
      throw new Error("kaboom-secret-9f3");
    });
    const response = await listRoute.GET(await getRequest(API));
    const body = await readBody(response);
    expect(String(errorLog.mock.calls.flat().map((item) => JSON.stringify(item)).join(" "))).toContain("kaboom-secret-9f3");
    expect(JSON.stringify(body)).toContain(String(body.requestId));
    expect(JSON.stringify(body)).not.toContain("kaboom");
  });
});
