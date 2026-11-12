import type { AdminAuditEvent } from "@/lib/admin/audit";
import { CATEGORIES, isDocumentCategory } from "@/lib/documents/categories";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";
import { formatDuration } from "@/components/admin/utils";
import { clip } from "./format";
import { cleanSearch, paginate, type Pagination, type RawSearchParams } from "./listQuery";

/**
 * Turns audit-trail rows into sentences ("Published “FY 2025-26 Statements”") and parses the
 * activity page's URL. Pure: the trail stores machine names (`document.publish`) and a small
 * `detail` object, and everything a person reads is derived here.
 *
 * Type-only import from audit.ts, so this module never pulls the database client into a bundle.
 */

export const ACTIVITY_PAGE_SIZE = 25;

export type AuditTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface AuditSummary {
  /** "Published", "Signed in". */
  verb: string;
  /** The record's title, when the event concerns one. */
  subject: string | null;
  /** Quiet extras: the category, a revoke reason, a lock duration. */
  notes: string[];
  tone: AuditTone;
  /** The admin page for the affected record, when it still exists. */
  href: string | null;
}

interface ActionMeta {
  verb: string;
  tone: AuditTone;
  /** Filter menu label. */
  label: string;
}

const ACTIONS: Record<string, ActionMeta> = {
  "login.success": { verb: "Signed in", tone: "info", label: "Sign-ins" },
  "login.failure": { verb: "Failed sign-in attempt", tone: "warning", label: "Failed sign-ins" },
  "login.locked": { verb: "Sign-in locked after repeated failures", tone: "danger", label: "Sign-in lockouts" },
  logout: { verb: "Signed out", tone: "neutral", label: "Sign-outs" },
  "document.create": { verb: "Created", tone: "success", label: "Documents created" },
  "document.update": { verb: "Edited", tone: "neutral", label: "Documents edited" },
  "document.delete": { verb: "Deleted", tone: "danger", label: "Documents deleted" },
  "document.publish": { verb: "Published", tone: "success", label: "Published" },
  "document.unpublish": { verb: "Unpublished", tone: "warning", label: "Unpublished" },
  "document.archive": { verb: "Archived", tone: "neutral", label: "Archived" },
  "document.restore": { verb: "Restored", tone: "neutral", label: "Restored" },
  "document.revoke": { verb: "Revoked", tone: "danger", label: "Revoked" },
  "document.reinstate": { verb: "Reinstated", tone: "success", label: "Reinstated" },
  "document.regenerate_code": { verb: "Replaced the verification code of", tone: "warning", label: "Codes replaced" },
  "document.stamp_file": { verb: "Put the QR on the file of", tone: "info", label: "QR added to files" },
  "document.duplicate": { verb: "Duplicated", tone: "neutral", label: "Duplicated" },
};

/** Options for the action filter, in the order a person would look for them. */
export const ACTION_FILTER_OPTIONS: readonly { value: string; label: string }[] = Object.entries(ACTIONS).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

const MAX_ACTION_LENGTH = 64;
const ACTION_NAME = /^[a-z][a-z0-9_.]*$/;
const MAX_SUBJECT = 120;
const MAX_NOTE = 160;

/** "document.foo_bar" -> "Document foo bar": the fallback for an action this list has not met. */
export function humanizeAction(action: string): string {
  const text = action.replace(/[._]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown action";
}

function textOf(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? clip(cleaned, max) : null;
}

/** One sentence's worth of structure for an audit event. */
export function describeAuditEvent(event: Pick<AdminAuditEvent, "action" | "entityType" | "entityId" | "detail">): AuditSummary {
  const meta = ACTIONS[event.action];
  const detail = event.detail ?? {};
  const notes: string[] = [];

  const category = typeof detail.category === "string" && isDocumentCategory(detail.category) ? CATEGORIES[detail.category].label : null;
  if (category) notes.push(category);

  const reason = textOf(detail.reason, MAX_NOTE);
  if (reason) notes.push(`Reason: ${reason}`);

  if (event.action === "login.locked" && typeof detail.retryAfter === "number" && Number.isFinite(detail.retryAfter)) {
    notes.push(`Locked for ${formatDuration(detail.retryAfter * 1000)}`);
  }

  const isDocumentEvent = event.entityType === "document" || event.action.startsWith("document.");
  const title = textOf(detail.title, MAX_SUBJECT);
  const subject = isDocumentEvent ? (title ?? "a document") : null;

  // A deleted record has no page to open; every other document event can link to its editor.
  const canLink = isDocumentEvent && event.action !== "document.delete" && Boolean(event.entityId);
  return {
    verb: meta?.verb ?? humanizeAction(event.action),
    subject,
    notes,
    tone: meta?.tone ?? "neutral",
    href: canLink && event.entityId ? adminDocumentRoute(event.entityId) : null,
  };
}

/** A plain-text rendering of the summary, for aria-labels and tests. */
export function summaryText(summary: AuditSummary): string {
  return summary.subject ? `${summary.verb} “${summary.subject}”` : summary.verb;
}

/* ------------------------------------------------------------------ *
 * URL                                                                  *
 * ------------------------------------------------------------------ */

export interface ActivityQuery {
  /** Exact action name, or null for everything. */
  action: string | null;
  /** Only events about this record. */
  entity: string | null;
  page: number;
}

const ENTITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseActivityQuery(raw: RawSearchParams): ActivityQuery {
  const action = cleanSearch(first(raw.action));
  const entity = first(raw.entity).trim();
  const page = /^\d{1,6}$/.test(first(raw.page)) ? Math.max(1, Number(first(raw.page))) : 1;
  return {
    // Anything that is not shaped like an action name is ignored rather than passed to the database.
    action: action && action.length <= MAX_ACTION_LENGTH && ACTION_NAME.test(action) ? action : null,
    entity: ENTITY_ID.test(entity) ? entity.toLowerCase() : null,
    page,
  };
}

export function activityHref(query: ActivityQuery, changes: Partial<ActivityQuery> = {}): string {
  const next: ActivityQuery = { ...query, ...changes };
  // Changing a filter starts again from page 1; asking for the same query leaves the page alone.
  if (Object.keys(changes).length > 0 && !("page" in changes)) next.page = 1;
  const params = new URLSearchParams();
  if (next.action) params.set("action", next.action);
  if (next.entity) params.set("entity", next.entity);
  if (next.page > 1) params.set("page", String(next.page));
  const queryString = params.toString();
  return queryString ? `${ADMIN_ROUTES.activity}?${queryString}` : ADMIN_ROUTES.activity;
}

/**
 * The filter menu's options. A filter in the URL that this list does not know (an action added later)
 * is still offered, so the menu never shows "All activity" while a filter is silently applied.
 */
export function actionOptionsFor(current: string | null): { value: string; label: string }[] {
  const options = [{ value: "", label: "All activity" }, ...ACTION_FILTER_OPTIONS];
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: humanizeAction(current) });
  }
  return options;
}

export function activityPagination(total: number, page: number): Pagination {
  return paginate(total, page, ACTIVITY_PAGE_SIZE);
}
