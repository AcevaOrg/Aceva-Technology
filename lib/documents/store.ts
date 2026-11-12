import { createHash } from "node:crypto";
import { getSql, type SqlRow } from "@/lib/db";
import { CATEGORIES, isDocumentCategory } from "./categories";
import { generateVerificationCode, normalizeVerificationCode } from "./codes";
import type { InspectedUpload } from "./files";
import { toPublicDocument, type PublicDocument } from "./public";
import { ensureDocumentTables } from "./schema";
import {
  DOCUMENT_CATEGORY_KEYS,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  PHOTO_FILE_TYPES,
  PRIMARY_FILE_TYPES,
  type DocumentCategory,
  type DocumentFileMeta,
  type DocumentRecord,
  type DocumentStatus,
  type DocumentVisibility,
  type FieldValue,
  type FileRole,
  type VerificationState,
} from "./types";
import { cleanText, validatePublishable, type DocumentInput } from "./validate";

/**
 * Data access for the document registry (server only).
 *
 * Rules that hold for every function here:
 *  - SQL text never contains user input; values travel as parameters only.
 *  - One statement per call (Neon's HTTP endpoint allows no more); writes that must be atomic are
 *    a single statement with data-modifying CTEs.
 *  - File BYTES are selected in exactly one place, `getFile`. Records only ever carry metadata.
 *  - Dates leave SQL as strings (`to_char`) so a DATE never turns into a local-time JS Date.
 *  - Verification codes are never removed once issued; they can be replaced (`regenerate…`) or the
 *    record revoked. `updateDocument` with `enableVerification: false` therefore keeps the code.
 */

/* ------------------------------------------------------------------ *
 * Typed errors                                                        *
 * ------------------------------------------------------------------ */

/** The row changed since the editor loaded it (`expectedUpdatedAt` no longer matches). */
export class StaleDocumentError extends Error {
  constructor() {
    super("This document was changed by someone else since you opened it.");
    this.name = "StaleDocumentError";
  }
}

/** Publishing refused; `errors` maps a field (or `file` / `photo`) to a display-safe reason. */
export class PublishBlockedError extends Error {
  readonly errors: Record<string, string>;
  constructor(errors: Record<string, string>) {
    super("This document cannot be published yet.");
    this.name = "PublishBlockedError";
    this.errors = errors;
  }
}

/** A document's category is fixed at creation. */
export class DocumentCategoryChangeError extends Error {
  constructor() {
    super("A document's category cannot be changed.");
    this.name = "DocumentCategoryChangeError";
  }
}

/* ------------------------------------------------------------------ *
 * Public types                                                        *
 * ------------------------------------------------------------------ */

export type DocumentSort = "updated" | "issued" | "title" | "created";

export interface DocumentListFilters {
  category?: DocumentCategory;
  status?: DocumentStatus;
  visibility?: DocumentVisibility;
  /** Case-insensitive match on title, holder, reference number and verification code. */
  q?: string;
  /** true = has a verification code, false = has none. */
  verifiable?: boolean;
  /** Expires between today and today + N days (UTC); revoked and archived records are skipped. */
  expiringWithinDays?: number;
  /** Default 50, at most 200. */
  limit?: number;
  offset?: number;
  sort?: DocumentSort;
}

export interface CategoryCounts {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

export const EXPIRING_SOON_DAYS = 60;

export interface DashboardStats {
  byCategory: Record<DocumentCategory, CategoryCounts>;
  totals: CategoryCounts;
  revoked: number;
  /** Past their expiry date, not revoked, not archived. */
  expired: number;
  /** Expiring within `EXPIRING_SOON_DAYS`. */
  expiringSoon: number;
  verifications7d: number;
  verifications30d: number;
  /** Six most recently updated. */
  recentlyUpdated: DocumentRecord[];
  /** Six soonest to expire (today or later). */
  soonestExpiring: DocumentRecord[];
}

export interface VerificationEventRow {
  id: string;
  at: string;
  result: string;
  documentId: string | null;
  documentTitle: string | null;
  category: DocumentCategory | null;
  /** Last four characters of the code that was looked up. */
  codeSuffix: string;
}

export type FileChange = InspectedUpload | null | undefined;

/* ------------------------------------------------------------------ *
 * Small helpers                                                       *
 * ------------------------------------------------------------------ */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CODE_ATTEMPTS = 5;
const COPY_SUFFIX = " (copy)";
const COPY_TITLE_ROOM = 200 - COPY_SUFFIX.length;
const MAX_REVOKE_REASON = 500;
const MAX_SEARCH_LENGTH = 100;
const PUBLIC_LISTING_LIMIT = 1000;

export function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  return value === null || value === undefined ? "" : String(value);
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

/** jsonb arrives as an object from some drivers and as a string from others. */
function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isFieldValue(value: unknown): value is FieldValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toData(value: unknown): Record<string, FieldValue> {
  const parsed = parseJson(value);
  const data: Record<string, FieldValue> = {};
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return data;
  for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (isFieldValue(entry)) data[key] = entry;
  }
  return data;
}

