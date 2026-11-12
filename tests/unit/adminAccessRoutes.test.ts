/**
 * "Single entrance": the console is reachable by exactly one family of paths (/admin, /admin/login,
 * /api/admin/*), spelled exactly one way. Everything else is an ordinary 404 from the app, or, for
 * spellings the router could decode into an admin path, a refusal from the proxy.
 *
 * Next itself is not run here. Two of its real pieces are used instead of re-implementing them:
 * the compiled proxy matcher (`getMiddlewareMatchers` + `getMiddlewareRouteMatcher`, the same code
 * `next build` and the router use) and its slash normaliser. The router's habit of testing the
 * matcher against both the raw and the percent-decoded pathname is modelled on
 * node_modules/next/dist/server/lib/router-utils/resolve-routes.js (the "middleware" route).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import * as pageStaticInfo from "next/dist/build/analysis/get-page-static-info";
import type { ProxyMatcher } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";
import { normalizeRepeatedSlashes } from "next/dist/shared/lib/utils";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "../../proxy";
import { ADMIN_OPEN_PATHS, isCanonicalAdminPath } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const ORIGIN = "https://acevatech.com";
const SAMPLE_ID = "0b9d4c1e-7a52-4c3a-9d60-2f7f9f1c5b21";

/* ------------------------------------------------------------------ *
 * The real matcher, and the router's dual (raw + decoded) use of it    *
 * ------------------------------------------------------------------ */

// `next build` compiles `config.matcher` with this function. Next's published type declarations
// leave it out although the module exports it, hence the cast; if a future Next renames it, the
// guard below fails with a clear message instead of a TypeError.
const getMiddlewareMatchers = (pageStaticInfo as unknown as { getMiddlewareMatchers?: (matcher: string[], nextConfig: object) => ProxyMatcher[] })
  .getMiddlewareMatchers;
if (typeof getMiddlewareMatchers !== "function") {
  throw new Error("Next no longer exports getMiddlewareMatchers from get-page-static-info; update adminAccessRoutes.test.ts");
}
const compiledMatchers = getMiddlewareMatchers(config.matcher, {});
const matchesRaw = getMiddlewareRouteMatcher(compiledMatchers);

function matcherFires(pathname: string): boolean {
  const noRequest = {} as Parameters<typeof matchesRaw>[1]; // only read by `has`/`missing`, which are unused
  return matchesRaw(pathname, noRequest, {});
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** True when Next would run the proxy for this pathname: the matcher is tried on the raw AND the decoded form. */
function routerInvokesProxy(pathname: string): boolean {
  return matcherFires(pathname) || matcherFires(safeDecode(pathname));
}

/* ------------------------------------------------------------------ *
 * The app's real route table                                           *
 * ------------------------------------------------------------------ */

const APP_DIR = path.join(process.cwd(), "app");
const ROUTE_FILE = /^(?:page|route)\.(?:tsx|ts|jsx|js)$/;

/** URL patterns of every page and route handler, derived from the folders under app/. */
function collectRoutes(dir: string = APP_DIR, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Private (_x) folders and parallel slots (@x) are not URL segments; (groups) add none either.
      if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      routes.push(...collectRoutes(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]));
    } else if (ROUTE_FILE.test(entry.name)) {
      routes.push(`/${segments.join("/")}`);
    }
  }
  return routes;
}

function routeMatches(pattern: string, pathname: string): boolean {
  const want = pattern === "/" ? [] : pattern.slice(1).split("/");
  const have = pathname === "/" ? [] : pathname.slice(1).split("/");
  for (let i = 0; i < want.length; i += 1) {
    const segment = want[i];
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) return true;
    if (/^\[\.\.\..+\]$/.test(segment)) return have.length > i && have.slice(i).every((part) => part !== "");
    if (have[i] === undefined || have[i] === "") return false;
    if (/^\[.+\]$/.test(segment)) continue;
    if (segment !== have[i]) return false;
  }
  return have.length === want.length;
}

const APP_ROUTES = collectRoutes();

/** The route Next's file router would pick for a pathname (trailing slash trimmed, raw then decoded), or null. */
function appRouteFor(pathname: string): string | null {
  const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  for (const candidate of [trimmed, safeDecode(trimmed)]) {
    const route = APP_ROUTES.find((pattern) => routeMatches(pattern, candidate));
    if (route) return route;
  }
  return null;
}

function isAdminRoute(route: string): boolean {
  return route === "/admin" || route.startsWith("/admin/") || route === "/api/admin" || route.startsWith("/api/admin/");
}

/* ------------------------------------------------------------------ *
 * Proxy helpers                                                        *
 * ------------------------------------------------------------------ */

