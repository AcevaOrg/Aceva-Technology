import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import {
  ADMIN_LOGIN_PATH,
  SESSION_KEY_LABEL,
  getAdminCookieName,
  getAdminCookieOptions,
  getAdminPasskey,
  getSessionSecret,
  isAdminEnabled,
  isAdminRequestHostAllowed,
  sanitizeNextPath,
} from "@/lib/admin/config";
import { verifySessionToken } from "@/lib/admin/session";
import { ApiError, assertSameOrigin } from "@/lib/api/response";
import { checkRateLimit, cleanupRateLimitStore, getClientIp } from "@/lib/rateLimit";

/**
 * Server-side admin authorization. `proxy.ts` is only an optimistic gate; every admin page and
 * every /api/admin handler must still call `requireAdminPage` / `requireAdminRequest`, because a
 * proxy matcher can be changed or bypassed without anyone noticing.
 *
 * This is the one file that touches `next/headers`.
 */

// Re-exported so callers have a single import for everything about admin auth. The pure
// implementation lives in config.ts so proxy.ts can share it without pulling in next/headers.
export { sanitizeNextPath };

export type AdminSession = { issuedAt: number; expiresAt: number };

/* ------------------------------------------------------------------ *
 * Reading the session                                                  *
 * ------------------------------------------------------------------ */

async function sessionFromToken(token: string | undefined): Promise<AdminSession | null> {
  if (!isAdminEnabled()) return null;
  const result = await verifySessionToken(token);
  return result.valid ? { issuedAt: result.issuedAt, expiresAt: result.expiresAt } : null;
}

/** Reads one cookie out of a raw `Cookie` header. The first cookie with that name wins. */
function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

/** The session for the current Server Component / Server Action request, or null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isAdminEnabled()) return null;
  const store = await cookies();
  return sessionFromToken(store.get(getAdminCookieName())?.value);
}

/**
 * The session carried by a `Request`, or null. Unlike `requireAdminRequest` it checks nothing
 * else (origin, rate limit) and never throws, so the login/logout/session routes can use it.
 */
export async function getRequestSession(request: Request): Promise<AdminSession | null> {
  return sessionFromToken(readCookie(request.headers.get("cookie"), getAdminCookieName()));
}

/* ------------------------------------------------------------------ *
 * Guards                                                               *
 * ------------------------------------------------------------------ */

/**
 * Guard for admin pages and layouts. A disabled console is a 404 (it must not reveal itself);
 * a missing or invalid session redirects to the login page, remembering where to come back to.
 */
export async function requireAdminPage(returnTo?: string): Promise<AdminSession> {
  // The proxy already refuses an unlisted host. Checking again here is defence in depth: if a platform
  // ever served a page without running the proxy, the host lock would still hold.
  if (!isAdminEnabled() || !isAdminRequestHostAllowed(await headers())) notFound();
  const session = await getAdminSession();
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(sanitizeNextPath(returnTo))}`);
  return session;
}

/**
 * Guard for /api/admin handlers. Throws an `ApiError` that `withRouteErrorHandling` turns into
 * the canonical envelope: NOT_FOUND when the console is disabled, UNAUTHENTICATED without a
 * valid session, FORBIDDEN_ORIGIN for a cross-origin mutation, RATE_LIMITED past the budget.
 *
 * Reads the Cookie header rather than `next/headers` so it can be called (and tested) with a
 * plain `Request`. The rate limit is counted only after authentication, so anonymous traffic
 * cannot fill the limiter's table with spoofed addresses or burn the owner's budget.
 */
export async function requireAdminRequest(request: Request): Promise<AdminSession> {
  // Same 404 for a disabled console and for a host the console is not allowed on (see requireAdminPage).
  if (!isAdminEnabled() || !isAdminRequestHostAllowed(request.headers)) throw new ApiError("NOT_FOUND");

  const session = await getRequestSession(request);
  if (!session) throw new ApiError("UNAUTHENTICATED", {}, { reason: "no-valid-session" });

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") assertSameOrigin(request);

  const ip = getClientIp(request);
  const limit = checkRateLimit("admin-api", ip);
  if (!limit.allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      { retryAfter: limit.retryAfter, message: "Too many admin requests. Please wait a moment and try again." },
      { scope: "admin-api" },
    );
  }
  if (Math.random() < 0.01) cleanupRateLimitStore();

  return session;
}

/* ------------------------------------------------------------------ *
 * Cookie                                                               *
 * ------------------------------------------------------------------ */

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(getAdminCookieName(), token, getAdminCookieOptions());
}

/**
 * Expires the cookie. It repeats every attribute (Secure, Path, SameSite) because a `__Host-`
 * cookie can only be overwritten by a Set-Cookie that also satisfies the prefix rules; a bare
 * delete would be ignored by the browser and the session would survive "logout".
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(getAdminCookieName(), "", { ...getAdminCookieOptions(0), maxAge: 0, expires: new Date(0) });
}

/* ------------------------------------------------------------------ *
 * Actor identity                                                       *
 * ------------------------------------------------------------------ */

const IP_HASH_LABEL = "aceva-admin-ip-hash-key-v1";
const UNKEYED_IP_HASH_LABEL = "aceva-admin-ip-hash-unkeyed";

/** Mirrors the key `session.ts` signs with (synchronously, because callers here are synchronous). */
function sessionKeyBytes(): Buffer | null {
  if (!isAdminEnabled()) return null;
  const secret = getSessionSecret();
  if (secret) return Buffer.from(secret, "utf8");
  const passkey = getAdminPasskey();
  if (!passkey) return null;
  return createHmac("sha256", passkey).update(SESSION_KEY_LABEL).digest();
}

/**
 * A stable, non-reversible handle for a client address: the first 16 hex characters of an
 * HMAC keyed (via a purpose-specific subkey) by the session key. A raw IP is personal data and
 * IPv4 space is small enough to brute-force an unkeyed hash, so neither is ever stored.
 */
export function hashIp(ip: string): string {
  const sessionKey = sessionKeyBytes();
  // With the console disabled nothing is stored, so a fixed label is only a never-throw fallback.
  const subkey = createHmac("sha256", sessionKey ?? UNKEYED_IP_HASH_LABEL).update(IP_HASH_LABEL).digest();
  return createHmac("sha256", subkey).update(ip).digest("hex").slice(0, 16);
}

/** The audit-log actor for a request: "admin:" plus the hashed client address. */
export function getRequestActor(request: Request): string {
  return `admin:${hashIp(getClientIp(request))}`;
}