function toFiles(value: unknown): DocumentFileMeta[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  const files: DocumentFileMeta[] = [];
  for (const item of parsed as Array<Record<string, unknown>>) {
    if (item.role !== "primary" && item.role !== "photo") continue;
    files.push({
      id: asString(item.id),
      documentId: asString(item.documentId),
      role: item.role,
      filename: asString(item.filename),
      mimeType: asString(item.mimeType),
      sizeBytes: asNumber(item.sizeBytes),
      sha256: asString(item.sha256),
      createdAt: asString(item.createdAt),
    });
  }
  return files;
}

function toRecord(row: SqlRow): DocumentRecord {
  const category = row.category;
  if (!isDocumentCategory(category)) throw new Error("A document row has an unknown category.");
  return {
    id: asString(row.id),
    category,
    title: asString(row.title),
    summary: asString(row.summary),
    status: asString(row.status) as DocumentStatus,
    visibility: asString(row.visibility) as DocumentVisibility,
    allowDownload: asBoolean(row.allow_download),
    featured: asBoolean(row.featured),
    sortOrder: asNumber(row.sort_order),
    holderName: asString(row.holder_name),
    referenceNo: asString(row.reference_no),
    issuedOn: asNullableString(row.issued_on),
    expiresOn: asNullableString(row.expires_on),
    verificationCode: asNullableString(row.verification_code),
    revokedAt: asNullableString(row.revoked_at),
    revokedReason: asString(row.revoked_reason),
    data: toData(row.data),
    files: toFiles(row.files),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    publishedAt: asNullableString(row.published_at),
    verifyCount: asNumber(row.verify_count),
    lastVerifiedAt: asNullableString(row.last_verified_at),
  };
}

/** Postgres unique violation on the verification-code index (another record drew the same code). */
function isCodeCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message, constraint } = error as { code?: unknown; message?: unknown; constraint?: unknown };
  if (code !== "23505") return false;
  return /verification_code/.test(`${asString(constraint)} ${asString(message)}`);
}

/** Parameters for an optional file in a CTE; `present` switches the whole INSERT on or off. */
interface FileParams {
  present: boolean;
  filename: string;
  mime: string;
  size: number;
  sha: string;
  hex: string;
}

const NO_FILE: FileParams = { present: false, filename: "", mime: "", size: 0, sha: "", hex: "" };

function fileParams(upload: InspectedUpload | null | undefined, role: FileRole): FileParams {
  if (!upload) return NO_FILE;
  const allowed: readonly string[] = role === "photo" ? PHOTO_FILE_TYPES : PRIMARY_FILE_TYPES;
  if (!allowed.includes(upload.mimeType)) throw new Error(`A ${role} file may not be ${upload.mimeType}.`);
  // Recomputed from the bytes: the store is the last line of defence, so it does not take the
  // metadata of an InspectedUpload on trust.
  return {
    present: true,
    filename: upload.filename,
    mime: upload.mimeType,
    size: upload.bytes.length,
    sha: createHash("sha256").update(upload.bytes).digest("hex"),
    hex: Buffer.from(upload.bytes).toString("hex"),
  };
}

function metaFromUpload(upload: InspectedUpload, role: FileRole): DocumentFileMeta {
  return {
    id: "",
    documentId: "",
    role,
    filename: upload.filename,
    mimeType: upload.mimeType,
    sizeBytes: upload.bytes.length,
    sha256: "",
    createdAt: "",
  };
}

/** Gate used by create/update when the payload asks for status "published". */
function assertPublishable(input: DocumentInput, files: DocumentFileMeta[]): void {
  if (input.status !== "published") return;
  const candidate: DocumentRecord = {
    id: "",
    category: input.category,
    title: input.title,
    summary: input.summary,
    status: input.status,
    visibility: input.visibility,
    allowDownload: input.allowDownload,
    featured: input.featured,
    sortOrder: input.sortOrder,
    holderName: input.holderName,
    referenceNo: input.referenceNo,
    issuedOn: input.issuedOn,
    expiresOn: input.expiresOn,
    verificationCode: null,
    revokedAt: null,
    revokedReason: "",
    data: input.data,
    files,
    createdAt: "",
    updatedAt: "",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
  };
  const result = validatePublishable(candidate);
  if (!result.ok) throw new PublishBlockedError(result.errors);
}

/* ------------------------------------------------------------------ *
 * The one SELECT                                                      *
 * ------------------------------------------------------------------ */

type QuerySort = DocumentSort | "public" | "expires";

interface DocumentQuery {
  id?: string | null;
  code?: string | null;
  category?: DocumentCategory | null;
  status?: DocumentStatus | null;
  visibility?: DocumentVisibility | null;
  q?: string | null;
  verifiable?: boolean | null;
  /** Only records that have not expired yet (and are neither revoked nor archived). */
  upcomingExpiry?: boolean;
  expiringWithinDays?: number | null;
  sort: QuerySort;
  limit: number;
  offset: number;
}

