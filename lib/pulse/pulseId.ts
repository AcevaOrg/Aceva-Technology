import { randomBytes } from "node:crypto";

/**
 * PULSE reference IDs, generated only on the server.
 *
 * The old IDs were invented by the browser as PLS-YYMMDD-NNN: 900 values a
 * day, chosen by the client, accepted as sent. Anyone could pre-claim the day's
 * whole range so real visitors' saves failed (red-team R2), claim future dates
 * (R3), and real visitors collided by chance (4.9% of days at 10 leads a day).
 *
 * New IDs keep the date for humans and add 40 random bits from the OS CSPRNG,
 * written in Crockford base32 so they read aloud cleanly:
 *
 *   PLS-261030-7KQ2-M9XD
 *
 * 2^40 ≈ 1.1 trillion values per day. Guessing one saved that day takes on the
 * order of 10^11 attempts at the rate limits in force, and a collision between
 * two real saves is negligible; the insert is still conflict-checked.
 */

/** Crockford base32: no I, L, O or U, so nothing is misread. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const PULSE_ID_PATTERN = /^PLS-(\d{2})(\d{2})(\d{2})-([0-9A-HJKMNP-TV-Z]{4})-([0-9A-HJKMNP-TV-Z]{4})$/;

/**
 * Any mention of a PULSE reference in free text, well-formed or not, in either
 * format. Requires the dash so that "pls" used as "please" is not mistaken for
 * one. Lives here, not in llm.ts, because route tests mock that module whole.
 */
export const PULSE_ID_MENTION = /\bPLS-[A-Z0-9]/i;

/** The guessable browser-generated format. Recognised only so it can be refused. */
export const LEGACY_PULSE_ID_PATTERN = /^PLS-\d{6}-\d{3}$/;

/** How long a reference may be used for self-service actions. Overridable, 1–3650. */
export function pulseIdMaxAgeDays(): number {
  const raw = Number(process.env.PULSE_ID_MAX_AGE_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return 365;
  return Math.min(3650, Math.max(1, Math.floor(raw)));
}

function yymmdd(date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** 40 bits as 8 Crockford characters. */
function randomBlock(): string {
  // 40 bits fit exactly in a double (integers are exact below 2^53).
  let value = 0;
  for (const byte of randomBytes(5)) value = value * 256 + byte;
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

export function generatePulseId(now: Date = new Date()): string {
  const block = randomBlock();
  return `PLS-${yymmdd(now)}-${block.slice(0, 4)}-${block.slice(4)}`;
}

export type PulseIdCheck =
  | { ok: true; id: string }
  | { ok: false; reason: "malformed" | "legacy" | "future" | "expired" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validates a reference a visitor typed or sent. Legacy references are refused
 * for self-service actions because they are guessable; a future date allows one
 * day of clock and time-zone slack; an expired one is older than the max age.
 */
export function checkPulseId(raw: unknown, now: Date = new Date()): PulseIdCheck {
  if (typeof raw !== "string") return { ok: false, reason: "malformed" };
  const id = raw.trim().toUpperCase();
  if (id.length > 32) return { ok: false, reason: "malformed" };
  if (LEGACY_PULSE_ID_PATTERN.test(id)) return { ok: false, reason: "legacy" };

  const match = id.match(PULSE_ID_PATTERN);
  if (!match) return { ok: false, reason: "malformed" };

  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const issued = new Date(Date.UTC(year, month - 1, day));
  // Round-trip check rejects impossible dates such as 0231.
  if (issued.getUTCFullYear() !== year || issued.getUTCMonth() !== month - 1 || issued.getUTCDate() !== day) {
    return { ok: false, reason: "malformed" };
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (issued.getTime() > today + DAY_MS) return { ok: false, reason: "future" };
  if (issued.getTime() < today - pulseIdMaxAgeDays() * DAY_MS) return { ok: false, reason: "expired" };

  return { ok: true, id };
}
