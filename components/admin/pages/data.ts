import { DATABASE_TIMEOUT_MS, ensureAdminTables, withDatabaseTimeout } from "@/lib/admin/tables";
import { getSql } from "@/lib/db";
import { ensureDocumentTables } from "@/lib/documents/schema";
import {
  EXPIRING_SOON_DAYS,
  getDashboardStats,
  listDocuments,
  listVerificationEvents,
  type DashboardStats,
  type VerificationEventRow,
} from "@/lib/documents/store";
import { buildAttention, type AttentionGroup } from "./attention";
import { utcDayOffset } from "./format";
import type { DatabaseFacts } from "./health";
import { paginate, type Pagination } from "./listQuery";
import {
  DAILY_WINDOW_DAYS,
  LOG_PAGE_SIZE,
  dailyTotals,
  filterByResult,
  type DailyPoint,
  type VerificationQuery,
} from "./verificationView";

/**
 * Server-side loaders for the console pages. They compose the store's queries and hand back plain
 * data; the page decides how to render it. Anything the store cannot answer directly is derived here
 * from `listDocuments` and `listVerificationEvents`, because lib/documents/store.ts is not ours to extend.
 */

/** Logs that something failed without the driver's message, which can contain a connection string. */
export function logLoadFailure(scope: string, error: unknown): void {
  console.error(`[admin:${scope}] could not load (${error instanceof Error ? error.name : typeof error})`);
}

/* ------------------------------------------------------------------ *
 * Verification events                                                  *
 * ------------------------------------------------------------------ */

const EVENT_PAGE = 200;
const DEFAULT_MAX_EVENTS = 1000;

export interface EventScan {
  events: VerificationEventRow[];
  /** Everything the log holds for this scope, which can exceed `events`. */
  total: number;
  /** The scan stopped before it had everything it wanted, so counts are lower bounds. */
  truncated: boolean;
}

/**
 * Reads lookup events newest-first, page by page, until the window is covered, the log is exhausted
 * or `maxEvents` is reached. The store has no "group by day" or "filter by result" query, so the
 * daily totals and the result filter are computed from this bounded window instead.
 */
export async function scanVerificationEvents(
  options: { documentId?: string; sinceDay?: string; maxEvents?: number } = {},
): Promise<EventScan> {
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const events: VerificationEventRow[] = [];
  let total = 0;
  let offset = 0;
  let truncated = false;

  for (;;) {
    const page = await listVerificationEvents({ limit: EVENT_PAGE, offset, documentId: options.documentId });
    if (offset === 0) total = page.total;
    events.push(...page.events);
    offset += page.events.length;

    if (page.events.length < EVENT_PAGE || offset >= total) break;
    const oldest = page.events[page.events.length - 1]?.at.slice(0, 10) ?? "";
    // Newest-first, so once a page reaches back past the window nothing further can be inside it.
    if (options.sinceDay && oldest < options.sinceDay) break;
    if (events.length >= maxEvents) {
      truncated = true;
      break;
    }
  }
  return { events, total, truncated };
}

/** Lookups per day over the dashboard/verification window. */
export async function loadDailyLookups(
  now: Date,
  documentId?: string,
): Promise<{ points: DailyPoint[]; truncated: boolean }> {
  const sinceDay = utcDayOffset(now, -(DAILY_WINDOW_DAYS - 1));
  const scan = await scanVerificationEvents({ documentId, sinceDay });
  return { points: dailyTotals(scan.events, DAILY_WINDOW_DAYS, now), truncated: scan.truncated };
}

export interface LookupLogPage {
  events: VerificationEventRow[];
  pagination: Pagination;
  /** The result filter only saw the newest lookups, so it may be hiding older matches. */
  truncated: boolean;
}

/** How far back a result-filtered log reads. The store filters by record, not by result. */
const FILTERED_LOG_SCAN = 1000;

/**
 * One page of the lookup log. Without a result filter this is a plain database page with an exact total.
 * With one, the newest lookups are read and filtered here (the store has no result filter), then paged.
 */
export async function loadLookupLog(query: Pick<VerificationQuery, "result" | "doc" | "page">): Promise<LookupLogPage> {
  const documentId = query.doc ?? undefined;
  if (!query.result) {
    const offset = (query.page - 1) * LOG_PAGE_SIZE;
    const { events, total } = await listVerificationEvents({ limit: LOG_PAGE_SIZE, offset, documentId });
    return { events, pagination: paginate(total, query.page, LOG_PAGE_SIZE), truncated: false };
  }

  const scan = await scanVerificationEvents({ documentId, maxEvents: FILTERED_LOG_SCAN });
  const matches = filterByResult(scan.events, query.result);
  const pagination = paginate(matches.length, query.page, LOG_PAGE_SIZE);
  return {
    events: matches.slice(pagination.offset, pagination.offset + LOG_PAGE_SIZE),
    pagination,
    truncated: scan.truncated,
  };
}

