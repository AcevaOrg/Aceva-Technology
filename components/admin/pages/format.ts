/**
 * Formatting helpers shared by the console pages. Pure and dependency-free (no React, no server
 * modules) so they are safe to import from client components and trivial to unit test.
 *
 * Dates that arrive as `YYYY-MM-DD` (issue and expiry dates) are never turned into a `Date` for
 * display: a calendar day has no time zone, and `new Date("2026-03-12")` would shift it for anyone
 * west of UTC. Timestamps are formatted from their UTC fields for the same reason.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DAY_MS = 86_400_000;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "12 Mar 2026", or an em dash for an absent or malformed date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = CALENDAR_DAY.exec(value);
  if (!match) return "—";
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
  return `${day} ${MONTHS[month - 1]} ${match[1]}`;
}

/** Whole days since 1970-01-01 for a `YYYY-MM-DD` string; null when it is not a real calendar day. */
export function dayNumber(value: string): number | null {
  const match = CALENDAR_DAY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Date.UTC rolls 31 Feb into March; comparing the fields back rejects it.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return Math.round(ms / DAY_MS);
}

/** Calendar days from `from` to `to` (positive when `to` is later). Null if either is malformed. */
export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

/** Today's UTC calendar day: the same clock the store and the public verify page use. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The UTC calendar day `offset` days from `now` (negative = past). */
export function utcDayOffset(now: Date, offset: number): string {
  return new Date(now.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

export function plural(count: number, one: string, many: string = `${one}s`): string {
  return count === 1 ? one : many;
}

export function formatCount(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "0";
}

/* ------------------------------------------------------------------ *
 * Expiry                                                               *
 * ------------------------------------------------------------------ */

export type ExpiryTone = "none" | "ok" | "soon" | "expired";

export interface ExpiryDescription {
  /** "in 12 days", "today", "3 days ago"; empty when there is no expiry date. */
  relative: string;
  tone: ExpiryTone;
  /** Whole days until expiry (negative once expired); null without a date. */
  days: number | null;
}

/**
 * How far away a record's expiry is. A record is valid through the whole of its `expiresOn` day and
 * expired from the next, matching `computeVerificationState`.
 */
export function describeExpiry(expiresOn: string | null, now: Date, soonDays: number): ExpiryDescription {
  if (!expiresOn) return { relative: "", tone: "none", days: null };
  const days = daysBetween(utcDay(now), expiresOn);
  if (days === null) return { relative: "", tone: "none", days: null };
  if (days < 0) {
    const ago = -days;
    return { relative: `${ago} ${plural(ago, "day")} ago`, tone: "expired", days };
  }
  if (days === 0) return { relative: "today", tone: "soon", days };
  if (days === 1) return { relative: "tomorrow", tone: "soon", days };
  return { relative: `in ${days} days`, tone: days <= soonDays ? "soon" : "ok", days };
}

/* ------------------------------------------------------------------ *
 * Timestamps                                                           *
 * ------------------------------------------------------------------ */

/** "just now", "5 min ago", "3 hours ago", "2 days ago", "4 mo ago", "in 2 hours" for the future. */
export function formatRelative(thenMs: number, nowMs: number): string {
  if (!Number.isFinite(thenMs) || !Number.isFinite(nowMs)) return "";
  const diff = nowMs - thenMs;
  const abs = Math.abs(diff);
  const wrap = (text: string): string => (diff < 0 ? `in ${text}` : `${text} ago`);

  if (abs < 45_000) return "just now";
  const minutes = Math.max(1, Math.floor(abs / 60_000));
  if (minutes < 60) return wrap(`${minutes} min`);
  const hours = Math.floor(abs / 3_600_000);
  if (hours < 24) return wrap(`${hours} ${plural(hours, "hour")}`);
  const days = Math.floor(abs / DAY_MS);
  if (days < 30) return wrap(`${days} ${plural(days, "day")}`);
  // Up to a full year is counted in months (30 to 364 days is 1 to 12), so "0 years" is unreachable.
  if (days < 365) return wrap(`${Math.floor(days / 30)} mo`);
  const years = Math.floor(days / 365);
  return wrap(`${years} ${plural(years, "year")}`);
}

/** Relative time for an ISO timestamp; an empty string when it cannot be parsed. */
export function relativeFromIso(iso: string, nowMs: number): string {
  return formatRelative(Date.parse(iso), nowMs);
}

/** "12 Mar 2026, 14:05 UTC". Server-safe: identical on the server and during hydration. */
export function formatUtcStamp(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const date = new Date(time);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/* ------------------------------------------------------------------ *
 * Identity                                                             *
 * ------------------------------------------------------------------ */

/**
 * The audit trail stores an actor as "admin:" plus 16 hex characters of a keyed hash. Six characters
 * tell two devices apart on screen without printing the whole handle.
 */
export function shortActor(actor: string): string {
  const trimmed = actor.trim();
  if (!trimmed) return "unknown";
  const handle = trimmed.startsWith("admin:") ? trimmed.slice("admin:".length) : trimmed;
  return handle.slice(0, 6) || "unknown";
}

/** The first eight characters of an id, for a quiet reference line. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Cuts text to `max` characters with an ellipsis; counts code points so an emoji is never split. */
export function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}
