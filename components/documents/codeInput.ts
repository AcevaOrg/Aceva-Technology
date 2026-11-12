/**
 * Verification-code typing helpers for the browser.
 *
 * `lib/documents/codes.ts` is the authority, but it imports node:crypto and so cannot ship to a
 * client component. This is the small, dependency-free mirror of its `normalizeVerificationCode`
 * (same alphabet, same O→0 / I→1 / L→1 corrections) plus the as-you-type formatter. A test pins the
 * two together; the server always re-normalises, so this only has to be helpful, never trusted.
 */

const PREFIX = "ACV";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 12;
const GROUP_LENGTH = 4;
/** The longest paste worth looking at; matches the server's own cap. */
export const MAX_CODE_INPUT = 64;

/** Letters and digits only, upper-cased: hyphens, spaces and stray punctuation all disappear. */
function compact(input: string): string {
  return input.slice(0, MAX_CODE_INPUT).normalize("NFKC").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function hyphenate(body: string): string {
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LENGTH) groups.push(body.slice(i, i + GROUP_LENGTH));
  return groups.join("-");
}

/**
 * Re-formats whatever is in the box as `ACV-XXXX-XXXX-XXXX` while the visitor types or pastes.
 * A hyphen only appears once the next group has a character, so backspace never gets stuck on one.
 * Typing a body without the ACV prefix is fine: the prefix is supplied for them.
 */
export function formatCodeInput(raw: string): string {
  const chars = compact(raw);
  if (chars === "") return "";

  // "A", "AC" and "ACV" are the prefix being typed, not yet a body.
  if (chars.length <= PREFIX.length && PREFIX.startsWith(chars)) return chars;

  const body = (chars.startsWith(PREFIX) ? chars.slice(PREFIX.length) : chars).slice(0, BODY_LENGTH);
  return `${PREFIX}-${hyphenate(body)}`;
}

/** How many characters of the 12-character body are still missing (0 = complete). */
export function charactersRemaining(raw: string): number {
  const chars = compact(raw);
  if (PREFIX.startsWith(chars)) return BODY_LENGTH;
  const typed = chars.startsWith(PREFIX) ? chars.length - PREFIX.length : chars.length;
  return Math.max(0, BODY_LENGTH - typed);
}

/**
 * The canonical code for what was typed, or null when it cannot be one. Mirrors the server, with one
 * kindness: a bare 12-character body (someone who left the ACV off) is accepted.
 */
export function normalizeCodeInput(raw: string): string | null {
  const chars = compact(raw);

  let body: string;
  if (chars.length === PREFIX.length + BODY_LENGTH && chars.startsWith(PREFIX)) body = chars.slice(PREFIX.length);
  else if (chars.length === BODY_LENGTH) body = chars;
  else return null;

  body = body.replace(/O/g, "0").replace(/[IL]/g, "1");
  for (const char of body) {
    if (!ALPHABET.includes(char)) return null;
  }
  return `${PREFIX}-${hyphenate(body)}`;
}