function req(pathname: string, init: { method?: string; cookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = { host: "acevatech.com" };
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`${ORIGIN}${pathname}`, { method: init.method ?? "GET", headers });
}

async function sessionCookie(): Promise<string> {
  return `__Host-aceva_admin_session=${await createSessionToken()}`;
}

function isPassThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_ALLOWED_HOSTS", "");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ *
 * Tests                                                                *
 * ------------------------------------------------------------------ */

describe("the compiled proxy matcher", () => {
  it("covers the admin surface and /mobile, and nothing else", () => {
    for (const pathname of [
      "/admin",
      "/admin/",
      "/admin/login",
      "/admin/documents/new",
      `/admin/documents/${SAMPLE_ID}/card`,
      "/api/admin",
      "/api/admin/login",
      `/api/admin/documents/${SAMPLE_ID}/qr`,
      "/mobile",
      "/mobile/page",
    ]) {
      expect(matcherFires(pathname), pathname).toBe(true);
    }
    for (const pathname of ["/", "/about", "/services/web", "/documents", "/verify/ACV-1", "/api/contact", "/api/pulse/chat", "/_next/static/x.js"]) {
      expect(matcherFires(pathname), pathname).toBe(false);
    }
  });

  it("still fires for the suffixed and data forms Next may hand over for an admin page", () => {
    for (const pathname of ["/admin.rsc", "/admin/documents.rsc", "/_next/data/BUILD/admin.json", "/_next/data/BUILD/admin/documents.json"]) {
      expect(matcherFires(pathname), pathname).toBe(true);
    }
  });

  it("is a list of plain string constants, which is what Next can analyse statically", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    for (const entry of config.matcher) expect(typeof entry).toBe("string");
  });
});

describe("unknown variants are ordinary 404s from the app", () => {
  // The matcher is a case-sensitive regex over the raw or decoded path, so none of these reach the
  // proxy; and the file router has no page or handler for any of them either.
  it.each([
    "/Admin",
    "/ADMIN",
    "/ADMIN/",
    "/aDmIn",
    "/Admin/login",
    "/ADMIN/LOGIN",
    "/admin;x",
    "/admin;x=1/login",
    "/administrator",
    "/administrator/index.php",
    "/admin-panel",
    "/admin_",
    "/adminlogin",
    "/admin.php",
    "/%41dmin",
    "/admin%00",
    "/login",
    "/signin",
    "/dashboard",
    "/wp-admin",
    "/wp-admin/",
    "/wp-login.php",
    "/console",
    "/backoffice",
    "/phpmyadmin",
    "/api/Admin/login",
    "/API/ADMIN/SESSION",
    "/api/administrator",
    "/api/admin-x",
    "/api/login",
  ])("%s", (pathname) => {
    expect(routerInvokesProxy(pathname), "proxy would run").toBe(false);
    expect(appRouteFor(pathname), "an app route exists").toBeNull();
  });
});