/** Escapes LIKE wildcards (and the escape character itself) so user text is matched literally. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[!%_]/g, (char) => `!${char}`);
}

/**
 * Every read of the documents table goes through this single statement, so the column list, the
 * date formatting and the file-metadata subquery exist exactly once. Optional filters use the
 * `$n IS NULL OR …` form, which keeps the SQL text static (no string building from input).
 * File metadata is aggregated in a subquery that never touches the BYTEA column.
 */
async function selectDocuments(query: DocumentQuery): Promise<{ records: DocumentRecord[]; total: number }> {
  await ensureDocumentTables();
  const sql = getSql();

  const search = query.q ? cleanText(query.q).slice(0, MAX_SEARCH_LENGTH) : "";
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const exactCode = search ? normalizeVerificationCode(search) : null;
  const id = query.id ?? null;
  const code = query.code ?? null;
  const category = query.category ?? null;
  const status = query.status ?? null;
  const visibility = query.visibility ?? null;
  const verifiable = query.verifiable ?? null;
  const upcoming = query.upcomingExpiry === true;
  const withinDays = query.expiringWithinDays ?? null;
  const sort = query.sort;

  const run = (limit: number, offset: number): Promise<SqlRow[]> => sql`
    SELECT
      d.id::text AS id, d.category, d.title, d.summary, d.status, d.visibility, d.allow_download, d.featured,
      d.sort_order, d.holder_name, d.reference_no,
      to_char(d.issued_on, 'YYYY-MM-DD') AS issued_on,
      to_char(d.expires_on, 'YYYY-MM-DD') AS expires_on,
      d.verification_code,
      to_char(d.revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS revoked_at,
      d.revoked_reason, d.data, d.verify_count,
      to_char(d.last_verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_verified_at,
      to_char(d.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
      to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
      (
        SELECT coalesce(json_agg(json_build_object(
          'id', f.id::text,
          'documentId', f.document_id::text,
          'role', f.role,
          'filename', f.filename,
          'mimeType', f.mime_type,
          'sizeBytes', f.size_bytes,
          'sha256', f.sha256,
          'createdAt', to_char(f.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) ORDER BY f.role), '[]'::json)
        FROM document_files f WHERE f.document_id = d.id
      ) AS files,
      count(*) OVER ()::int AS total_count
    FROM documents d
    WHERE (${id}::uuid IS NULL OR d.id = ${id}::uuid)
      AND (${code}::text IS NULL OR d.verification_code = ${code}::text)
      AND (${category}::text IS NULL OR d.category = ${category}::text)
      AND (${status}::text IS NULL OR d.status = ${status}::text)
      AND (${visibility}::text IS NULL OR d.visibility = ${visibility}::text)
      AND (${verifiable}::boolean IS NULL OR (d.verification_code IS NOT NULL) = ${verifiable}::boolean)
      AND (
        ${pattern}::text IS NULL
        OR d.title ILIKE ${pattern}::text ESCAPE '!'
        OR d.holder_name ILIKE ${pattern}::text ESCAPE '!'
        OR d.reference_no ILIKE ${pattern}::text ESCAPE '!'
        OR d.verification_code ILIKE ${pattern}::text ESCAPE '!'
        OR d.verification_code = ${exactCode}::text
      )
      AND (
        ${upcoming}::boolean IS NOT TRUE
        OR (d.expires_on >= (now() AT TIME ZONE 'UTC')::date AND d.revoked_at IS NULL AND d.status <> 'archived')
      )
      AND (${withinDays}::int IS NULL OR d.expires_on <= (now() AT TIME ZONE 'UTC')::date + ${withinDays}::int)
    ORDER BY
      CASE WHEN ${sort}::text = 'public' THEN d.featured END DESC,
      CASE WHEN ${sort}::text = 'public' THEN d.sort_order END ASC,
      CASE WHEN ${sort}::text = 'public' THEN d.issued_on END DESC NULLS LAST,
      CASE WHEN ${sort}::text = 'title' THEN lower(d.title) END ASC,
      CASE WHEN ${sort}::text = 'issued' THEN d.issued_on END DESC NULLS LAST,
      CASE WHEN ${sort}::text = 'expires' THEN d.expires_on END ASC,
      CASE WHEN ${sort}::text = 'created' THEN d.created_at END DESC,
      CASE WHEN ${sort}::text = 'updated' THEN d.updated_at END DESC,
      d.updated_at DESC,
      d.id ASC
    LIMIT ${limit}::int OFFSET ${offset}::int`;

  const rows = await run(query.limit, query.offset);
  let total = rows.length > 0 ? asNumber(rows[0].total_count) : 0;
  // A page past the end has no rows to carry the window count; ask for the first row instead.
  if (rows.length === 0 && query.offset > 0) {
    const first = await run(1, 0);
    total = first.length > 0 ? asNumber(first[0].total_count) : 0;
  }
  return { records: rows.map(toRecord), total };
}

/* ------------------------------------------------------------------ *
 * Reads                                                               *
 * ------------------------------------------------------------------ */

