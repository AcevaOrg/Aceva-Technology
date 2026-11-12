import { CATEGORIES, categoryFromSlug, isDocumentCategory } from "@/lib/documents/categories";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  STATUS_LABELS,
  VISIBILITY_LABELS,
  type DocumentCategory,
  type DocumentStatus,
  type DocumentVisibility,
} from "@/lib/documents/types";
import type { DocumentListFilters, DocumentSort } from "@/lib/documents/store";
import { ADMIN_ROUTES } from "@/lib/nav";

/**
 * URL <-> filter state for /admin/documents.
 *
 * The page is URL-driven: every filter is a query parameter, so a filtered list can be bookmarked,
 * shared between admins, and survives a refresh. Parsing is strict and fails towards "no filter":
 * an unknown status or a mangled page number never reaches the database and never throws.
 * Type-only imports from the store keep this module free of server code.
 */

export const LIST_PAGE_SIZE = 25;
const MAX_PAGE = 100_000;
const MAX_SEARCH_LENGTH = 100;

export const DEFAULT_SORT: DocumentSort = "updated";

export const SORT_OPTIONS: readonly { value: DocumentSort; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "issued", label: "Issue date, newest first" },
  { value: "title", label: "Title, A to Z" },
];

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ListQuery {
  category: DocumentCategory | null;
  status: DocumentStatus | null;
  visibility: DocumentVisibility | null;
  /** Search text, already trimmed and capped. "" = no search. */
  q: string;
  /** Only records expiring inside the "soon" window. */
  expiring: boolean;
  sort: DocumentSort;
  /** 1-based. */
  page: number;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// C0 controls and DEL: a pasted search term can carry them, and they have no business in a URL or a LIKE.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function cleanSearch(value: string): string {
  return value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH).trim();
}

function parsePage(value: string): number {
  if (!/^\d{1,6}$/.test(value)) return 1;
  const page = Number(value);
  return Math.min(MAX_PAGE, Math.max(1, page));
}

function parseCategory(value: string): DocumentCategory | null {
  if (!value) return null;
  const bySlug = categoryFromSlug(value);
  if (bySlug) return bySlug.key;
  // The raw key is accepted too, so a link written by hand still works.
  return isDocumentCategory(value) ? value : null;
}

function isSort(value: string): value is DocumentSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/** Turns Next's `searchParams` into a validated query. Never throws. */
export function parseListQuery(raw: RawSearchParams): ListQuery {
  const status = first(raw.status);
  const visibility = first(raw.visibility);
  const sort = first(raw.sort);
  const expiring = first(raw.expiring);
  return {
    category: parseCategory(first(raw.category)),
    status: (DOCUMENT_STATUSES as readonly string[]).includes(status) ? (status as DocumentStatus) : null,
    visibility: (DOCUMENT_VISIBILITIES as readonly string[]).includes(visibility) ? (visibility as DocumentVisibility) : null,
    q: cleanSearch(first(raw.q)),
    expiring: expiring === "1" || expiring === "true",
    sort: isSort(sort) ? sort : DEFAULT_SORT,
    page: parsePage(first(raw.page)),
  };
}

/**
 * The URL for a query with some fields changed. Defaults are left out so URLs stay short, and the
 * page resets to 1 whenever a filter changes (unless the change names a page explicitly).
 */
export function listHref(query: ListQuery, changes: Partial<ListQuery> = {}): string {
  const next: ListQuery = { ...query, ...changes };
  // Changing a filter starts again from page 1; asking for the same query leaves the page alone.
  if (Object.keys(changes).length > 0 && !("page" in changes)) next.page = 1;

  const params = new URLSearchParams();
  if (next.category) params.set("category", CATEGORIES[next.category].slug);
  if (next.status) params.set("status", next.status);
  if (next.visibility) params.set("visibility", next.visibility);
  if (next.q) params.set("q", next.q);
  if (next.expiring) params.set("expiring", "1");
  if (next.sort !== DEFAULT_SORT) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const queryString = params.toString();
  return queryString ? `${ADMIN_ROUTES.documents}?${queryString}` : ADMIN_ROUTES.documents;
}

/** The store filters for a query. `expiringDays` is the shared "expiring soon" window (EXPIRING_SOON_DAYS). */
export function toListFilters(query: ListQuery, expiringDays: number): DocumentListFilters {
  return {
    category: query.category ?? undefined,
    status: query.status ?? undefined,
    visibility: query.visibility ?? undefined,
    q: query.q || undefined,
    expiringWithinDays: query.expiring ? expiringDays : undefined,
    sort: query.sort,
    limit: LIST_PAGE_SIZE,
    offset: (query.page - 1) * LIST_PAGE_SIZE,
  };
}

