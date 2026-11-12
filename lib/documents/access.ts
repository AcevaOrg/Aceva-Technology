import { timingSafeEqual } from "node:crypto";
import { normalizeVerificationCode } from "./codes";
import { toPublicDocument } from "./public";
import type { DocumentRecord, FileRole } from "./types";

/**
 * Who may receive a stored file, decided in one pure place.
 *
 * The file route and the verify pages both route through `toPublicDocument`, the registry's single
 * privacy boundary, so a file can never be reachable by URL when the page that would link to it is
 * not allowed to show it. Nothing here touches the database or the request: callers pass the record
 * (already loaded) and the facts about the requester.
 */

/* ------------------------------------------------------------------ *
 * The decision                                                         *
 * ------------------------------------------------------------------ */

export type FileAccessVia = "admin" | "public" | "code";

/**
 * Why a request was refused. The route answers every one of these with the same 404, so these
 * names exist for tests and for reasoning about the rules, never for a client.
 */
export type FileAccessDenial =
  | "no_file" // the record has no file in that role
  | "hidden" // draft, archived, private, unlisted without the code, or a personal record without consent
  | "revoked"
  | "not_shared" // primary file, but the admin allowed the public neither to view nor to download it
  | "download_off" // viewable, but a download was asked for and the admin did not allow public download
  | "photo_hidden"; // photo exists but the record does not opt in to showing it

export type FileAccessDecision = { allowed: true; via: FileAccessVia } | { allowed: false; reason: FileAccessDenial };

export interface FileAccessRequest {
  record: DocumentRecord;
  role: FileRole;
  /** The `code` query value as received (any spelling). Ignored unless it matches the record's code. */
  code?: string | null;
  /** The request asks for the file as a download (an attachment), not for it to be shown in the browser. */
  download?: boolean;
  /** True only when the caller has already verified an admin session. Anything else is a visitor. */
  isAdmin?: boolean;
  /** Injectable clock for the expiry maths inside `toPublicDocument`. */
  now?: Date;
}

/**
 * True when `supplied` is the record's verification code in any spelling. Both sides are reduced to
 * the canonical form and compared in constant time, so response timing reveals nothing about how
 * many leading characters of a guess were right.
 */
export function matchesVerificationCode(stored: string | null, supplied: unknown): boolean {
  if (!stored) return false;
  const canonical = normalizeVerificationCode(supplied);
  if (!canonical) return false;
  const expected = Buffer.from(stored, "utf8");
  const received = Buffer.from(canonical, "utf8");
  // timingSafeEqual throws on unequal lengths, and a length mismatch is not a secret here.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * The decision, for one record and one role.
 *
 *  - An admin may read any file that exists, whatever the record's state.
 *  - Everyone else is judged exactly like the page that would link to the file: presenting the
 *    record's own code is a "verify" lookup (public and unlisted records resolve, a personal record
 *    needs no listing consent because its holder is shown on the page anyway); presenting nothing,
 *    or the wrong code, is a "listing" view (public records only, personal ones only with consent).
 *  - The primary file additionally needs the admin to allow viewing or downloading it, and a request for it as a
 *    download needs `allowDownload` (view-only files are shown, never offered as an attachment). The photo needs
 *    the record's own opt-in.
 *  - Draft, archived, private and revoked records never yield a file.
 */
export function canAccessFile(request: FileAccessRequest): FileAccessDecision {
  const { record, role } = request;
  if (role !== "primary" && role !== "photo") return { allowed: false, reason: "no_file" };
  if (!record.files.some((file) => file.role === role)) return { allowed: false, reason: "no_file" };

  if (request.isAdmin === true) return { allowed: true, via: "admin" };

  const codeMatches = matchesVerificationCode(record.verificationCode, request.code);
  const projected = toPublicDocument(record, codeMatches ? "verify" : "listing", request.now);

  if (!projected) return { allowed: false, reason: "hidden" };
  if (projected.state === "revoked") return { allowed: false, reason: "revoked" };

  if (role === "primary") {
    if (!projected.hasFile) return { allowed: false, reason: "not_shared" };
    if (request.download === true && !projected.canDownload) return { allowed: false, reason: "download_off" };
    return { allowed: true, via: codeMatches ? "code" : "public" };
  }
  return projected.hasPhoto ? { allowed: true, via: codeMatches ? "code" : "public" } : { allowed: false, reason: "photo_hidden" };
}

/* ------------------------------------------------------------------ *
 * Request parsing                                                      *
 * ------------------------------------------------------------------ */

/** `role` query value → role. Absent means the document itself; anything unknown is rejected. */
export function parseFileRole(value: string | null): FileRole | null {
  if (value === null || value === "") return "primary";
  return value === "primary" || value === "photo" ? value : null;
}

/** `?download=1` (or `true`) asks for an attachment; everything else is shown inline. */
export function wantsDownload(value: string | null): boolean {
  return value === "1" || value === "true";
}

/* ------------------------------------------------------------------ *
 * Response headers                                                     *
 * ------------------------------------------------------------------ */

/**
 * next.config.ts applies a site-wide CSP with `object-src 'none'` and `frame-ancestors 'none'`,
 * which stops browsers from drawing a PDF in their built-in viewer. Files get this stricter,
 * different policy instead: nothing may load or run (`default-src 'none'`), the document may
 * be embedded by this origin only, and the viewer plugin is allowed for `self`.
 * A test pins next.config.ts to this exact string, because Next keeps the config's value when a
 * route sets the same header (it only appends headers the response does not already carry).
 */
export const FILE_RESPONSE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'";

/** The only types the registry stores. A row holding anything else is served as an opaque download. */
const SERVABLE_TYPES: ReadonlySet<string> = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function servableContentType(mimeType: string): { contentType: string; forceDownload: boolean } {
  return SERVABLE_TYPES.has(mimeType)
    ? { contentType: mimeType, forceDownload: false }
    : { contentType: "application/octet-stream", forceDownload: true };
}

/** Five minutes of shared caching, for files anyone may fetch without a code. */
export const PUBLIC_FILE_MAX_AGE_SECONDS = 300;

/**
 * `public` only when the request would be answered identically for an anonymous visitor: the record
 * is publicly listed AND a non-admin decision allows the file. An admin previewing a file the
 * public may not have must never leave a copy in a shared cache that the next visitor is served.
 */
export function fileCacheControl(record: DocumentRecord, allowedForVisitors: boolean): string {
  return allowedForVisitors && record.visibility === "public"
    ? `public, max-age=${PUBLIC_FILE_MAX_AGE_SECONDS}`
    : "private, no-store";
}

/** Headers shared by every successful file response. Contains no per-record data except the type. */
export function fileSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": FILE_RESPONSE_CSP,
    "X-Frame-Options": "SAMEORIGIN",
    // The `code` query value is a credential; it must not travel in a Referer header.
    "Referrer-Policy": "no-referrer",
    // Uploaded paper is not for search results or for other sites to embed.
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/* ------------------------------------------------------------------ *
 * Client address                                                       *
 * ------------------------------------------------------------------ */

/**
 * The first X-Forwarded-For hop, then X-Real-IP, else "unknown" — for server components, which see
 * `headers()` and not a `Request`. Trustworthy where the platform sets the header (Vercel).
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