/** The record with this id, or null for an unknown or malformed id (never throws for bad input). */
export async function getDocument(id: string): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  const { records } = await selectDocuments({ id, sort: "updated", limit: 1, offset: 0 });
  return records[0] ?? null;
}

/** Looks a record up by its verification code, in any status. Public callers must project the result. */
export async function getDocumentByCode(code: string): Promise<DocumentRecord | null> {
  const canonical = normalizeVerificationCode(code);
  if (!canonical) return null;
  const { records } = await selectDocuments({ code: canonical, sort: "updated", limit: 1, offset: 0 });
  return records[0] ?? null;
}

export async function listDocuments(filters: DocumentListFilters = {}): Promise<{ items: DocumentRecord[]; total: number }> {
  const { category, status, visibility } = filters;
  // A filter value that is not a real option can match nothing; ignoring it would list everything.
  if (category !== undefined && !(DOCUMENT_CATEGORY_KEYS as readonly string[]).includes(category)) return { items: [], total: 0 };
  if (status !== undefined && !(DOCUMENT_STATUSES as readonly string[]).includes(status)) return { items: [], total: 0 };
  if (visibility !== undefined && !(DOCUMENT_VISIBILITIES as readonly string[]).includes(visibility)) return { items: [], total: 0 };

  const limit = Math.min(200, Math.max(1, Math.trunc(filters.limit ?? 50) || 50));
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0) || 0);
  const days = filters.expiringWithinDays;
  const withinDays = days === undefined || !Number.isFinite(days) ? null : Math.min(36_500, Math.max(0, Math.trunc(days)));
  const sort: DocumentSort = filters.sort && ["updated", "issued", "title", "created"].includes(filters.sort) ? filters.sort : "updated";

  const { records, total } = await selectDocuments({
    category: category ?? null,
    status: status ?? null,
    visibility: visibility ?? null,
    q: filters.q ?? null,
    verifiable: filters.verifiable ?? null,
    upcomingExpiry: withinDays !== null,
    expiringWithinDays: withinDays,
    sort,
    limit,
    offset,
  });
  return { items: records, total };
}

export interface PublicListing {
  /** Published + public records, already projected through the privacy boundary. */
  documents: PublicDocument[];
  /**
   * The admin's display-order number for each listed document, by id. It is deliberately NOT part of
   * `PublicDocument` (the public projection carries no admin-only member); it exists only so the
   * Team section can order people within a tier the way the admin arranged them.
   */
  sortOrders: ReadonlyMap<string, number>;
}

export async function listPublicListing(options: { category?: DocumentCategory } = {}): Promise<PublicListing> {
  const empty: PublicListing = { documents: [], sortOrders: new Map() };
  if (options.category !== undefined && !(DOCUMENT_CATEGORY_KEYS as readonly string[]).includes(options.category)) return empty;
  const { records } = await selectDocuments({
    category: options.category ?? null,
    status: "published",
    visibility: "public",
    sort: "public",
    limit: PUBLIC_LISTING_LIMIT,
    offset: 0,
  });
  const now = new Date();
  const documents: PublicDocument[] = [];
  const sortOrders = new Map<string, number>();
  for (const record of records) {
    const projected = toPublicDocument(record, "listing", now);
    if (!projected) continue;
    documents.push(projected);
    sortOrders.set(projected.id, record.sortOrder);
  }
  return { documents, sortOrders };
}

/** Published + public records for /documents, already projected through the privacy boundary. */
export async function listPublicDocuments(options: { category?: DocumentCategory } = {}): Promise<PublicDocument[]> {
  return (await listPublicListing(options)).documents;
}

/* ------------------------------------------------------------------ *
 * Create / update                                                     *
 * ------------------------------------------------------------------ */

async function insertDocument(input: DocumentInput, code: string | null, primary: FileParams, photo: FileParams): Promise<string> {
  const sql = getSql();
  const json = JSON.stringify(input.data);
  const rows = await sql`
    WITH doc AS (
      INSERT INTO documents (
        category, title, summary, status, visibility, allow_download, featured, sort_order,
        holder_name, reference_no, issued_on, expires_on, verification_code, data, published_at
      ) VALUES (
        ${input.category}::text, ${input.title}::text, ${input.summary}::text, ${input.status}::text,
        ${input.visibility}::text, ${input.allowDownload}::boolean, ${input.featured}::boolean, ${input.sortOrder}::int,
        ${input.holderName}::text, ${input.referenceNo}::text, ${input.issuedOn}::date, ${input.expiresOn}::date,
        ${code}::text, ${json}::jsonb,
        CASE WHEN ${input.status}::text = 'published' THEN now() ELSE NULL END
      )
      RETURNING id
    ), primary_file AS (
      INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
      SELECT doc.id, 'primary', ${primary.filename}::text, ${primary.mime}::text, ${primary.size}::int,
             ${primary.sha}::text, decode(${primary.hex}::text, 'hex')
      FROM doc WHERE ${primary.present}::boolean
      RETURNING id
    ), photo_file AS (
      INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
      SELECT doc.id, 'photo', ${photo.filename}::text, ${photo.mime}::text, ${photo.size}::int,
             ${photo.sha}::text, decode(${photo.hex}::text, 'hex')
      FROM doc WHERE ${photo.present}::boolean
      RETURNING id
    )
    SELECT id::text AS id FROM doc`;
  return asString(rows[0]?.id);
}

