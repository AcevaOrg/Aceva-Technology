import {
  MAX_SESSION_SECONDS,
  SESSION_KEY_LABEL,
  getAdminPasskey,
  getSessionSecret,
  getSessionTtlSeconds,
  isAdminEnabled,
} from "@/lib/admin/config";

/**
 * Stateless signed admin session.
 *
 * Web Crypto only, so the same code runs in `proxy.ts` and in route handlers. A token is
 *
 *   v1.<issuedAtMs>.<expiresAtMs>.<nonce>.<hmac-sha256 base64url>
 *
 * There is no server-side session table: the signature is the proof. The price is that a single
 * token cannot be revoked early; signing everyone out means changing ADMIN_PASSKEY or
 * ADMIN_SESSION_SECRET, which changes the signing key.
 */

const VERSION = "v1";
const MAX_TOKEN_LENGTH = 256;
/** Tolerated clock difference between instances. Anything issued further ahead is rejected. */
const MAX_FUTURE_SKEW_MS = 60_000;
const NONCE_BYTES = 16;

const TIMESTAMP = /^[0-9]{1,15}$/;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
// 32-byte HMAC-SHA256 → 43 unpadded base64url characters.
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

const encoder = new TextEncoder();

export type SessionVerification = { valid: true; issuedAt: number; expiresAt: number } | { valid: false };

const INVALID: SessionVerification = { valid: false };

/* ------------------------------------------------------------------ *
 * Primitives                                                           *
 * ------------------------------------------------------------------ */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 of a string. Hashing both sides first gives the comparison below equal-length inputs. */
export async function sha256Bytes(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/**
 * Compares two byte strings without exiting at the first difference. Callers pass fixed-length
 * digests, so the length mix-in is a backstop rather than the mechanism.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function importHmacKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/**
 * The HMAC key, or null when the console is disabled.
 *
 * ADMIN_SESSION_SECRET (32+ chars) wins when present. Otherwise the key is derived from the pass
 * key, which is what makes rotating the pass key sign every admin out.
 */
async function getSigningKey(): Promise<CryptoKey | null> {
  if (!isAdminEnabled()) return null;

  const secret = getSessionSecret();
  if (secret) return importHmacKey(encoder.encode(secret));

  const passkey = getAdminPasskey();
  if (!passkey) return null;
  const base = await importHmacKey(encoder.encode(passkey));
  const derived = await crypto.subtle.sign("HMAC", base, encoder.encode(SESSION_KEY_LABEL));
  return importHmacKey(new Uint8Array(derived));
}

async function sign(key: CryptoKey, data: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

/* ------------------------------------------------------------------ *
 * Public API                                                           *
 * ------------------------------------------------------------------ */

export interface CreateSessionOptions {
  /** Override the clock (tests). */
  now?: number;
  /** Override the lifetime; defaults to ADMIN_SESSION_HOURS. Clamped to 1 second .. 72 hours. */
  ttlSeconds?: number;
}

/** Issues a signed token. Throws only when the console is disabled, which callers check first. */
export async function createSessionToken(options: CreateSessionOptions = {}): Promise<string> {
  const key = await getSigningKey();
  if (!key) throw new Error("Admin sessions are unavailable: the console is not enabled.");

  const issuedAt = Math.floor(options.now ?? Date.now());
  const requestedTtl = Math.floor(options.ttlSeconds ?? getSessionTtlSeconds());
  const ttl = Math.min(MAX_SESSION_SECONDS, Math.max(1, Number.isFinite(requestedTtl) ? requestedTtl : 1));
  const expiresAt = issuedAt + ttl * 1000;

  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
  const payload = `${VERSION}.${issuedAt}.${expiresAt}.${nonce}`;
  return `${payload}.${await sign(key, payload)}`;
}

/**
 * Checks a token. Never throws and never says why it failed: callers get `{ valid: false }` for a
 * wrong version, malformed segment, bad signature, expiry, a future-dated issue time, an
 * oversized value or a disabled console alike.
 */
export async function verifySessionToken(
  token: string | null | undefined,
  options: { now?: number } = {},
): Promise<SessionVerification> {
  try {
    if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return INVALID;

    // Structure first: it is cheap and means the HMAC only ever runs over well-formed input.
    const parts = token.split(".");
    if (parts.length !== 5) return INVALID;
    const [version, issuedRaw, expiresRaw, nonce, signature] = parts;
    if (version !== VERSION) return INVALID;
    if (!TIMESTAMP.test(issuedRaw) || !TIMESTAMP.test(expiresRaw)) return INVALID;
    if (!NONCE.test(nonce) || !SIGNATURE.test(signature)) return INVALID;

    const key = await getSigningKey();
    if (!key) return INVALID;

    // Compare digests of the two signature strings. Hashing first removes any dependence of the
    // comparison time on where the strings differ, and unlike decoding to bytes it also rejects
    // non-canonical base64url spellings of a correct signature.
    const expected = await sign(key, `${version}.${issuedRaw}.${expiresRaw}.${nonce}`);
    const [expectedDigest, providedDigest] = await Promise.all([sha256Bytes(expected), sha256Bytes(signature)]);
    if (!constantTimeEqual(expectedDigest, providedDigest)) return INVALID;

    const issuedAt = Number(issuedRaw);
    const expiresAt = Number(expiresRaw);
    const now = options.now ?? Date.now();
    if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return INVALID;
    if (issuedAt > now + MAX_FUTURE_SKEW_MS) return INVALID;
    if (expiresAt <= now) return INVALID;
    if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_SESSION_SECONDS * 1000) return INVALID;

    return { valid: true, issuedAt, expiresAt };
  } catch {
    return INVALID;
  }
}