/* ------------------------------------------------------------------ *
 * Dashboard                                                            *
 * ------------------------------------------------------------------ */

export interface DashboardData {
  stats: DashboardStats;
  attention: AttentionGroup[];
  /** False when the draft or published query failed, so the attention list may be missing groups. */
  attentionComplete: boolean;
  /** Null when the events query failed; the sparkline then explains instead of drawing. */
  daily: { points: DailyPoint[]; truncated: boolean } | null;
}

const ATTENTION_SCAN = 200;

/**
 * Everything the dashboard shows. The statistics are required; the attention rules and the sparkline
 * are best effort, so a failure in one of them degrades that panel instead of blanking the page.
 */
export async function loadDashboardData(now: Date): Promise<DashboardData> {
  const [stats, drafts, published, daily] = await Promise.all([
    getDashboardStats(),
    listDocuments({ status: "draft", limit: ATTENTION_SCAN, sort: "updated" }).catch(() => null),
    listDocuments({ status: "published", limit: ATTENTION_SCAN, sort: "issued" }).catch(() => null),
    loadDailyLookups(now).catch((error: unknown) => {
      logLoadFailure("dashboard-lookups", error);
      return null;
    }),
  ]);

  const attention = buildAttention({
    soonestExpiring: stats.soonestExpiring,
    expiringTotal: stats.expiringSoon,
    drafts: drafts ? { items: drafts.items, total: drafts.total } : null,
    published: published ? { items: published.items, total: published.total } : null,
    now,
    soonDays: EXPIRING_SOON_DAYS,
  });
  return { stats, attention, attentionComplete: drafts !== null && published !== null, daily };
}

/* ------------------------------------------------------------------ *
 * Settings: database probe                                             *
 * ------------------------------------------------------------------ */

const EXPECTED_TABLES = ["documents", "document_files", "verification_events", "admin_audit_log", "admin_login_attempts"] as const;

async function missingTables(): Promise<string[]> {
  // The names are literals from the list above, never input: `to_regclass` takes a name, not a value.
  const rows = await getSql()`
    SELECT
      to_regclass('documents') IS NOT NULL AS documents,
      to_regclass('document_files') IS NOT NULL AS document_files,
      to_regclass('verification_events') IS NOT NULL AS verification_events,
      to_regclass('admin_audit_log') IS NOT NULL AS admin_audit_log,
      to_regclass('admin_login_attempts') IS NOT NULL AS admin_login_attempts`;
  const row = rows[0] ?? {};
  return EXPECTED_TABLES.filter((name) => row[name] !== true && row[name] !== "t");
}

/**
 * Checks the database without trusting it: reachable at all, which tables exist, then tries to create
 * any that are missing (the same idempotent call every page makes anyway). Every step is bounded by a
 * timeout and wrapped, so a dead database yields a verdict, not an exception.
 */
export async function probeDatabase(): Promise<Omit<DatabaseFacts, "configured" | "embedded">> {
  const unreachable = { reachable: false, tablesCreated: null, tablesMissing: null, documents: null, files: null };

  let before: string[];
  try {
    before = await withDatabaseTimeout(missingTables(), DATABASE_TIMEOUT_MS);
  } catch (error) {
    logLoadFailure("settings-probe", error);
    return unreachable;
  }

  try {
    await withDatabaseTimeout(ensureDocumentTables(), DATABASE_TIMEOUT_MS * 2);
    await withDatabaseTimeout(ensureAdminTables(), DATABASE_TIMEOUT_MS * 2);
  } catch (error) {
    logLoadFailure("settings-ensure", error);
  }

  let after: string[] = before;
  try {
    after = await withDatabaseTimeout(missingTables(), DATABASE_TIMEOUT_MS);
  } catch (error) {
    logLoadFailure("settings-tables", error);
  }
  const tablesCreated = before.filter((name) => !after.includes(name));

  let documents: number | null = null;
  let files: { count: number; bytes: number } | null = null;
  if (!after.includes("documents") && !after.includes("document_files")) {
    try {
      const rows = await withDatabaseTimeout(
        getSql()`
          SELECT
            (SELECT count(*) FROM documents)::int AS documents,
            (SELECT count(*) FROM document_files)::int AS files,
            (SELECT coalesce(sum(size_bytes), 0) FROM document_files)::float8 AS bytes`,
        DATABASE_TIMEOUT_MS,
      );
      const row = rows[0];
      if (row) {
        documents = Number(row.documents) || 0;
        files = { count: Number(row.files) || 0, bytes: Number(row.bytes) || 0 };
      }
    } catch (error) {
      logLoadFailure("settings-counts", error);
    }
  }

  return { reachable: true, tablesCreated, tablesMissing: after, documents, files };
}