describe("spellings the router could decode into an admin path are refused by the proxy", () => {
  // The router tests the matcher against the DECODED path too, so these do reach the proxy; the
  // proxy sees the raw path, which is not canonical, and answers 404 whatever the session says.
  it.each([
    "/admin%2flogin",
    "/admin%2Flogin",
    "/admin/%6Cogin",
    "/admin/%6cogin",
    "/%61dmin/login",
    "/admin/login%2F",
    "/admin%2Fdocuments",
    "/api%2Fadmin%2Fsession",
    "/api/%61dmin/session",
    "/api/admin/%73ession",
    "/admin/Login",
    "/api/admin/Session",
    "/admin/login%00",
    "/admin/login%0a",
    "/admin/login%2e",
  ])("%s", async (pathname) => {
    expect(routerInvokesProxy(pathname), "proxy runs").toBe(true);
    const cookie = await sessionCookie();
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const withSession of [false, true]) {
        const response = await proxy(req(pathname, { method, cookie: withSession ? cookie : undefined }));
        expect(response.status, `${method} ${pathname} session=${withSession}`).toBe(404);
        expect(isPassThrough(response)).toBe(false);
        expect(response.headers.get("location")).toBeNull();
      }
    }
  });

  it("holds for every single percent-encoded character of the real entrances", async () => {
    const cookie = await sessionCookie();
    const entrances = ["/admin/login", "/admin/documents", `/admin/documents/${SAMPLE_ID}/card`, "/api/admin/session", `/api/admin/documents/${SAMPLE_ID}`];
    let checked = 0;
    for (const entrance of entrances) {
      for (let index = 1; index < entrance.length; index += 1) {
        const code = entrance.charCodeAt(index).toString(16);
        for (const hex of new Set([code.toUpperCase().padStart(2, "0"), code.toLowerCase().padStart(2, "0")])) {
          const variant = `${entrance.slice(0, index)}%${hex}${entrance.slice(index + 1)}`;
          // Every such spelling decodes to the real entrance, so the router would run the proxy for it.
          expect(routerInvokesProxy(variant), variant).toBe(true);
          // Protected and open entrances alike: an escaped spelling is never served, with or without a session.
          for (const request of [req(variant), req(variant, { cookie })]) {
            const response = await proxy(request);
            expect(response.status, variant).toBe(404);
            expect(isPassThrough(response), variant).toBe(false);
          }
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("treats dot segments by the URL parser's resolved path, like the router's URL handling", async () => {
    // Resolved to /x by the parser: not an admin path at all, so the fail-closed 404.
    expect((await proxy(req("/admin/%2e%2e/x"))).status).toBe(404);
    // Resolved to the canonical protected path: judged as that path (needs a session).
    expect((await proxy(req("/admin/login/../documents"))).status).toBe(307);
    // Resolved to the open login path: judged as the login path, which is the page it names.
    expect(isPassThrough(await proxy(req("/admin/./login")))).toBe(true);
  });
});

describe("slashes", () => {
  it.each([
    ["/admin//login", "/admin/login"],
    ["//admin/login", "/admin/login"],
    ["/admin\\login", "/admin/login"],
    ["/admin///login", "/admin/login"],
    ["/api//admin//session", "/api/admin/session"],
    ["/admin//documents//new", "/admin/documents/new"],
  ])("%s is redirected by the router to %s before any route or proxy runs, and the proxy refuses the raw form", async (raw, cleaned) => {
    // Next answers 308 with the cleaned URL (see resolve-routes.js / base-server.js); the cleaned
    // URL is then an ordinary request that passes through the proxy as the canonical path.
    expect(normalizeRepeatedSlashes(raw)).toBe(cleaned);
    expect(isCanonicalAdminPath(cleaned)).toBe(true);
    expect(routerInvokesProxy(cleaned)).toBe(true);
    // If the raw form ever did reach the proxy it would be refused, never judged.
    expect(isCanonicalAdminPath(raw)).toBe(false);
    if (raw.includes("\\")) return; // a backslash is rewritten by the URL parser before the proxy sees it
    const response = await proxy(req(raw));
    expect(response.status, raw).toBe(404);
    expect(isPassThrough(response)).toBe(false);
  });

  it("answers a trailing slash the same as its slashless twin", async () => {
    const cookie = await sessionCookie();
    for (const [plain, slashed] of [
      ["/admin", "/admin/"],
      ["/admin/login", "/admin/login/"],
      ["/admin/documents", "/admin/documents/"],
      ["/api/admin/session", "/api/admin/session/"],
      ["/api/admin/documents", "/api/admin/documents/"],
    ]) {
      expect(routerInvokesProxy(slashed), slashed).toBe(true);
      for (const init of [{}, { cookie }, { method: "POST" }]) {
        const a = await proxy(req(plain, init));
        const b = await proxy(req(slashed, init));
        expect(b.status, `${slashed} ${JSON.stringify(Object.keys(init))}`).toBe(a.status);
        expect(isPassThrough(b)).toBe(isPassThrough(a));
      }
    }
  });
});

describe("every admin route that exists is behind the gate", () => {
  const adminRoutes = APP_ROUTES.filter(isAdminRoute);

  it("finds the console's routes in the app folder", () => {
    expect(adminRoutes).toContain("/admin/login");
    expect(adminRoutes).toContain("/api/admin/login");
    expect(adminRoutes).toContain("/api/admin/session");
  });

  it("has no admin-flavoured route outside /admin and /api/admin, and none spelled with capitals", () => {
    for (const route of APP_ROUTES) {
      if (isAdminRoute(route)) continue;
      expect(route.toLowerCase(), `${route} looks like another way in`).not.toMatch(
        /admin|login|logout|signin|sign-in|dashboard|console|backoffice|cpanel|passkey/,
      );
    }
  });

  it("has no route at the guessable alternatives", () => {
    for (const guess of ["/login", "/logout", "/signin", "/dashboard", "/wp-admin", "/administrator", "/console", "/manage", "/cms"]) {
      expect(appRouteFor(guess), guess).toBeNull();
    }
  });

  it("is spelled in lower case, with the dynamic segment names as the only exception", () => {
    for (const route of adminRoutes) {
      expect(route.replace(/\[[^\]]+\]/g, ""), route).toBe(route.replace(/\[[^\]]+\]/g, "").toLowerCase());
    }
  });

  it("is reached by the proxy matcher, canonical, and not served without a session unless it is on the open list", async () => {
    const cookie = await sessionCookie();
    for (const route of adminRoutes) {
      const sample = route.replace(/\[\.\.\.[^\]]+\]/g, "a/b").replace(/\[[^\]]+\]/g, SAMPLE_ID);
      expect(isCanonicalAdminPath(sample), sample).toBe(true);
      expect(routerInvokesProxy(sample), sample).toBe(true);

      const open = ADMIN_OPEN_PATHS.has(sample);
      const anonymous = await proxy(req(sample));
      if (open) {
        expect(isPassThrough(anonymous), sample).toBe(true);
      } else {
        expect(isPassThrough(anonymous), sample).toBe(false);
        expect(anonymous.status, sample).toBe(sample.startsWith("/api/") ? 401 : 307);
      }
      expect(isPassThrough(await proxy(req(sample, { cookie }))), `${sample} with a session`).toBe(true);
    }
  });
});