/**
 * Creates a record (and its files, atomically). A verification code is generated when
 * `input.enableVerification` is set; a collision with an existing code is retried up to five times.
 * Throws `PublishBlockedError` when the payload asks to be published but is not publishable.
 */
export async function createDocument(
  input: DocumentInput,
  files: { primary?: InspectedUpload; photo?: InspectedUpload } = {},
): Promise<DocumentRecord> {
  await ensureDocumentTables();
  const metas: DocumentFileMeta[] = [];
  if (files.primary) metas.push(metaFromUpload(files.primary, "primary"));
  if (files.photo) metas.push(metaFromUpload(files.photo, "photo"));
  assertPublishable(input, metas);

  const primary = fileParams(files.primary, "primary");
  const photo = fileParams(files.photo, "photo");

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = input.enableVerification ? generateVerificationCode() : null;
    try {
      const id = await insertDocument(input, code, primary, photo);
      const created = await getDocument(id);
      if (!created) throw new Error("The new document could not be read back.");
      return created;
    } catch (error) {
      if (code && isCodeCollision(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique verification code.");
}

type FileMode = "keep" | "remove" | "replace";

function fileMode(change: FileChange): FileMode {
  if (change === undefined) return "keep";
  return change === null ? "remove" : "replace";
}

/**
 * Saves the editor's form. Files: `undefined` keeps the stored file, `null` deletes it, an upload
 * replaces it. When `expectedUpdatedAt` (the `updatedAt` the editor loaded) no longer matches, the
 * write is refused with `StaleDocumentError` and nothing changes. Returns null if the id does not exist.
 */
export async function updateDocument(
  id: string,
  input: DocumentInput,
  options: { files?: { primary?: FileChange; photo?: FileChange }; expectedUpdatedAt?: string } = {},
): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  const existing = await getDocument(id);
  if (!existing) return null;
  if (existing.category !== input.category) throw new DocumentCategoryChangeError();

  const expected = options.expectedUpdatedAt ?? null;
  // An unparseable token can never match; refusing it is the safe reading of "stale".
  if (expected !== null && !Number.isFinite(Date.parse(expected))) throw new StaleDocumentError();

  const changes = options.files ?? {};
  const modes = { primary: fileMode(changes.primary), photo: fileMode(changes.photo) };

  const resulting = existing.files.filter((file) => modes[file.role] === "keep");
  if (modes.primary === "replace" && changes.primary) resulting.push(metaFromUpload(changes.primary, "primary"));
  if (modes.photo === "replace" && changes.photo) resulting.push(metaFromUpload(changes.photo, "photo"));
  assertPublishable(input, resulting);

  const primary = fileParams(changes.primary, "primary");
  const photo = fileParams(changes.photo, "photo");
  const needsCode = input.enableVerification && existing.verificationCode === null;
  const json = JSON.stringify(input.data);
  const sql = getSql();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = needsCode ? generateVerificationCode() : null;
    try {
      const rows = await sql`
        WITH upd AS (
          UPDATE documents SET
            title = ${input.title}::text,
            summary = ${input.summary}::text,
            status = ${input.status}::text,
            visibility = ${input.visibility}::text,
            allow_download = ${input.allowDownload}::boolean,
            featured = ${input.featured}::boolean,
            sort_order = ${input.sortOrder}::int,
            holder_name = ${input.holderName}::text,
            reference_no = ${input.referenceNo}::text,
            issued_on = ${input.issuedOn}::date,
            expires_on = ${input.expiresOn}::date,
            verification_code = COALESCE(verification_code, ${code}::text),
            data = ${json}::jsonb,
            published_at = CASE WHEN ${input.status}::text = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
            updated_at = greatest(
              date_trunc('milliseconds', clock_timestamp()),
              date_trunc('milliseconds', updated_at) + interval '1 millisecond'
            )
          WHERE id = ${id}::uuid
            AND (
              ${expected}::timestamptz IS NULL
              OR date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', ${expected}::timestamptz)
            )
          RETURNING id
        ), drop_primary AS (
          DELETE FROM document_files
          WHERE document_id IN (SELECT id FROM upd) AND role = 'primary' AND ${modes.primary}::text = 'remove'
          RETURNING id
        ), drop_photo AS (
          DELETE FROM document_files
          WHERE document_id IN (SELECT id FROM upd) AND role = 'photo' AND ${modes.photo}::text = 'remove'
          RETURNING id
        ), put_primary AS (
          INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
          SELECT upd.id, 'primary', ${primary.filename}::text, ${primary.mime}::text, ${primary.size}::int,
                 ${primary.sha}::text, decode(${primary.hex}::text, 'hex')
          FROM upd WHERE ${modes.primary}::text = 'replace'
          ON CONFLICT (document_id, role) DO UPDATE SET
            filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
            sha256 = EXCLUDED.sha256, data = EXCLUDED.data, created_at = now()
          RETURNING id
        ), put_photo AS (
          INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
          SELECT upd.id, 'photo', ${photo.filename}::text, ${photo.mime}::text, ${photo.size}::int,
                 ${photo.sha}::text, decode(${photo.hex}::text, 'hex')
          FROM upd WHERE ${modes.photo}::text = 'replace'
          ON CONFLICT (document_id, role) DO UPDATE SET
            filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
            sha256 = EXCLUDED.sha256, data = EXCLUDED.data, created_at = now()
          RETURNING id
        )
        SELECT id::text AS id FROM upd`;

      if (rows.length === 0) {
        // Nothing matched: either the row vanished or the token is stale. Tell the two apart.
        const current = await getDocument(id);
        if (!current) return null;
        throw new StaleDocumentError();
      }
      return await getDocument(id);
    } catch (error) {
      if (code && isCodeCollision(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique verification code.");
}

/* ------------------------------------------------------------------ *
 * Workflow actions                                                    *
 * ------------------------------------------------------------------ */

/** Moves a record between draft / published / archived. Publishing is gated by `validatePublishable`. */
export async function setDocumentStatus(id: string, status: DocumentStatus): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  if (!(DOCUMENT_STATUSES as readonly string[]).includes(status)) throw new Error("Unknown document status.");
  const existing = await getDocument(id);
  if (!existing) return null;

  if (status === "published") {
    const result = validatePublishable(existing);
    if (!result.ok) throw new PublishBlockedError(result.errors);
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE documents SET
      status = ${status}::text,
      published_at = CASE WHEN ${status}::text = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
      updated_at = greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', updated_at) + interval '1 millisecond')
    WHERE id = ${id}::uuid
    RETURNING id::text AS id`;
  return rows.length > 0 ? getDocument(id) : null;
}

/** Marks a record revoked. Its verify page then says so and shows nothing else. Idempotent. */
export async function revokeDocument(id: string, reason: string): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  await ensureDocumentTables();
  const cleaned = cleanText(String(reason ?? "")).slice(0, MAX_REVOKE_REASON);
  const sql = getSql();
  const rows = await sql`
    UPDATE documents SET
      revoked_at = COALESCE(revoked_at, now()),
      revoked_reason = ${cleaned}::text,
      updated_at = greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', updated_at) + interval '1 millisecond')
    WHERE id = ${id}::uuid
    RETURNING id::text AS id`;
  return rows.length > 0 ? getDocument(id) : null;
}

export async function reinstateDocument(id: string): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  await ensureDocumentTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE documents SET
      revoked_at = NULL,
      revoked_reason = '',
      updated_at = greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', updated_at) + interval '1 millisecond')
    WHERE id = ${id}::uuid
    RETURNING id::text AS id`;
  return rows.length > 0 ? getDocument(id) : null;
}

/** Replaces the verification code (or issues one). The old code stops resolving immediately. */
export async function regenerateVerificationCode(id: string): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  await ensureDocumentTables();
  const sql = getSql();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateVerificationCode();
    try {
      const rows = await sql`
        UPDATE documents SET
          verification_code = ${code}::text,
          updated_at = greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', updated_at) + interval '1 millisecond')
        WHERE id = ${id}::uuid
        RETURNING id::text AS id`;
      return rows.length > 0 ? await getDocument(id) : null;
    } catch (error) {
      if (isCodeCollision(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique verification code.");
}

/**
 * Copies a record and its files into a new DRAFT titled "… (copy)". The copy gets its own
 * verification code (only if the original had one) and no reference number, since a reference
 * identifies one specific paper. For personal categories the person's consent is NOT carried over,
 * and a public copy drops to unlisted: consent belongs to the person, not to the template.
 */
export async function duplicateDocument(id: string): Promise<DocumentRecord | null> {
  if (!isDocumentId(id)) return null;
  const source = await getDocument(id);
  if (!source) return null;
  const personal = CATEGORIES[source.category].personal;
  const sql = getSql();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = source.verificationCode ? generateVerificationCode() : null;
    try {
      const rows = await sql`
        WITH src AS (
          SELECT * FROM documents WHERE id = ${id}::uuid
        ), copy AS (
          INSERT INTO documents (
            category, title, summary, status, visibility, allow_download, featured, sort_order,
            holder_name, reference_no, issued_on, expires_on, verification_code, data
          )
          SELECT
            category, left(title, ${COPY_TITLE_ROOM}::int) || ${COPY_SUFFIX}::text, summary, 'draft',
            CASE WHEN ${personal}::boolean AND visibility = 'public' THEN 'unlisted' ELSE visibility END,
            allow_download, false, sort_order, holder_name, '', issued_on, expires_on, ${code}::text,
            CASE WHEN ${personal}::boolean THEN data - 'consent_to_publish' ELSE data END
          FROM src
          RETURNING id
        ), copied_files AS (
          INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
          SELECT copy.id, f.role, f.filename, f.mime_type, f.size_bytes, f.sha256, f.data
          FROM copy, document_files f WHERE f.document_id = ${id}::uuid
          RETURNING id
        )
        SELECT id::text AS id FROM copy`;
      return rows.length > 0 ? await getDocument(asString(rows[0].id)) : null;
    } catch (error) {
      if (code && isCodeCollision(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique verification code.");
}

/** Deletes a record; its files go with it (ON DELETE CASCADE) and its past lookups stay as anonymous events. */
export async function deleteDocument(id: string): Promise<boolean> {
  if (!isDocumentId(id)) return false;
  await ensureDocumentTables();
  const sql = getSql();
  const rows = await sql`DELETE FROM documents WHERE id = ${id}::uuid RETURNING id::text AS id`;
  return rows.length > 0;
}

/* ------------------------------------------------------------------ *
 * Files                                                               *
 * ------------------------------------------------------------------ */

/**
 * The only function that reads file bytes. The caller decides whether the requester may have them
 * (admin session, or a public record that passed `toPublicDocument`).
 */
export async function getFile(documentId: string, role: FileRole): Promise<{ meta: DocumentFileMeta; bytes: Buffer } | null> {
  if (!isDocumentId(documentId)) return null;
  if (role !== "primary" && role !== "photo") return null;
  await ensureDocumentTables();
  const sql = getSql();
  const rows = await sql`
    SELECT
      f.id::text AS id, f.document_id::text AS document_id, f.role, f.filename, f.mime_type, f.size_bytes, f.sha256,
      to_char(f.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      encode(f.data, 'hex') AS data_hex
    FROM document_files f
    WHERE f.document_id = ${documentId}::uuid AND f.role = ${role}::text`;
  const row = rows[0];
  if (!row) return null;

  const bytes = Buffer.from(asString(row.data_hex), "hex");
  const meta: DocumentFileMeta = {
    id: asString(row.id),
    documentId: asString(row.document_id),
    role,
    filename: asString(row.filename),
    mimeType: asString(row.mime_type),
    sizeBytes: asNumber(row.size_bytes),
    sha256: asString(row.sha256),
    createdAt: asString(row.created_at),
  };
  // Never serve bytes that do not match what was stored: corruption must surface, not be published.
  if (bytes.length !== meta.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== meta.sha256) {
    console.error("[documents] stored file failed its integrity check");
    return null;
  }
  return { meta, bytes };
}

/* ------------------------------------------------------------------ *
 * Public verification                                                 *
 * ------------------------------------------------------------------ */

const IP_HASH_PATTERN = /^[A-Za-z0-9+/=_-]{1,64}$/;

/**
 * Logging must never break a lookup: a failed insert is swallowed (and logged without the code).
 * Only the last four characters of the code are kept, so the events table cannot be replayed to
 * reach a record.
 */
async function recordLookup(params: {
  documentId: string | null;
  result: string;
  codeSuffix: string;
  ipHash: string;
  countIt: boolean;
}): Promise<void> {
  try {
    const sql = getSql();
    const { documentId, result, codeSuffix, ipHash } = params;
    if (params.countIt && documentId) {
      await sql`
        WITH event AS (
          INSERT INTO verification_events (document_id, result, ip_hash, code_suffix)
          VALUES (${documentId}::uuid, ${result}::text, ${ipHash}::text, ${codeSuffix}::text)
          RETURNING id
        )
        UPDATE documents SET verify_count = verify_count + 1, last_verified_at = now()
        WHERE id = ${documentId}::uuid`;
    } else {
      await sql`
        INSERT INTO verification_events (document_id, result, ip_hash, code_suffix)
        VALUES (${documentId}::uuid, ${result}::text, ${ipHash}::text, ${codeSuffix}::text)`;
    }
  } catch {
    console.error("[documents] could not record a verification lookup");
  }
}

/**
 * Resolves a code typed by a visitor or scanned from a QR. Unknown, malformed, private, draft and
 * archived all answer `not_found`, indistinguishably, so the endpoint cannot be used to probe for
 * records that are not public. Malformed input never reaches the database.
 */
export async function lookupVerification(
  code: string,
  meta: { ipHash?: string } = {},
): Promise<{ state: VerificationState; document: PublicDocument | null }> {
  const canonical = normalizeVerificationCode(code);
  if (!canonical) return { state: "not_found", document: null };

  const ipHash = meta.ipHash && IP_HASH_PATTERN.test(meta.ipHash) ? meta.ipHash : "";
  const codeSuffix = canonical.slice(-4);
  const record = await getDocumentByCode(canonical);
  const document = record ? toPublicDocument(record, "verify") : null;

  if (!record || !document) {
    // A hidden record is still linked to the event so the team can see someone scanned a draft.
    await recordLookup({ documentId: record?.id ?? null, result: "not_found", codeSuffix, ipHash, countIt: false });
    return { state: "not_found", document: null };
  }

  await recordLookup({ documentId: record.id, result: document.state, codeSuffix, ipHash, countIt: true });
  return { state: document.state, document };
}

/* ------------------------------------------------------------------ *
 * Admin dashboard                                                     *
 * ------------------------------------------------------------------ */

function emptyCounts(): CategoryCounts {
  return { total: 0, published: 0, draft: 0, archived: 0 };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureDocumentTables();
  const sql = getSql();

  const [categoryRows, healthRows, lookupRows, recent, expiring] = await Promise.all([
    sql`
      SELECT category,
        count(*)::int AS total,
        (count(*) FILTER (WHERE status = 'published'))::int AS published,
        (count(*) FILTER (WHERE status = 'draft'))::int AS draft,
        (count(*) FILTER (WHERE status = 'archived'))::int AS archived
      FROM documents GROUP BY category`,
    sql`
      SELECT
        (count(*) FILTER (WHERE revoked_at IS NOT NULL))::int AS revoked,
        (count(*) FILTER (
          WHERE revoked_at IS NULL AND status <> 'archived' AND expires_on < (now() AT TIME ZONE 'UTC')::date
        ))::int AS expired,
        (count(*) FILTER (
          WHERE revoked_at IS NULL AND status <> 'archived'
            AND expires_on >= (now() AT TIME ZONE 'UTC')::date
            AND expires_on <= (now() AT TIME ZONE 'UTC')::date + ${EXPIRING_SOON_DAYS}::int
        ))::int AS expiring_soon
      FROM documents`,
    sql`
      SELECT
        (count(*) FILTER (WHERE at >= now() - interval '7 days'))::int AS last_7,
        (count(*) FILTER (WHERE at >= now() - interval '30 days'))::int AS last_30
      FROM verification_events`,
    selectDocuments({ sort: "updated", limit: 6, offset: 0 }),
    selectDocuments({ upcomingExpiry: true, sort: "expires", limit: 6, offset: 0 }),
  ]);

  const byCategory = Object.fromEntries(DOCUMENT_CATEGORY_KEYS.map((key) => [key, emptyCounts()])) as Record<
    DocumentCategory,
    CategoryCounts
  >;
  const totals = emptyCounts();
  for (const row of categoryRows) {
    if (!isDocumentCategory(row.category)) continue;
    const counts: CategoryCounts = {
      total: asNumber(row.total),
      published: asNumber(row.published),
      draft: asNumber(row.draft),
      archived: asNumber(row.archived),
    };
    byCategory[row.category] = counts;
    totals.total += counts.total;
    totals.published += counts.published;
    totals.draft += counts.draft;
    totals.archived += counts.archived;
  }

  const health = healthRows[0] ?? {};
  const lookups = lookupRows[0] ?? {};
  return {
    byCategory,
    totals,
    revoked: asNumber(health.revoked),
    expired: asNumber(health.expired),
    expiringSoon: asNumber(health.expiring_soon),
    verifications7d: asNumber(lookups.last_7),
    verifications30d: asNumber(lookups.last_30),
    recentlyUpdated: recent.records,
    soonestExpiring: expiring.records,
  };
}

export async function listVerificationEvents(
  options: { limit?: number; offset?: number; documentId?: string } = {},
): Promise<{ events: VerificationEventRow[]; total: number }> {
  if (options.documentId !== undefined && !isDocumentId(options.documentId)) return { events: [], total: 0 };
  await ensureDocumentTables();
  const sql = getSql();
  const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50) || 50));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0) || 0);
  const documentId = options.documentId ?? null;

  const run = (pageLimit: number, pageOffset: number): Promise<SqlRow[]> => sql`
    SELECT
      e.id::text AS id,
      to_char(e.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,
      e.result, e.document_id::text AS document_id, d.title AS document_title, d.category AS category,
      e.code_suffix, count(*) OVER ()::int AS total_count
    FROM verification_events e
    LEFT JOIN documents d ON d.id = e.document_id
    WHERE (${documentId}::uuid IS NULL OR e.document_id = ${documentId}::uuid)
    ORDER BY e.at DESC, e.id DESC
    LIMIT ${pageLimit}::int OFFSET ${pageOffset}::int`;

  const rows = await run(limit, offset);
  let total = rows.length > 0 ? asNumber(rows[0].total_count) : 0;
  if (rows.length === 0 && offset > 0) {
    const first = await run(1, 0);
    total = first.length > 0 ? asNumber(first[0].total_count) : 0;
  }
  const events = rows.map((row) => ({
    id: asString(row.id),
    at: asString(row.at),
    result: asString(row.result),
    documentId: asNullableString(row.document_id),
    documentTitle: asNullableString(row.document_title),
    category: isDocumentCategory(row.category) ? row.category : null,
    codeSuffix: asString(row.code_suffix),
  }));
  return { events, total };
}