/** How many filters narrow the list (sort and page do not count). */
export function activeFilterCount(query: ListQuery): number {
  return [query.category, query.status, query.visibility, query.q, query.expiring].filter(Boolean).length;
}

/** The same query with every filter cleared but the sort kept. */
export function clearedQuery(query: ListQuery): ListQuery {
  return { category: null, status: null, visibility: null, q: "", expiring: false, sort: query.sort, page: 1 };
}

/* ------------------------------------------------------------------ *
 * Pagination                                                           *
 * ------------------------------------------------------------------ */

export interface Pagination {
  /** The page to show, clamped into 1..pages. */
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  offset: number;
  /** 1-based position of the first and last row on this page; 0 and 0 for an empty list. */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** The requested page was out of range and was pulled back in. */
  clamped: boolean;
}

export function paginate(total: number, requestedPage: number, pageSize: number = LIST_PAGE_SIZE): Pagination {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  const size = Math.max(1, Math.trunc(pageSize));
  const pages = Math.max(1, Math.ceil(safeTotal / size));
  const wanted = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(pages, Math.max(1, wanted));
  const offset = (page - 1) * size;
  return {
    page,
    pages,
    total: safeTotal,
    pageSize: size,
    offset,
    from: safeTotal === 0 ? 0 : offset + 1,
    to: Math.min(safeTotal, offset + size),
    hasPrev: page > 1,
    hasNext: page < pages,
    clamped: page !== wanted,
  };
}

/**
 * Page numbers to show: always the first and last, the current page and its neighbours, with "gap"
 * standing in for a skipped run. [1, "gap", 4, 5, 6, "gap", 20].
 */
export function pageItems(page: number, pages: number, siblings = 1): Array<number | "gap"> {
  if (pages <= 1) return [1];
  const wanted = new Set<number>([1, pages]);
  for (let n = page - siblings; n <= page + siblings; n += 1) {
    if (n >= 1 && n <= pages) wanted.add(n);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous > 1) {
      // A single skipped page is shown as the page itself: "1 … 3" would hide only "2".
      if (n - previous === 2) items.push(previous + 1);
      else items.push("gap");
    }
    items.push(n);
  });
  return items;
}

/* ------------------------------------------------------------------ *
 * Empty states                                                         *
 * ------------------------------------------------------------------ */

export interface EmptyListCopy {
  title: string;
  body: string;
  action: { label: string; href: string } | null;
}

const NEW_DOCUMENT = ADMIN_ROUTES.newDocument;

/** What to say when the current filters match nothing. The most specific filter wins. */
export function describeEmptyList(query: ListQuery, expiringDays: number): EmptyListCopy {
  const spec = query.category ? CATEGORIES[query.category] : null;
  const scope = spec ? ` in ${spec.plural}` : "";

  if (query.q) {
    return {
      title: `No matches for “${query.q}”`,
      body: "Check the spelling, or try a holder name, a reference number or a verification code.",
      action: { label: "Clear search", href: listHref(query, { q: "" }) },
    };
  }
  if (query.expiring) {
    return {
      title: `Nothing expires in the next ${expiringDays} days${scope}`,
      body: "Every document in this view is either open-ended or has plenty of time left.",
      action: { label: "Show everything", href: listHref(query, { expiring: false }) },
    };
  }
  if (query.status || query.visibility) {
    const parts: string[] = [];
    if (query.status) parts.push(STATUS_LABELS[query.status].toLowerCase());
    if (query.visibility) parts.push(VISIBILITY_LABELS[query.visibility].label.toLowerCase());
    return {
      title: `No ${parts.join(", ")} documents${scope}`,
      body: "Try a different status or visibility, or clear the filters to see everything.",
      action: { label: "Clear filters", href: listHref(clearedQuery(query)) },
    };
  }
  if (spec) {
    return {
      title: `No ${spec.plural.toLowerCase()} yet`,
      body: spec.adminHelp,
      action: { label: `Add ${spec.label.toLowerCase()}`, href: `${NEW_DOCUMENT}?category=${spec.slug}` },
    };
  }
  return {
    title: "No documents yet",
    body: "Add the first one: a certificate, a report, an experience letter. Drafts stay private until you publish them.",
    action: { label: "Add a document", href: NEW_DOCUMENT },
  };
}
