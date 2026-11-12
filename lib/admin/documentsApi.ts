import { logAdminEvent } from "@/lib/admin/audit";
import { getRequestActor } from "@/lib/admin/auth";
import { getMaxUploadBytes } from "@/lib/admin/config";
import {
  ApiError,
  withRouteErrorHandling,
  type ApiErrorOptions,
} from "@/lib/api/response";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { CATEGORIES, categoryFromSlug, isDocumentCategory } from "@/lib/documents/categories";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import {
  DocumentCategoryChangeError,
  PublishBlockedError,
  StaleDocumentError,
  isDocumentId,
  listDocuments,
  type DocumentListFilters,
  type DocumentSort,
} from "@/lib/documents/store";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  MAX_PHOTO_BYTES,
  MAX_REQUEST_BYTES,
  PHOTO_FILE_TYPES,
  PRIMARY_FILE_TYPES,
  type DocumentCategory,
  type DocumentRecord,
  type DocumentStatus,
  type FileRole,
} from "@/lib/documents/types";
import { parseBooleanLike } from "@/lib/documents/validate";

/**
 * Shared plumbing for the /api/admin/documents routes: bounded multipart parsing, the mapping from
 * store errors to the canonical envelope, query-string parsing, and the header sets for responses
 * that carry raw bytes. Everything here is deliberately free of route wiring so it can be unit
 * tested without a request cycle.
 *
 * Rules that hold for every helper:
 *  - nothing the client sent is echoed back except through a display-safe field message,
 *  - nothing a driver said is echoed back at all (it can contain a connection string),
 *  - a failure is a typed ApiError, never a bare throw the framework would turn into an HTML page.
 */

/* ------------------------------------------------------------------ *
 * Field-level validation failures                                      *
 * ------------------------------------------------------------------ */

/**
 * Builds the VALIDATION_FAILED error the editor binds to its inputs. Keys are the same as
 * `validateDocumentInput` produces, plus `primary` and `photo` for upload problems.
 */
export function validationFailed(fieldMessages: Record<string, string>, message?: string): ApiError {
  const options: ApiErrorOptions = { fieldMessages };
  if (message) options.message = message;
  return new ApiError("VALIDATION_FAILED", options, { fields: Object.keys(fieldMessages) });
}