describe("pages and handlers verify the session themselves", () => {
  // The proxy is an optimistic gate: a client-side navigation or a request the matcher never saw
  // must still be stopped by the page or handler. This reads the source with the TypeScript parser,
  // so a mention in a comment or a string does not count.
  function parse(file: string): ts.SourceFile {
    return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  }

  function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
    visit(node);
    ts.forEachChild(node, (child) => walk(child, visit));
  }

  function callsIn(node: ts.Node): Set<string> {
    const names = new Set<string>();
    walk(node, (child) => {
      if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) names.add(child.expression.text);
    });
    return names;
  }

  function filesNamed(dir: string, name: RegExp): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...filesNamed(full, name));
      else if (name.test(entry.name)) found.push(full);
    }
    return found;
  }

  const relative = (file: string) => path.relative(process.cwd(), file).replaceAll("\\", "/");
  const OPEN_API_DIRS = ["login", "logout", "session"];
  const HANDLER_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
  const STUB_FACTORIES = new Set(["methodNotAllowedHandler", "optionsHandler"]);

  it("has every admin page call requireAdminPage (the login page excepted)", () => {
    const adminApp = path.join(APP_DIR, "admin");
    const pages = filesNamed(adminApp, /^page\.tsx?$/).filter((file) => !relative(file).startsWith("app/admin/login/"));
    for (const file of pages) {
      expect(callsIn(parse(file)).has("requireAdminPage"), relative(file)).toBe(true);
    }
  });

  it("has every admin route handler call requireAdminRequest first-hand or through a local helper", () => {
    const apiAdmin = path.join(APP_DIR, "api", "admin");
    const handlers = filesNamed(apiAdmin, /^route\.ts$/).filter((file) => {
      const [first] = path.relative(apiAdmin, file).split(path.sep);
      return !OPEN_API_DIRS.includes(first);
    });

    for (const file of handlers) {
      const source = parse(file);
      const helpers = new Map<string, Set<string>>();
      const exported: Array<{ name: string; node: ts.Node }> = [];

      for (const statement of source.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name) {
          const isExported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
          if (isExported && HANDLER_NAMES.has(statement.name.text)) exported.push({ name: statement.name.text, node: statement });
          else helpers.set(statement.name.text, callsIn(statement));
        } else if (ts.isVariableStatement(statement)) {
          const isExported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
          for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
            if (isExported && HANDLER_NAMES.has(declaration.name.text)) exported.push({ name: declaration.name.text, node: declaration.initializer });
            else helpers.set(declaration.name.text, callsIn(declaration.initializer));
          }
        }
      }

      expect(exported.length, `${relative(file)} exports no handler`).toBeGreaterThan(0);
      for (const { name, node } of exported) {
        const direct = callsIn(node);
        const delegated = [...direct].some((callee) => helpers.get(callee)?.has("requireAdminRequest"));
        // A handler that only says "405 Method Not Allowed" or "here is what I allow" touches no
        // data and reveals nothing, so it needs no session of its own (the proxy still gates it).
        const isStub = direct.size > 0 && [...direct].every((callee) => STUB_FACTORIES.has(callee));
        expect(direct.has("requireAdminRequest") || delegated || isStub, `${relative(file)} ${name}`).toBe(true);
      }
    }
  });
});

describe("the proxy file", () => {
  it("is the only proxy: there is no middleware file next to it that Next would also load", () => {
    const root = readdirSync(process.cwd());
    expect(root).toContain("proxy.ts");
    expect(root.filter((name) => /^middleware\.(?:ts|js|mjs)$/.test(name))).toEqual([]);
  });
});
