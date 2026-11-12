/**
 * How much of a certificate's life is behind it, for the thin validity bar on a credential pass.
 *
 * Pure and server-safe. Dates are whole UTC days (the registry stores them as YYYY-MM-DD), and a
 * record is valid THROUGH its expiry day, exactly as `computeVerificationState` treats it, so the
 * bar never disagrees with the verdict chip beside it.
 */

export type ValidityPhase =
  /** No expiry date: it never lapses. */
  | "open-ended"
  /** Comfortably inside its period. */
  | "running"
  /** Inside the last 90 days. */
  | "ending"
  /** The expiry day has passed. */
  | "ended";

export interface Validity {
  phase: ValidityPhase;
  /** Fraction of the period already used, 0 to 1. Null when it cannot be drawn (no end, or no start). */
  used: number | null;
  /** Whole days until the expiry day ends (0 on the last day, negative once ended). Null without an end date. */
  daysLeft: number | null;
  /** A short human span: "2 years 3 months", "40 days", "Today". Empty for an open-ended record. */
  span: string;
}

/** The last stretch before expiry that is worth drawing attention to. */
export const ENDING_SOON_DAYS = 90;

const DAY_MS = 86_400_000;

/** Whole UTC days since the epoch for a YYYY-MM-DD string, or null when it is not a real date. */
function utcDay(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : null;
}

/** "40 days", "5 months", "2 years 3 months": coarse on purpose, because a bar is not a stopwatch. */
export function formatSpan(days: number): string {
  const whole = Math.max(0, Math.floor(days));
  if (whole === 0) return "Today";
  if (whole <= 60) return `${whole} ${whole === 1 ? "day" : "days"}`;
  const months = Math.floor(whole / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearText = `${years} ${years === 1 ? "year" : "years"}`;
  return rest > 0 ? `${yearText} ${rest} ${rest === 1 ? "month" : "months"}` : yearText;
}

export function describeValidity(issuedOn: string | null, expiresOn: string | null, now: Date = new Date()): Validity {
  const end = utcDay(expiresOn);
  if (end === null) return { phase: "open-ended", used: null, daysLeft: null, span: "" };

  const today = Math.floor(now.getTime() / DAY_MS);
  const daysLeft = end - today;
  const start = utcDay(issuedOn);

  // A period needs a start strictly before its end; anything else cannot be drawn honestly.
  let used: number | null = null;
  if (start !== null && end > start) used = Math.min(1, Math.max(0, (today - start) / (end - start)));
  if (daysLeft < 0) used = used === null ? null : 1;

  if (daysLeft < 0) return { phase: "ended", used, daysLeft, span: formatSpan(-daysLeft) };
  return { phase: daysLeft <= ENDING_SOON_DAYS ? "ending" : "running", used, daysLeft, span: formatSpan(daysLeft) };
}
