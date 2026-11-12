import { isHostAllowed, parseHostList, readRequestHost, type HeaderReader } from "@/lib/admin/hosts";
import { MAX_PRIMARY_BYTES } from "@/lib/documents/types";

/**
 * Static configuration of the /admin gate.
 *
 * Imported by `proxy.ts`, so it must stay pure: it reads `process.env` and nothing else — no
 * `fs`, no Node-only modules, no `next/headers`. Everything that needs those lives in `auth.ts`.
 */

/**
 * Shortest pass key that enables the console. Anything shorter is treated as "not configured".
 *
 * Eight is the owner's deliberate choice. What makes a short key tolerable is the persistent
 * lockout in `throttle.ts` (5 failures in 15 minutes, doubling per repeat up to 24 h, stored in
 * Postgres), together with the host lock below; a long random key (`npm run admin:passkey`) is
 * still the recommendation.
 */
export const MIN_PASSKEY_LENGTH = 8;

/** Shortest `ADMIN_SESSION_SECRET` that is used as the signing key. Shorter values are ignored. */
export const MIN_SESSION_SECRET_LENGTH = 32;

/** Domain-separation label for the key derived from the pass key (see `lib/admin/session.ts`). */
export const SESSION_KEY_LABEL = "aceva-admin-session-key-v1";

export const MIN_SESSION_HOURS = 1;
export const MAX_SESSION_HOURS = 72;
export const DEFAULT_SESSION_HOURS = 8;
/** The longest a session token may live, whatever the env says. */
export const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 3600;

const MIN_UPLOAD_MB = 1;
const MAX_UPLOAD_MB = 4;

