/**
 * Prints a new admin pass key. Writes nothing to disk.
 *
 *   npm run admin:passkey
 *
 * The key is 24 characters from an alphabet with the look-alikes (0 O 1 l I) removed, shown in
 * four groups of six joined by hyphens. The hyphens are part of the key.
 */
import { randomBytes } from "node:crypto";

export const PASSKEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
export const PASSKEY_GROUPS = 4;
export const PASSKEY_GROUP_LENGTH = 6;

/**
 * Draws `length` characters uniformly from the alphabet.
 *
 * Bytes at or above the largest multiple of the alphabet size are discarded rather than folded in
 * with `%`; folding would make the first (256 mod 55) characters slightly more likely than the rest.
 */
export function randomPasskeyCharacters(
  length: number,
  alphabet: string = PASSKEY_ALPHABET,
  source: (size: number) => Uint8Array = randomBytes,
): string {
  const limit = 256 - (256 % alphabet.length);
  let result = "";
  while (result.length < length) {
    for (const byte of source(Math.max(16, (length - result.length) * 2))) {
      if (byte >= limit) continue;
      result += alphabet[byte % alphabet.length];
      if (result.length === length) break;
    }
  }
  return result;
}

export function generatePasskey(source?: (size: number) => Uint8Array): string {
  const raw = randomPasskeyCharacters(PASSKEY_GROUPS * PASSKEY_GROUP_LENGTH, PASSKEY_ALPHABET, source);
  const groups: string[] = [];
  for (let i = 0; i < PASSKEY_GROUPS; i += 1) {
    groups.push(raw.slice(i * PASSKEY_GROUP_LENGTH, (i + 1) * PASSKEY_GROUP_LENGTH));
  }
  return groups.join("-");
}

export function formatInstructions(passkey: string): string {
  return [
    "",
    "  ACEVA admin pass key",
    "  --------------------",
    `  ${passkey}`,
    "",
    "  To enable the admin console:",
    "    1. Local:   add this line to .env.local",
    `                ADMIN_PASSKEY=${passkey}`,
    "    2. Vercel:  Project Settings > Environment Variables > add ADMIN_PASSKEY",
    "                with the same value for the Production environment only (a deployment",
    "                without it has no console at all, which keeps preview URLs out),",
    "                then redeploy so the new value takes effect.",
    "    3. Also set ADMIN_ALLOWED_HOSTS=acevatech.com,www.acevatech.com for Production, so the",
    "       console answers only on the real site's own host names.",
    "",
    "  About the length:",
    "    - The console accepts any key of 8 or more characters. This one is 24 random characters",
    "      because a long key is the real defence. The lockout (5 wrong tries in 15 minutes, then",
    "      15 minutes, doubling up to 24 hours) is the backstop, not a substitute for it.",
    "",
    "  Important:",
    "    - This key is NOT shown again and is NOT saved anywhere. Store it in a password manager now.",
    "    - Never commit it to Git, paste it into chat or tickets, or put it in a NEXT_PUBLIC_ variable.",
    "    - Changing ADMIN_PASSKEY signs every admin session out. Run this command again to rotate it.",
    "",
  ].join("\n");
}

// Run only when executed directly (tsx scripts/generate-admin-passkey.ts), not when imported by tests.
if (/generate-admin-passkey\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  console.log(formatInstructions(generatePasskey()));
}
