import { computeVerificationState } from "@/lib/documents/public";
import type { DocumentRecord, VerificationState } from "@/lib/documents/types";
import { VERIFICATION_LABELS } from "@/lib/documents/types";
import { ADMIN_ROUTES } from "@/lib/nav";
import { formatDate, utcDayOffset } from "./format";
import type { RawSearchParams } from "./listQuery";

/**
 * Pure logic for the Verification page: the URL, result filtering, daily totals and what state a
 * verification code is in. The store returns raw lookup events; everything derived is here.
 */

export const LOG_PAGE_SIZE = 25;
/** Days shown in the daily totals and on the dashboard sparkline. */
export const DAILY_WINDOW_DAYS = 14;

export const RESULT_FILTERS: readonly { value: VerificationState; label: string }[] = [
  { value: "valid", label: VERIFICATION_LABELS.valid },
  { value: "expired", label: VERIFICATION_LABELS.expired },
  { value: "revoked", label: VERIFICATION_LABELS.revoked },
  { value: "not_found", label: VERIFICATION_LABELS.not_found },
];

const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerificationQuery {
  result: VerificationState | null;
  /** Only lookups that resolved to this record. */
  doc: string | null;
  page: number;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseVerificationQuery(raw: RawSearchParams): VerificationQuery {
  const result = first(raw.result);
  const doc = first(raw.doc).trim();
  const pageText = first(raw.page);
  return {
    result: RESULT_FILTERS.some((filter) => filter.value === result) ? (result as VerificationState) : null,
    doc: DOCUMENT_ID.test(doc) ? doc.toLowerCase() : null,
    page: /^\d{1,6}$/.test(pageText) ? Math.max(1, Number(pageText)) : 1,
  };
}

export function verificationHref(query: VerificationQuery, changes: Partial<VerificationQuery> = {}): string {
  const next: VerificationQuery = { ...query, ...changes };
  // Changing a filter starts again from page 1; asking for the same query leaves the page alone.
  if (Object.keys(changes).length > 0 && !("page" in changes)) next.page = 1;
  const params = new URLSearchParams();
  if (next.result) params.set("result", next.result);
  if (next.doc) params.set("doc", next.doc);
  if (next.page > 1) params.set("page", String(next.page));
  const queryString = params.toString();
  return queryString ? `${ADMIN_ROUTES.verification}?${queryString}` : ADMIN_ROUTES.verification;
}

/** A stored `result` string as a known state, or null (a value written by a newer version). */
export function asVerificationState(result: string): VerificationState | null {
  return RESULT_FILTERS.some((filter) => filter.value === result) ? (result as VerificationState) : null;
}

export function filterByResult<T extends { result: string }>(events: readonly T[], result: VerificationState | null): T[] {
  return result ? events.filter((event) => event.result === result) : [...events];
}

/* ------------------------------------------------------------------ *
 * Daily totals                                                         *
 * ------------------------------------------------------------------ */

export interface DailyPoint {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  /** "12 Mar". */
  label: string;
  count: number;
}

/**
 * Lookups per UTC day for the last `days` days, oldest first, ending today. Days with no lookups are
 * present with a count of 0, so a chart's baseline is continuous. Events outside the window or with
 * an unparseable timestamp are ignored.
 */
export function dailyTotals(events: readonly { at: string }[], days: number, now: Date): DailyPoint[] {
  const span = Math.max(1, Math.trunc(days));
  const counts = new Map<string, number>();
  for (let offset = -(span - 1); offset <= 0; offset += 1) counts.set(utcDayOffset(now, offset), 0);
  for (const event of events) {
    const day = event.at.slice(0, 10);
    const current = counts.get(day);
    if (current !== undefined) counts.set(day, current + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, label: formatDate(date).slice(0, -5), count }));
}

export interface DailySummary {
  total: number;
  peak: number;
  /** The busiest day, or null when there were no lookups at all. */
  peakDay: DailyPoint | null;
}

export function summariseDaily(points: readonly DailyPoint[]): DailySummary {
  let total = 0;
  let peakDay: DailyPoint | null = null;
  for (const point of points) {
    total += point.count;
    if (point.count > 0 && (!peakDay || point.count > peakDay.count)) peakDay = point;
  }
  return { total, peak: peakDay?.count ?? 0, peakDay };
}

/* ------------------------------------------------------------------ *
 * Codes                                                                *
 * ------------------------------------------------------------------ */

export type CodeStatus =
  | { live: true; state: Exclude<VerificationState, "not_found"> }
  | { live: false; reason: string };

/**
 * What a visitor scanning this record's code would get. Only a published, non-private record
 * resolves; draft, archived and private records all answer "not found" (the store hides the
 * difference on purpose), so the admin needs this to see why a code scans as unknown.
 */
export function codeStatus(
  record: Pick<DocumentRecord, "status" | "visibility" | "revokedAt" | "expiresOn">,
  now: Date,
): CodeStatus {
  if (record.status === "draft") return { live: false, reason: "Draft: scans report “not found”" };
  if (record.status === "archived") return { live: false, reason: "Archived: scans report “not found”" };
  if (record.visibility === "private") return { live: false, reason: "Private: scans report “not found”" };
  return { live: true, state: computeVerificationState(record, now) };
}