/* ------------------------------------------------------------------ *
 * Bounded request bodies                                               *
 * ------------------------------------------------------------------ */

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / 1_000_000) * 10) / 10} MB`;
}

function payloadTooLarge(maxBytes: number, logContext: Record<string, unknown>): ApiError {
  return new ApiError(
    "PAYLOAD_TOO_LARGE",
    { message: `That upload is too large. The whole form must stay under ${formatMegabytes(maxBytes)}.` },
    { maxBytes, ...logContext },
  );
}

/**
 * Reads at most `maxBytes` of the request body.
 *
 * The running total is what makes the limit real: `Content-Length` is client-supplied and may be
 * missing, spoofed or non-numeric, so it is only an early exit. Without the count, a chunked body
 * of any size would be buffered in full before a single check ran.
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge(maxBytes, { declaredBytes: declared });

  const body = request.body;
  if (!body) return new Uint8Array(new ArrayBuffer(0));

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Stop pulling bytes from the client the moment the limit is crossed.
        await reader.cancel().catch(() => {});
        throw payloadTooLarge(maxBytes, { receivedBytes: total });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/* ------------------------------------------------------------------ *
 * Multipart document form                                              *
 * ------------------------------------------------------------------ */

/** The JSON `payload` part is a form's worth of text; 64 KB is generous and still a hard ceiling. */
export const MAX_PAYLOAD_BYTES = 65_536;

const MAX_EXPECTED_UPDATED_AT_LENGTH = 40;
// What the store emits (YYYY-MM-DDTHH:MI:SS.MSZ) plus the ISO-8601 spellings a client may reasonably send.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;

export interface ParsedDocumentForm {
  /** The decoded `payload` part: always a plain object, never validated against a category here. */
  payload: Record<string, unknown>;
  /** An uploaded document file that passed inspection, or null. */
  primary: InspectedUpload | null;
  photo: InspectedUpload | null;
  /** Update only: the stored file should be deleted. A new upload for the same role wins over this. */
  removePrimary: boolean;
  removePhoto: boolean;
  /** The `updatedAt` the editor loaded, for optimistic concurrency. */
  expectedUpdatedAt: string | null;
  /**
   * Problems with an upload, keyed `primary` / `photo`. Returned rather than thrown so the caller
   * can report them together with the field errors in a single response.
   */
  fileErrors: Record<string, string>;
}

export interface MultipartLimits {
  maxRequestBytes?: number;
  maxPrimaryBytes?: number;
  maxPhotoBytes?: number;
}

function isMultipart(contentType: string): boolean {
  return /^multipart\/form-data\s*(?:;|$)/i.test(contentType.trim());
}

function decodePayload(raw: FormDataEntryValue | null): Record<string, unknown> {
  if (raw === null) throw validationFailed({ payload: "The form data is missing. Reload the page and try again." });
  if (typeof raw !== "string") throw validationFailed({ payload: "The form data could not be read." });
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", { message: "The form data is too large." }, { part: "payload" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError("INVALID_JSON", { message: "The form data could not be read." }, { reason: "payload-parse-failed" });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError("INVALID_JSON", { message: "The form data could not be read." }, { reason: "payload-not-an-object" });
  }
  return parsed as Record<string, unknown>;
}

function readFlag(form: FormData, name: string): boolean {
  const value = form.get(name);
  return typeof value === "string" && parseBooleanLike(value) === true;
}

/**
 * Reads one upload part. Only genuine `File` entries count: a text field that happens to share the
 * name is ignored, and so is the empty, nameless file a browser submits for an untouched input.
 */
async function readUpload(
  form: FormData,
  name: FileRole,
  maxBytes: number,
): Promise<{ file: InspectedUpload | null; error?: string }> {
  const entry = form.get(name);
  if (!(entry instanceof File)) return { file: null };
  if (entry.size === 0 && entry.name === "") return { file: null };

  // The size is known before the bytes are read, so an oversize file costs nothing to refuse.
  if (entry.size > maxBytes) {
    return { file: null, error: `The file is ${formatMegabytes(entry.size)}; the limit is ${formatMegabytes(maxBytes)}.` };
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  const inspected = inspectUpload({ name: entry.name, declaredType: entry.type, bytes }, name, { maxBytes });
  return inspected.ok ? { file: inspected.file } : { file: null, error: inspected.error };
}

/**
 * Parses the multipart body the document editor sends: a JSON `payload` plus optional `primary`
 * and `photo` files (and, when updating, `removePrimary`, `removePhoto`, `expectedUpdatedAt`).
 *
 * The body is read through `readBoundedBody` first and only then handed to the multipart parser, so
 * the size limit holds whether or not the client sent an honest Content-Length. Every file is
 * judged by its bytes (`inspectUpload`): the declared type and the name are only checked for
 * agreement with them.
 */
export async function parseDocumentMultipart(request: Request, limits: MultipartLimits = {}): Promise<ParsedDocumentForm> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!isMultipart(contentType)) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE", { message: "Send the form as multipart/form-data." }, { contentType: contentType || "(none)" });
  }

  const bytes = await readBoundedBody(request, limits.maxRequestBytes ?? MAX_REQUEST_BYTES);

  let form: FormData;
  try {
    // Re-wrapping the bytes in a Response is the standards-based way to run the multipart parser
    // over a body we have already bounded.
    form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw validationFailed({ form: "The upload could not be read. Please try again." }, "The upload could not be read. Please try again.");
  }

  const payload = decodePayload(form.get("payload"));

  const expectedRaw = form.get("expectedUpdatedAt");
  let expectedUpdatedAt: string | null = null;
  if (typeof expectedRaw === "string" && expectedRaw.trim() !== "") {
    const trimmed = expectedRaw.trim();
    if (trimmed.length > MAX_EXPECTED_UPDATED_AT_LENGTH || !ISO_TIMESTAMP.test(trimmed) || !Number.isFinite(Date.parse(trimmed))) {
      throw validationFailed({ expectedUpdatedAt: "Reload the document before saving." });
    }
    expectedUpdatedAt = trimmed;
  }

  const primary = await readUpload(form, "primary", limits.maxPrimaryBytes ?? getMaxUploadBytes());
  const photo = await readUpload(form, "photo", limits.maxPhotoBytes ?? MAX_PHOTO_BYTES);
  const fileErrors: Record<string, string> = {};
  if (primary.error) fileErrors.primary = primary.error;
  if (photo.error) fileErrors.photo = photo.error;

  return {
    payload,
    primary: primary.file,
    photo: photo.file,
    removePrimary: readFlag(form, "removePrimary"),
    removePhoto: readFlag(form, "removePhoto"),
    expectedUpdatedAt,
    fileErrors,
  };
}

/** A photo only belongs on a category that carries one; everything else is refused up front. */
export function photoPlacementErrors(category: DocumentCategory, hasPhotoUpload: boolean): Record<string, string> {
  if (hasPhotoUpload && !CATEGORIES[category].hasPhoto) {
    return { photo: `${CATEGORIES[category].plural} do not carry a photo.` };
  }
  return {};
}

/**
 * The file argument `updateDocument` expects for one role: an upload replaces, `null` deletes,
 * `undefined` keeps. A new upload beats a removal flag because replacing already removes the old
 * file; honouring both in the other order would delete what the admin just uploaded.
 */
export function fileChange(upload: InspectedUpload | null, remove: boolean): InspectedUpload | null | undefined {
  if (upload) return upload;
  return remove ? null : undefined;
}

/* ------------------------------------------------------------------ *
 * Store errors → API errors                                            *
 * ------------------------------------------------------------------ */

const DATABASE_UNAVAILABLE_MESSAGE = "The document database is not available right now. Please try again in a moment.";

const NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);
// SQLSTATE classes 08 (connection exception), 53 (insufficient resources) and 57P01-03 (shutdown / not ready).
const UNAVAILABLE_SQLSTATE = /^(?:08|53|57P0[123])/;
const UNAVAILABLE_MESSAGE =
  /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|connection (?:terminated|timeout|timed out|refused|closed)|timeout expired|TimeoutError|server closed the connection|too many clients|database system is (?:starting up|shutting down)/i;

/**
 * True when `error` means the database could not be reached, as opposed to the store rejecting a
 * request. Looks through the `cause` chain because the Neon driver wraps the network error that
 * actually explains the outage.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if (current instanceof DatabaseNotConfiguredError) return true;
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof code === "string" && (NETWORK_ERROR_CODES.has(code) || UNAVAILABLE_SQLSTATE.test(code))) return true;
    if (typeof message === "string" && UNAVAILABLE_MESSAGE.test(message)) return true;
    current = cause;
  }
  return false;
}

/** Publish gating names the document file `file`; the editor's upload control is `primary`, so both are sent. */
export function publishBlockedMessages(errors: Record<string, string>): Record<string, string> {
  const messages = { ...errors };
  if (messages.file && !messages.primary) messages.primary = messages.file;
  return messages;
}

/**
 * The ApiError for a store failure, or null when the failure is not one the API knows how to
 * describe (the caller rethrows it, and `withRouteErrorHandling` turns it into a logged 500).
 */
export function toApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof StaleDocumentError) {
    return new ApiError(
      "CONFLICT",
      { message: "This document was changed by someone else since you opened it. Reload it and apply your edits again." },
      { reason: "stale-document" },
    );
  }
  if (error instanceof PublishBlockedError) {
    return validationFailed(publishBlockedMessages(error.errors), "This document cannot be published yet.");
  }
  if (error instanceof DocumentCategoryChangeError) {
    return validationFailed({ category: "A document's category cannot be changed. Create a new document instead." });
  }
  if (isDatabaseUnavailable(error)) {
    // Only the error's name is logged: a driver message can contain the connection string.
    return new ApiError(
      "SERVICE_UNAVAILABLE",
      { message: DATABASE_UNAVAILABLE_MESSAGE },
      { reason: "database-unavailable", errorName: error instanceof Error ? error.name : typeof error },
    );
  }
  return null;
}

/** Runs a store call and converts the failures the API understands into typed ApiErrors. */
export async function runStore<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toApiError(error) ?? error;
  }
}

/* ------------------------------------------------------------------ *
 * Route plumbing                                                       *
 * ------------------------------------------------------------------ */

export interface DocumentRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `withRouteErrorHandling` for a dynamic route: the same error envelope, with the Next.js route
 * context threaded through. Authorisation stays in the handler (`requireAdminRequest` first) so
 * that every route file shows its own guard.
 */
export function withDocumentRoute(
  scope: string,
  handler: (request: Request, requestId: string, context: DocumentRouteContext) => Promise<Response>,
): (request: Request, context: DocumentRouteContext) => Promise<Response> {
  return (request, context) => withRouteErrorHandling(scope, (req, requestId) => handler(req, requestId, context))(request);
}

/** The `[id]` segment, or a 404: a malformed id must never reach the store, let alone become a 500. */
export async function resolveDocumentId(context: DocumentRouteContext): Promise<string> {
  const { id } = await context.params;
  if (!isDocumentId(id)) throw new ApiError("NOT_FOUND", {}, { reason: "malformed-id" });
  return id;
}

export function notFound(): ApiError {
  return new ApiError("NOT_FOUND");
}

/* ------------------------------------------------------------------ *
 * Audit trail                                                          *
 * ------------------------------------------------------------------ */

export type DocumentAuditAction =
  | "document.create"
  | "document.update"
  | "document.delete"
  | "document.publish"
  | "document.unpublish"
  | "document.archive"
  | "document.restore"
  | "document.revoke"
  | "document.reinstate"
  | "document.regenerate_code"
  | "document.duplicate";

/**
 * Records a document mutation. The detail carries the title and category so the activity page can
 * still describe an event after the record is deleted; it never carries file bytes or the verification code.
 */
export async function auditDocumentEvent(
  request: Request,
  action: DocumentAuditAction,
  record: Pick<DocumentRecord, "id" | "title" | "category">,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await logAdminEvent({
    action,
    entityType: "document",
    entityId: record.id,
    actor: getRequestActor(request),
    detail: { title: record.title, category: record.category, ...extra },
  });
}

/* ------------------------------------------------------------------ *
 * List query string                                                    *
 * ------------------------------------------------------------------ */

const LIST_SORTS: readonly DocumentSort[] = ["updated", "issued", "title", "created"];
const MAX_SEARCH_LENGTH = 100;
const MAX_LIST_LIMIT = 200;
const MAX_EXPIRY_WINDOW_DAYS = 36_500;

/** A query value, trimmed; an empty value counts as absent (an untouched filter in a form). */
function queryValue(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseWholeNumber(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

/** Accepts the category key (`experience_letter`) or the admin URL slug (`experience-letters`). */
export function parseCategoryParam(raw: string | undefined | null): DocumentCategory | null {
  if (!raw) return null;
  const value = raw.trim();
  if (isDocumentCategory(value)) return value;
  return categoryFromSlug(value)?.key ?? null;
}

/**
 * The list endpoint's query string as store filters. A value that is not a real option is a 400
 * rather than being ignored: dropping an unknown `status` would silently list everything.
 */
export function parseListFilters(params: URLSearchParams): DocumentListFilters {
  const errors: Record<string, string> = {};
  const filters: DocumentListFilters = {};

  const category = queryValue(params, "category");
  if (category !== undefined) {
    const resolved = parseCategoryParam(category);
    if (resolved) filters.category = resolved;
    else errors.category = "Unknown document category.";
  }

  const status = queryValue(params, "status");
  if (status !== undefined) {
    if ((DOCUMENT_STATUSES as readonly string[]).includes(status)) filters.status = status as DocumentStatus;
    else errors.status = "Choose Draft, Published or Archived.";
  }

  const visibility = queryValue(params, "visibility");
  if (visibility !== undefined) {
    if ((DOCUMENT_VISIBILITIES as readonly string[]).includes(visibility)) filters.visibility = visibility as DocumentListFilters["visibility"];
    else errors.visibility = "Choose Public, Unlisted or Private.";
  }

  const q = queryValue(params, "q");
  if (q !== undefined) filters.q = q.slice(0, MAX_SEARCH_LENGTH);

  const verifiable = queryValue(params, "verifiable");
  if (verifiable !== undefined) {
    const parsed = parseBooleanLike(verifiable);
    if (parsed === undefined) errors.verifiable = "Must be true or false.";
    else filters.verifiable = parsed;
  }

  const expiring = queryValue(params, "expiringWithinDays");
  if (expiring !== undefined) {
    const days = parseWholeNumber(expiring);
    if (days === null) errors.expiringWithinDays = "Enter a whole number of days.";
    else filters.expiringWithinDays = Math.min(MAX_EXPIRY_WINDOW_DAYS, days);
  }

  const limit = queryValue(params, "limit");
  if (limit !== undefined) {
    const parsed = parseWholeNumber(limit);
    if (parsed === null) errors.limit = "Enter a whole number.";
    else filters.limit = Math.min(MAX_LIST_LIMIT, Math.max(1, parsed));
  }

  const offset = queryValue(params, "offset");
  if (offset !== undefined) {
    const parsed = parseWholeNumber(offset);
    if (parsed === null) errors.offset = "Enter a whole number.";
    else filters.offset = parsed;
  }

  const sort = queryValue(params, "sort");
  if (sort !== undefined) {
    if ((LIST_SORTS as readonly string[]).includes(sort)) filters.sort = sort as DocumentSort;
    else errors.sort = "Sort by updated, issued, title or created.";
  }

  if (Object.keys(errors).length > 0) throw validationFailed(errors);
  return filters;
}

/* ------------------------------------------------------------------ *
 * Suggested reference numbers                                          *
 * ------------------------------------------------------------------ */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** What the list search should be asked for so every number of this prefix and year comes back. */
export function referenceSearchNeedle(prefix: string, year: number): string {
  return `${prefix}/${year}/`;
}

/**
 * The next free `PREFIX/YEAR/NNNN`: one past the highest sequence already used for that prefix and
 * year (gaps are not refilled, since a number once printed on a paper must never be reissued).
 * References in any other shape are ignored, so a hand-typed "ACV-0142" cannot derail the count.
 */
export function suggestNextReference(prefix: string, year: number, existing: readonly string[]): string {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}/${year}/(\\d{1,6})$`);
  let highest = 0;
  for (const reference of existing) {
    const match = pattern.exec(reference.trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}/${year}/${String(highest + 1).padStart(4, "0")}`;
}

const REFERENCE_PAGE_SIZE = 200;
const REFERENCE_MAX_PAGES = 5;

/**
 * The reference numbers already in use for `prefix` and `year`, found through the list search (a
 * reference is matched as plain text there). Categories can share a prefix, so the search is not
 * limited to one category; it is bounded to a thousand records, far beyond a year of paperwork.
 */
export async function collectReferenceNumbers(prefix: string, year: number): Promise<string[]> {
  const needle = referenceSearchNeedle(prefix, year);
  const references: string[] = [];
  for (let page = 0; page < REFERENCE_MAX_PAGES; page += 1) {
    const { items, total } = await listDocuments({
      q: needle,
      limit: REFERENCE_PAGE_SIZE,
      offset: page * REFERENCE_PAGE_SIZE,
      sort: "created",
    });
    for (const item of items) if (item.referenceNo) references.push(item.referenceNo);
    if ((page + 1) * REFERENCE_PAGE_SIZE >= total) break;
  }
  return references;
}

/* ------------------------------------------------------------------ *
 * Workflow actions                                                     *
 * ------------------------------------------------------------------ */

export const DOCUMENT_ACTIONS = [
  "publish",
  "unpublish",
  "archive",
  "restore",
  "revoke",
  "reinstate",
  "regenerate_code",
  "duplicate",
] as const;

export type DocumentAction = (typeof DOCUMENT_ACTIONS)[number];

export function isDocumentAction(value: unknown): value is DocumentAction {
  return typeof value === "string" && (DOCUMENT_ACTIONS as readonly string[]).includes(value);
}

export type StatusAction = "publish" | "unpublish" | "archive" | "restore";

export type StatusPlan =
  | { kind: "set"; status: DocumentStatus }
  | { kind: "noop" }
  | { kind: "conflict"; message: string };

/**
 * What a status action should do to a record in its current state.
 *
 * Repeating an action is a no-op rather than an error (a double click must not show a failure), but
 * an action that would move a record somewhere the lifecycle does not allow is refused: restoring
 * a published record would silently take it offline, and publishing an archived one would skip the
 * step that makes the admin look at it again.
 */
export function planStatusAction(action: StatusAction, current: DocumentStatus): StatusPlan {
  switch (action) {
    case "publish":
      if (current === "published") return { kind: "noop" };
      if (current === "archived") return { kind: "conflict", message: "Restore this document before publishing it." };
      return { kind: "set", status: "published" };
    case "unpublish":
      if (current === "draft") return { kind: "noop" };
      if (current === "archived") return { kind: "conflict", message: "This document is archived, so it is already hidden. Restore it instead." };
      return { kind: "set", status: "draft" };
    case "archive":
      return current === "archived" ? { kind: "noop" } : { kind: "set", status: "archived" };
    case "restore":
      if (current === "draft") return { kind: "noop" };
      if (current === "published") return { kind: "conflict", message: "Only archived documents can be restored." };
      return { kind: "set", status: "draft" };
  }
}

const MAX_REVOKE_REASON_LENGTH = 500;

/** The optional revoke reason from an action body: a string of at most 500 characters, else a field error. */
export function parseRevokeReason(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") throw validationFailed({ reason: "Enter the reason as text." });
  const reason = raw.trim();
  if (Array.from(reason).length > MAX_REVOKE_REASON_LENGTH) {
    throw validationFailed({ reason: `Keep the reason under ${MAX_REVOKE_REASON_LENGTH} characters.` });
  }
  return reason;
}

/* ------------------------------------------------------------------ *
 * Responses that carry bytes                                           *
 * ------------------------------------------------------------------ */

/**
 * The global policy in next.config.ts says `object-src 'none'` and `X-Frame-Options: DENY`, which
 * can stop a browser rendering a PDF opened in its own tab or previewed in a frame on a same-origin
 * admin page. A response that is nothing but a document or an image can safely be more specific:
 * no script, no network, nothing but itself, and framing allowed only by this origin.
 */
export const ADMIN_FILE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'";

/** A standalone SVG needs no more than inline styling; with `default-src 'none'` a script inside it cannot run. */
export const ADMIN_SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'";

function binaryHeaders(contentType: string, disposition: string, csp: string, byteLength: number): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Content-Length": String(byteLength),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": csp,
    // The CSP's frame-ancestors is authoritative; this is the same rule for browsers that only read the header.
    "X-Frame-Options": "SAMEORIGIN",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

/** A 200 response for raw bytes with the hardened header set above. */
export function binaryResponse(
  bytes: Uint8Array,
  options: { contentType: string; disposition: string; csp: string },
): Response {
  // A copy: a Buffer may be a view into a pooled ArrayBuffer, which a Blob must not capture whole.
  return new Response(new Blob([new Uint8Array(bytes)], { type: options.contentType }), {
    status: 200,
    headers: binaryHeaders(options.contentType, options.disposition, options.csp, bytes.byteLength),
  });
}

/**
 * The type a stored file is served as. The store only ever holds types `inspectUpload` accepted,
 * but the response type is what decides whether a browser renders or executes the bytes, so it is
 * re-checked here and anything unexpected is downgraded to an opaque download.
 */
export function servableMimeType(mimeType: string, role: FileRole): { contentType: string; forceDownload: boolean } {
  const allowed: readonly string[] = role === "photo" ? PHOTO_FILE_TYPES : PRIMARY_FILE_TYPES;
  return allowed.includes(mimeType)
    ? { contentType: mimeType, forceDownload: false }
    : { contentType: "application/octet-stream", forceDownload: true };
}

/** `?download=1` (or `true`) asks for an attachment instead of an inline preview. */
export function wantsDownload(params: URLSearchParams): boolean {
  const raw = params.get("download");
  return raw !== null && parseBooleanLike(raw) === true;
}

export function parseFileRole(raw: string | null): FileRole {
  const value = raw?.trim() ?? "";
  if (value === "" || value === "primary") return "primary";
  if (value === "photo") return "photo";
  throw validationFailed({ role: "Choose primary or photo." });
}

/* ------------------------------------------------------------------ *
 * QR parameters                                                        *
 * ------------------------------------------------------------------ */

export const QR_MIN_SIZE = 128;
export const QR_MAX_SIZE = 1024;
export const QR_DEFAULT_SIZE = 512;

export type QrFormat = "svg" | "png";

/** Clamps a requested edge length to 128..1024; anything unreadable gets the default. */
export function clampQrSize(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") return QR_DEFAULT_SIZE;
  const requested = Number(raw);
  if (!Number.isFinite(requested)) return QR_DEFAULT_SIZE;
  return Math.min(QR_MAX_SIZE, Math.max(QR_MIN_SIZE, Math.round(requested)));
}

export function parseQrFormat(raw: string | null): QrFormat {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === "" || value === "svg") return "svg";
  if (value === "png") return "png";
  throw validationFailed({ format: "Choose svg or png." });
}

/** `aceva-verify-<reference or id>.<ext>`, reduced to characters that are safe in every file system and header. */
export function qrFilename(record: Pick<DocumentRecord, "id" | "referenceNo">, format: QrFormat): string {
  const slug = (record.referenceNo || record.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `aceva-verify-${slug || "document"}.${format}`;
}