const PRODUCTION_COOKIE_NAME = "__Host-aceva_admin_session";
const DEVELOPMENT_COOKIE_NAME = "aceva_admin_session";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Parses a finite number from an env var; `undefined` for unset, empty or non-numeric values. */
function readNumberEnv(name: string): number | undefined {
  const raw = readEnv(name);
  if (raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ *
 * Pass key, secret and enablement                                      *
 * ------------------------------------------------------------------ */

/**
 * The configured pass key, or null when the console is disabled. A key that is too short is
 * treated exactly like an absent one: a weak key must never be able to unlock the console.
 */
export function getAdminPasskey(): string | null {
  const passkey = readEnv("ADMIN_PASSKEY");
  return passkey.length >= MIN_PASSKEY_LENGTH ? passkey : null;
}

/** False means the whole /admin and /api/admin surface answers 404 as if it did not exist. */
export function isAdminEnabled(): boolean {
  return getAdminPasskey() !== null;
}

/** The explicit signing secret, or null when it is unset or shorter than 32 characters. */
export function getSessionSecret(): string | null {
  const secret = readEnv("ADMIN_SESSION_SECRET");
  return secret.length >= MIN_SESSION_SECRET_LENGTH ? secret : null;
}

/* ------------------------------------------------------------------ *
 * Host lock                                                            *
 * ------------------------------------------------------------------ */

/**
 * The hosts the console may be reached on (`ADMIN_ALLOWED_HOSTS`, comma-separated bare host
 * names), canonicalised by `hosts.ts`.
 *
 * - `null`: the variable is unset or blank, so there is no host restriction at all.
 * - `[]`: the variable is set but holds no valid host (for example a URL with `https://` in front).
 *   That locks the console for every host rather than silently dropping the restriction, so the
 *   typo is noticed on the first request instead of never.
 */
export function getAllowedAdminHosts(): string[] | null {
  const raw = readEnv("ADMIN_ALLOWED_HOSTS");
  return raw === "" ? null : parseHostList(raw);
}

/**
 * True when the request's host may see the console. Outside production, localhost, 127.0.0.1
 * and [::1] are always allowed so `next dev` keeps working with the production list in place.
 * Preview deployments run with NODE_ENV=production, so they get no such exemption.
 */
export function isAdminRequestHostAllowed(headers: HeaderReader): boolean {
  return isHostAllowed(readRequestHost(headers), getAllowedAdminHosts(), {
    allowLoopback: process.env.NODE_ENV !== "production",
  });
}

/* ------------------------------------------------------------------ *
 * Session lifetime and upload limits                                   *
 * ------------------------------------------------------------------ */

/** Session lifetime in seconds: `ADMIN_SESSION_HOURS` as an integer clamped to 1-72, default 8. */
export function getSessionTtlSeconds(): number {
  const configured = readNumberEnv("ADMIN_SESSION_HOURS");
  const hours =
    configured === undefined ? DEFAULT_SESSION_HOURS : clamp(Math.trunc(configured), MIN_SESSION_HOURS, MAX_SESSION_HOURS);
  return hours * 3600;
}

/**
 * Largest single upload in bytes: `ADMIN_MAX_UPLOAD_MB` clamped to 1-4 (default 4), and never
 * above `MAX_PRIMARY_BYTES`, which is what keeps the whole request under Vercel's body cap.
 */
export function getMaxUploadBytes(): number {
  const configured = readNumberEnv("ADMIN_MAX_UPLOAD_MB");
  const megabytes = configured === undefined ? MAX_UPLOAD_MB : clamp(configured, MIN_UPLOAD_MB, MAX_UPLOAD_MB);
  return Math.min(Math.floor(megabytes * 1024 * 1024), MAX_PRIMARY_BYTES);
}

/* ------------------------------------------------------------------ *
 * Cookie                                                               *
 * ------------------------------------------------------------------ */

/**
 * The cookie name for the current environment. The `__Host-` prefix binds the cookie to this
 * exact host over HTTPS, but it requires `Secure`, which some browsers refuse on plain-http
 * dev servers, so it is applied in production only.
 */
export function getAdminCookieName(): string {
  return process.env.NODE_ENV === "production" ? PRODUCTION_COOKIE_NAME : DEVELOPMENT_COOKIE_NAME;
}

/** `getAdminCookieName()` frozen at module load. Prefer the function where tests flip NODE_ENV. */
export const ADMIN_COOKIE_NAME: string = getAdminCookieName();

export interface AdminCookieOptions {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: "/";
  maxAge: number;
}

/** Attributes for the session cookie. `secure` follows NODE_ENV so local http dev still works. */
export function getAdminCookieOptions(maxAgeSeconds: number = getSessionTtlSeconds()): AdminCookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/* ------------------------------------------------------------------ *
 * Paths                                                                *
 * ------------------------------------------------------------------ */

export const ADMIN_HOME_PATH = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * The only paths served without a session. Exact matches after `normalizeAdminPath`: a prefix
 * rule here would silently open every path beneath it.
 */
export const ADMIN_OPEN_PATHS: ReadonlySet<string> = new Set([
  ADMIN_LOGIN_PATH,
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/session",
]);

/** Lower-cases and strips ONE trailing slash, so `/Admin/Login/` compares equal to `/admin/login`. */
export function normalizeAdminPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

/** True for `/admin`, `/api/admin` and anything beneath them, in any letter case. */
export function isAdminSurfacePath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return (
    lower === "/admin" || lower.startsWith("/admin/") || lower === "/api/admin" || lower.startsWith("/api/admin/")
  );
}

/** True when the path may be served without a session. Anything unusual is not open. */
export function isOpenAdminPath(pathname: string): boolean {
  return ADMIN_OPEN_PATHS.has(normalizeAdminPath(pathname));
}

// `/admin` or `/api/admin`, then any number of segments, then at most one trailing slash. Segments
// are lower-case letters, digits and `. _ -` only: every real admin path (static names and the
// lower-case UUIDs of documents) fits, and nothing that a router could decode, case-fold, split
// on `;` or collapse into a different path does.
const CANONICAL_ADMIN_PATH = /^\/(?:api\/)?admin(?:\/[a-z0-9._-]+)*\/?$/;

/**
 * True only for the one spelling of an admin path that is an entrance: exactly `/admin...` or
 * `/api/admin...` in lower case, with no percent-escapes, no empty segments (`//`), no
 * `;` parameters and no `.` or `..` segments.
 *
 * The router decodes, trims and compares paths on its own terms, and the proxy matcher is a regex
 * over the raw text. A request spelled any other way is therefore answered with a 404 before
 * either of them can disagree about what it means.
 */
export function isCanonicalAdminPath(pathname: string): boolean {
  if (!CANONICAL_ADMIN_PATH.test(pathname)) return false;
  return !pathname.split("/").some((segment) => segment === "." || segment === "..");
}

const MAX_NEXT_PATH_LENGTH = 300;
// C0/C1 controls: a tab or newline inside "/\t/evil.com" is stripped by browsers and turns it into "//evil.com".
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** Shape rules for one candidate (raw or percent-decoded). */
function isSafeAdminPath(candidate: string): boolean {
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return false;
  if (candidate.includes("\\") || CONTROL_CHARACTERS.test(candidate)) return false;

  const path = candidate.split(/[?#]/, 1)[0];
  if (path.includes("//")) return false;
  if (path.split("/").some((segment) => segment === "." || segment === "..")) return false;

  // Case-sensitive on purpose: /Admin is not a route, so it is not a destination.
  if (path !== ADMIN_HOME_PATH && !path.startsWith(`${ADMIN_HOME_PATH}/`)) return false;

  // The login page (and anything under it) as a destination would bounce straight back to itself.
  const normalized = normalizeAdminPath(path);
  return normalized !== ADMIN_LOGIN_PATH && !normalized.startsWith(`${ADMIN_LOGIN_PATH}/`);
}

/**
 * Turns an untrusted `next` value into a safe post-login destination: an internal path under
 * /admin, or "/admin". Fails closed — anything doubtful becomes the default rather than being
 * repaired, because a "fixed up" open-redirect payload is still a payload.
 *
 * The raw value and its percent-decoded forms (up to twice) must all pass, so `%2F%2Fevil.com`,
 * `%5C` and `%2e%2e` cannot slip through a layer that decodes later.
 */
export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_NEXT_PATH_LENGTH) return ADMIN_HOME_PATH;

  let candidate = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (!isSafeAdminPath(candidate)) return ADMIN_HOME_PATH;
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      // A malformed escape in the raw value is never produced by a browser: reject it. After a
      // first decode it is just a literal "%" (a search for "100%" arrives as q=100%25), and every
      // form that could be decoded has already passed.
      return pass === 0 ? ADMIN_HOME_PATH : value;
    }
    if (decoded === candidate) return value;
    candidate = decoded;
  }
  // Still changing after two decodes: nobody legitimate triple-encodes a path.
  return ADMIN_HOME_PATH;
}
