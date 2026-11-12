import { randomBytes } from "node:crypto";

/**
 * Verification codes: `ACV-XXXX-XXXX-XXXX`, 60 bits drawn from the Crockford base32 alphabet.
 *
 * The alphabet drops I, L, O and U so a code read off a printed certificate or typed from a phone
 * photo cannot be mistaken for another one. 2^60 possibilities make the code unguessable: with
 * lookups rate-limited, enumerating the space is not a realistic attack.
 */

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const VERIFICATION_CODE_PREFIX = "ACV";

const GROUP_COUNT = 3;
const GROUP_LENGTH = 4;
const BODY_LENGTH = GROUP_COUNT * GROUP_LENGTH;
const MAX_INPUT_LENGTH = 64;
const MAX_DRAW_ROUNDS = 64;

/** Anything that fills a buffer with cryptographically secure random bytes. Overridable for tests. */
export type RandomSource = (size: number) => Uint8Array;

const CANONICAL = /^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Draws a fresh code.
 *
 * Rejection sampling: a byte is used only when it falls below the largest multiple of the
 * alphabet size that fits in 256, so every symbol is exactly as likely as every other. With the
 * current 32-symbol alphabet that bound is 256 and nothing is ever rejected; the guard stays so a
 * future alphabet change cannot quietly introduce modulo bias.
 */
export function generateVerificationCode(source: RandomSource = randomBytes): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let body = "";
  for (let round = 0; body.length < BODY_LENGTH && round < MAX_DRAW_ROUNDS; round += 1) {
    const bytes = source(BODY_LENGTH * 2);
    for (let i = 0; i < bytes.length && body.length < BODY_LENGTH; i += 1) {
      if (bytes[i] < limit) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
  }
  if (body.length < BODY_LENGTH) throw new Error("Random source did not yield enough entropy for a verification code.");
  return formatBody(body);
}

function formatBody(body: string): string {
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LENGTH) groups.push(body.slice(i, i + GROUP_LENGTH));
  return `${VERIFICATION_CODE_PREFIX}-${groups.join("-")}`;
}

/**
 * Accepts what a human might type or paste and returns the canonical hyphenated code, or null.
 *
 * Case, spaces, hyphens (including typographic dashes) and zero-width characters are ignored, and
 * the classic look-alikes are corrected the way Crockford base32 defines: O→0, I→1, L→1.
 * The `ACV` prefix is required; anything outside the alphabet (including U) is rejected.
 */
export function normalizeVerificationCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_INPUT_LENGTH) return null;

  const compact = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\u2010-\u2015\u2212\u200B-\u200D\u2060\uFEFF-]+/g, "");

  if (compact.length !== VERIFICATION_CODE_PREFIX.length + BODY_LENGTH) return null;
  if (!compact.startsWith(VERIFICATION_CODE_PREFIX)) return null;

  const body = compact
    .slice(VERIFICATION_CODE_PREFIX.length)
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  for (let i = 0; i < body.length; i += 1) {
    if (!CODE_ALPHABET.includes(body[i])) return null;
  }
  return formatBody(body);
}

/** True only for a code already in canonical form (what is stored and printed). */
export function isVerificationCode(value: unknown): boolean {
  return typeof value === "string" && CANONICAL.test(value);
}
