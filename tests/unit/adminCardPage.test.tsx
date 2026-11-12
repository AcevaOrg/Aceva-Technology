import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { CATEGORIES } from "@/lib/documents/categories";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { createDocument } from "@/lib/documents/store";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";

const guard = vi.hoisted(() => ({ requireAdminPage: vi.fn() }));

vi.mock("@/lib/admin/auth", () => ({ requireAdminPage: guard.requireAdminPage }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Imported after the mocks are registered.
import DocumentCardPage from "@/app/admin/(console)/documents/[id]/card/page";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let pg: Awaited<ReturnType<typeof createPgliteSql>>;
let db: PGlite;
let sql: SqlClient;

beforeAll(async () => {
  pg = await createPgliteSql();
  db = pg.db;
  sql = pg.sql;
  setSqlClientForTests(sql);
  await ensureDocumentTables();
});

afterAll(async () => {
  setSqlClientForTests(null);
  resetDocumentTablesCache();
  await pg.close();
});

beforeEach(async () => {
  setSqlClientForTests(sql);
  guard.requireAdminPage.mockReset();
  guard.requireAdminPage.mockResolvedValue({ issuedAt: 0, expiresAt: Date.now() + 60_000 });
  await db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

function input(category: DocumentCategory, top: Record<string, unknown>, data: Record<string, unknown>): DocumentInput {
  const result = validateDocumentInput({ ...top, data }, { category });
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return result.value;
}

function photo(): InspectedUpload {
  const result = inspectUpload({ name: "portrait.jpg", bytes: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(512)]) }, "photo");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

function pdf(): InspectedUpload {
  const body = Buffer.from(Array.from({ length: 1024 }, (_, i) => 0x41 + (i % 26)));
  const result = inspectUpload({ name: "doc.pdf", bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]) }, "primary");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

async function certificate(top: Record<string, unknown> = {}, data: Record<string, unknown> = {}): Promise<DocumentRecord> {
  return createDocument(
    input(
      "certification",
      { title: "ISO 27001", holderName: "ACEVA Technology", referenceNo: "ACV/CERT/2026/0042", issuedOn: "2026-01-10", status: "published", ...top },
      { direction: "held", issuing_body: "BSI", ...data },
    ),
    { primary: pdf() },
  );
}

async function renderPage(id: string): Promise<string> {
  const element = await DocumentCardPage({ params: Promise.resolve({ id }) });
  return renderToStaticMarkup(element);
}

/** The visible words: the page headline is split into one span per word, so phrases are checked on this. */
function words(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

/** A Print button that is switched off. */
const DISABLED_PRINT = /<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Print/;

/* ------------------------------------------------------------------ *
 * The QR label page                                                   *
 * ------------------------------------------------------------------ */

describe("the QR label page", () => {
  it("renders the preview, the print controls and no banner for a complete record", async () => {
    const record = await certificate();
    const html = await renderPage(record.id);

    expect(guard.requireAdminPage).toHaveBeenCalledWith(`/admin/documents/${record.id}/card`);
    expect(words(html)).toContain("QR labels");
    expect(html).toContain("ISO 27001");
    expect(html).toContain("ACV/CERT/2026/0042");
    expect(html).toContain(`/api/admin/documents/${record.id}/qr?format=svg`);
    expect(html).toContain("Verified by ACEVA");
    expect(html).toContain("Label size");
    expect(html).toContain("Fill the sheet");
    expect(html).toContain("Download SVG");
    expect(html).toContain("Download PNG");
    expect(html).toContain(`href="/admin/documents/${record.id}"`);
    expect(html).not.toContain("Not ready to print");
    // Print is enabled: no disabled print button anywhere.
    expect(html).not.toMatch(DISABLED_PRINT);
  });

  it("never mentions an ID card or offers a card layout", async () => {
    const html = await renderPage((await certificate()).id);
    expect(words(html)).not.toMatch(/ID card|Cards per sheet|Card side|Front only|Back only/i);
  });

  it("offers labels for the other verifiable categories too", async () => {
    const letter = await createDocument(
      input(
        "experience_letter",
        { title: "Experience letter — Engineer", holderName: "Bilal Ahmed", referenceNo: "ACV/EL/2026/0007", issuedOn: "2026-01-10", status: "published" },
        { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "Head of People" },
      ),
      { primary: pdf() },
    );
    const html = await renderPage(letter.id);
    expect(words(html)).toContain("QR labels");
    expect(html).toContain("Label size");
  });

  it("shows the verification link as a short URL and never the stored private fields", async () => {
    // A people record is the personal category with the most private data: email, notes and a photo.
    const record = await createDocument(
      input(
        "program_record",
        { title: "Software Engineering Intern", holderName: "Sara Malik", referenceNo: "ACV/PRG/2026/014", status: "published" },
        {
          hierarchy_level: "trainee",
          role_title: "Frontend Intern",
          record_kind: "intern",
          program_name: "Summer Internship 2026",
          start_date: "2026-06-01",
          record_status: "active",
          contact_email: "sara@example.com",
          internal_notes: "secret note",
        },
      ),
      { photo: photo() },
    );
    const html = await renderPage(record.id);
    expect(html).toContain(`acevatech.com/verify/${record.verificationCode}`);
    expect(html).not.toContain("sara@example.com");
    expect(html).not.toContain("secret note");
    // The holder's portrait has no place on a label.
    expect(html).not.toContain("role=photo");
  });

  it("shows the checklist banner and disables Print when verification is switched off", async () => {
    const record = await certificate({ enableVerification: false });
    expect(record.verificationCode).toBeNull();
    const html = await renderPage(record.id);
    expect(html).toContain("Not ready to print");
    expect(html).toContain("Verification code");
    expect(html).toContain("Open in the editor");
    expect(html).toMatch(DISABLED_PRINT);
    // The preview is still drawn, with a placeholder instead of a broken image.
    expect(html).toContain("QR appears once verification is on");
  });

  it("treats a stored value that is not a real code like no code at all", async () => {
    const record = await certificate();
    await db.exec(`UPDATE documents SET verification_code = 'not-a-code' WHERE id = '${record.id}'`);
    const html = await renderPage(record.id);
    expect(html).toContain("Not ready to print");
    expect(html).toMatch(DISABLED_PRINT);
    expect(html).not.toContain("not-a-code");
  });

  it("warns, but still allows printing, for a draft", async () => {
    const record = await certificate({ status: "draft" });
    const html = await renderPage(record.id);
    expect(html).toContain("Ready to print, with notes");
    expect(html).toContain("Still a draft");
    expect(html).not.toMatch(DISABLED_PRINT);
  });

  it("escapes a hostile name", async () => {
    const record = await certificate({ holderName: "<img src=x onerror=alert(1)>" });
    const html = await renderPage(record.id);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

/* ------------------------------------------------------------------ *
 * Categories without verification                                     *
 * ------------------------------------------------------------------ */

describe("the label page for categories without verification", () => {
  it("tells the admin to enable verification for a category that is not verifiable", async () => {
    expect(CATEGORIES.financial_report.verifiable).toBe(false);
    const record = await createDocument(
      input("financial_report", { title: "FY 2026 Statements", issuedOn: "2026-01-10" }, { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" }),
      { primary: pdf() },
    );
    expect(record.verificationCode).toBeNull();
    const html = await renderPage(record.id);
    expect(words(html)).toContain("No QR for this one");
    expect(html).toContain("Enable verification in the editor");
    expect(html).toContain(`href="/admin/documents/${record.id}"`);
    expect(html).not.toContain("Label size");
  });

  it("prints labels for a non-verifiable category once verification has been turned on", async () => {
    const record = await createDocument(
      input("company_identity", { title: "Certificate of Incorporation", enableVerification: true, status: "published" }, { identity_type: "incorporation_certificate" }),
      { primary: pdf() },
    );
    expect(record.verificationCode).not.toBeNull();
    const html = await renderPage(record.id);
    expect(words(html)).toContain("QR labels");
    expect(html).toContain("Label size");
  });
});

/* ------------------------------------------------------------------ *
 * Guards                                                              *
 * ------------------------------------------------------------------ */

describe("page guards", () => {
  it("proves the session before it reads anything, and stops when there is none", async () => {
    const record = await certificate();
    guard.requireAdminPage.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(renderPage(record.id)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("is a 404 for an id that does not exist", async () => {
    await expect(renderPage(MISSING_ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for something that is not an id", async () => {
    await expect(renderPage("../../etc/passwd")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(renderPage("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
