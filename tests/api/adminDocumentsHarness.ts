import type { PGlite } from "@electric-sql/pglite";
import { vi } from "vitest";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";
import { ensureAdminTables } from "@/lib/admin/tables";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { resetRateLimitStore } from "@/lib/rateLimit";
import { createPgliteSql } from "../helpers/pgliteSql";

/**
 * Shared fixtures for the /api/admin/documents route tests: an in-memory Postgres, a signed-in
 * request builder, multipart bodies, and files whose bytes are genuinely a PDF / PNG / JPEG / WEBP.
 * (This file is not a test; vitest only runs *.test.ts.)
 */

export const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
export const ORIGIN = "https://aceva.test";
export const API = `${ORIGIN}/api/admin/documents`;
export const MISSING_ID = "99999999-9999-4999-8999-999999999999";
export const CLIENT_IP = "203.0.113.5";

/* ------------------------------------------------------------------ *
 * Database                                                             *
 * ------------------------------------------------------------------ */

export interface TestDatabase {
  db: PGlite;
  sql: SqlClient;
  close: () => Promise<void>;
}

/** Starts an embedded Postgres, routes the app's SQL to it and creates both table sets. */
export async function startDatabase(): Promise<TestDatabase> {
  const pg = await createPgliteSql();
  setSqlClientForTests(pg.sql);
  await ensureDocumentTables();
  await ensureAdminTables();
  return pg;
}

export async function stopDatabase(database: TestDatabase): Promise<void> {
  setSqlClientForTests(null);
  resetDocumentTablesCache();
  await database.close();
}

export async function clearDatabase(database: TestDatabase): Promise<void> {
  setSqlClientForTests(database.sql);
  await database.db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
  await database.db.exec("TRUNCATE admin_audit_log RESTART IDENTITY");
}

export async function auditRows(database: TestDatabase): Promise<
  Array<{ action: string; entity_type: string | null; entity_id: string | null; actor: string; detail: Record<string, unknown> | null }>
> {
  const result = await database.db.query<{
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    actor: string;
    detail: Record<string, unknown> | null;
  }>("SELECT action, entity_type, entity_id, actor, detail FROM admin_audit_log ORDER BY id");
  return result.rows;
}

export async function countRows(database: TestDatabase, table: "documents" | "document_files" | "admin_audit_log"): Promise<number> {
  const result = await database.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return result.rows[0].n;
}

/* ------------------------------------------------------------------ *
 * Environment and requests                                             *
 * ------------------------------------------------------------------ */

/** Enables the console, resets the rate limiter and keeps the expected warnings out of the test output. */
export function enableAdmin(): void {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_MAX_UPLOAD_MB", "");
  resetRateLimitStore();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}

export async function sessionCookie(): Promise<string> {
  return `${getAdminCookieName()}=${await createSessionToken()}`;
}

export interface RequestOptions {
  /** Default true: attach a valid session cookie. */
  authed?: boolean;
  headers?: Record<string, string>;
}

async function baseHeaders(options: RequestOptions): Promise<Record<string, string>> {
  return {
    "x-forwarded-for": CLIENT_IP,
    ...(options.authed === false ? {} : { cookie: await sessionCookie() }),
    ...options.headers,
  };
}

export async function getRequest(url: string, options: RequestOptions = {}): Promise<Request> {
  return new Request(url, { method: "GET", headers: await baseHeaders(options) });
}

export async function jsonRequest(method: string, url: string, body: unknown, options: RequestOptions = {}): Promise<Request> {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...(await baseHeaders(options)) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function formRequest(method: string, url: string, form: FormData, options: RequestOptions = {}): Promise<Request> {
  return new Request(url, { method, headers: await baseHeaders(options), body: form });
}

/**
 * The body of `form` as a chunked stream with no Content-Length, the way a real upload arrives.
 * (A FormData body handed straight to Request is read by undici's own generator, which throws an
 * internal "already closed" error when a reader cancels it part-way. A plain stream does not.)
 */
export async function streamedForm(form: FormData, chunkSize = 64 * 1024): Promise<{ body: ReadableStream<Uint8Array>; contentType: string }> {
  const wrapped = new Response(form);
  const contentType = wrapped.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await wrapped.arrayBuffer());
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
  return { body, contentType };
}

export async function streamedFormRequest(method: string, url: string, form: FormData, options: RequestOptions = {}): Promise<Request> {
  const { body, contentType } = await streamedForm(form);
  const init: RequestInit & { duplex: "half" } = {
    method,
    body,
    duplex: "half",
    headers: { ...(await baseHeaders(options)), "content-type": contentType },
  };
  return new Request(url, init);
}

export async function deleteRequest(url: string, options: RequestOptions = {}): Promise<Request> {
  return new Request(url, { method: "DELETE", headers: await baseHeaders(options) });
}

export function idContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** The parsed body of an API response, typed loosely on purpose: tests assert on the shape. */
export async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

export async function documentOf(response: Response): Promise<DocumentRecord> {
  const body = await readBody(response);
  return body.document as DocumentRecord;
}

/* ------------------------------------------------------------------ *
 * Files whose bytes really are what they claim                         *
 * ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Letters only between the header and the trailer, so no byte run can look like a PDF action marker.
 * A different `seed` shifts the alphabet, giving a different file (and a different hash) of the same size.
 */
export function pdfBytes(size = 2048, seed = 0): Buffer {
  const shift = seed % LETTERS.length;
  const body = Buffer.alloc(size, LETTERS.slice(shift) + LETTERS.slice(0, shift));
  return Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]);
}

export function pngBytes(size = 512): Buffer {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(size, 0x20)]);
}

export function jpegBytes(size = 512, seed = 0): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, 0x30 + (seed % 10))]);
}

export function webpBytes(size = 512): Buffer {
  return Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x20, 0x02, 0x00, 0x00]), Buffer.from("WEBP"), Buffer.alloc(size, 0x20)]);
}

export interface FormFile {
  name: string;
  type?: string;
  bytes: Uint8Array;
}

export function toFile(file: FormFile): File {
  // A copy: File wants an ArrayBuffer-backed view, and a Buffer may share a pooled one.
  return new File([new Uint8Array(file.bytes)], file.name, { type: file.type ?? "" });
}

export const pdfFile = (name = "letter.pdf", size = 2048, seed = 0): FormFile => ({ name, type: "application/pdf", bytes: pdfBytes(size, seed) });
export const jpegFile = (name = "portrait.jpg", size = 512, seed = 0): FormFile => ({ name, type: "image/jpeg", bytes: jpegBytes(size, seed) });
export const pngFile = (name = "scan.png", size = 512): FormFile => ({ name, type: "image/png", bytes: pngBytes(size) });

export interface FormParts {
  primary?: FormFile;
  photo?: FormFile;
  /** Extra text fields: removePrimary, removePhoto, expectedUpdatedAt, ... */
  fields?: Record<string, string>;
}

/** The editor's multipart body: a JSON `payload` part, optional files, optional text fields. */
export function documentForm(payload: unknown, parts: FormParts = {}): FormData {
  const form = new FormData();
  form.append("payload", typeof payload === "string" ? payload : JSON.stringify(payload));
  if (parts.primary) form.append("primary", toFile(parts.primary));
  if (parts.photo) form.append("photo", toFile(parts.photo));
  for (const [name, value] of Object.entries(parts.fields ?? {})) form.append(name, value);
  return form;
}

/* ------------------------------------------------------------------ *
 * Valid payloads, one per category                                     *
 * ------------------------------------------------------------------ */

/** The smallest payload each category accepts. Fixed `referenceNo`s keep the suggestion tests honest. */
export const VALID_PAYLOADS: Record<DocumentCategory, Record<string, unknown>> = {
  financial_report: {
    category: "financial_report",
    title: "FY 2025-26 Audited Statements",
    issuedOn: "2026-01-10",
    data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" },
  },
  company_identity: {
    category: "company_identity",
    title: "Certificate of Incorporation",
    data: { identity_type: "incorporation_certificate" },
  },
  certification: {
    category: "certification",
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    data: { direction: "held", issuing_body: "BSI", skills: ["security", "isms"] },
  },
  program_record: {
    category: "program_record",
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", start_date: "2026-06-01", record_status: "active", contact_email: "aisha@example.com" },
  },
  experience_letter: {
    category: "experience_letter",
    title: "Experience letter",
    holderName: "Bilal Ahmed",
    referenceNo: "ACV/EL/2026/0007",
    issuedOn: "2026-02-01",
    data: { designation: "Software Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "Head of People" },
  },
};

export function payloadFor(category: DocumentCategory, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...VALID_PAYLOADS[category], ...overrides };
}
