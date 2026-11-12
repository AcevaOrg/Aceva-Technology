import { createHash, randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql, setSqlClientForTests, type SqlClient } from "@/lib/db";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import { normalizeVerificationCode } from "@/lib/documents/codes";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import {
  DocumentCategoryChangeError,
  EXPIRING_SOON_DAYS,
  PublishBlockedError,
  StaleDocumentError,
  createDocument,
  deleteDocument,
  duplicateDocument,
  escapeLikePattern,
  getDashboardStats,
  getDocument,
  getDocumentByCode,
  getFile,
  listDocuments,
  listPublicDocuments,
  listVerificationEvents,
  lookupVerification,
  regenerateVerificationCode,
  reinstateDocument,
  revokeDocument,
  setDocumentStatus,
  updateDocument,
} from "@/lib/documents/store";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";
import { requirePhoto } from "../helpers/specOverrides";
import { parseListQuery, toListFilters } from "@/components/admin/pages/listQuery";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let pg: Awaited<ReturnType<typeof createPgliteSql>>;
let db: PGlite;
let sql: SqlClient;

const CODE_PATTERN = /^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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
  await db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

const VALID: Record<DocumentCategory, Record<string, unknown>> = {
  financial_report: {
    title: "FY 2025-26 Audited Statements",
    issuedOn: "2026-01-10",
    data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" },
  },
  company_identity: { title: "Certificate of Incorporation", data: { identity_type: "incorporation_certificate" } },
  certification: {
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    data: { direction: "held", issuing_body: "BSI", skills: ["security", "isms"] },
  },
  program_record: {
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", start_date: "2026-06-01", record_status: "active", contact_email: "aisha@example.com" },
  },
  experience_letter: {
    title: "Experience letter",
    holderName: "Bilal Ahmed",
    referenceNo: "ACV/EL/2026/0007",
    issuedOn: "2026-02-01",
    data: { designation: "Software Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "Head of People" },
  },
};

let referenceSequence = 0;

function input(category: DocumentCategory, top: Record<string, unknown> = {}, data: Record<string, unknown> = {}): DocumentInput {
  const base = VALID[category];
  // Reference numbers are unique within a category, so a fixture that does not name its own gets a numbered one.
  const numbered = "referenceNo" in top || !base.referenceNo ? {} : { referenceNo: `${String(base.referenceNo)}-${(referenceSequence += 1)}` };
  const result = validateDocumentInput({ ...base, ...numbered, ...top, data: { ...(base.data as object), ...data } }, { category });
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return result.value;
}

function photoBytes(size = 1024): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(size)]);
}

let uploadSequence = 0;

/** A valid PDF whose body is letters only, so no random run can look like an action marker. */
function pdfUpload(name = "letter.pdf", size = 2048): InspectedUpload {
  uploadSequence += 1;
  const body = Buffer.from(Array.from({ length: size }, (_, i) => 0x41 + ((i * 7 + uploadSequence) % 26)));
  const result = inspectUpload({ name, bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]) }, "primary");
  if (!result.ok) throw new Error(`fixture upload invalid: ${result.error}`);
  return result.file;
}

function randomPhoto(name = "portrait.jpg", size = 1024): InspectedUpload {
  const result = inspectUpload({ name, bytes: photoBytes(size) }, "photo");
  if (!result.ok) throw new Error(`fixture photo invalid: ${result.error}`);
  return result.file;
}

/** A complete, publishable record of any category, created straight into the database. */
async function seed(
  category: DocumentCategory,
  top: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
  options: { files?: boolean } = {},
): Promise<DocumentRecord> {
  const spec = CATEGORIES[category];
  const withFiles = options.files ?? true;
  const files: { primary?: InspectedUpload; photo?: InspectedUpload } = {};
  if (withFiles && spec.fileRequired) files.primary = pdfUpload();
  if (withFiles && spec.photoRequired) files.photo = randomPhoto();
  return createDocument(input(category, top, data), files);
}

/** A people record carrying BOTH a portrait and a document file, so two-role behaviour can be exercised. */
async function seedWithBothFiles(): Promise<DocumentRecord> {
  return createDocument(input("program_record"), { primary: pdfUpload("record.pdf"), photo: randomPhoto() });
}

const daysFromToday = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function count(table: string): Promise<number> {
  const result = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return result.rows[0].n;
}

/* ------------------------------------------------------------------ *
 * Schema                                                              *
 * ------------------------------------------------------------------ */

describe("ensureDocumentTables", () => {
  it("is idempotent and safe to run concurrently", async () => {
    resetDocumentTablesCache();
    await Promise.all([ensureDocumentTables(), ensureDocumentTables(), ensureDocumentTables()]);
    await ensureDocumentTables();
    expect(await count("documents")).toBe(0);
  });

  it("creates the three tables and the indexes", async () => {
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(["document_files", "documents", "verification_events"]);

    const indexes = await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'");
    const names = indexes.rows.map((row) => row.indexname);
    for (const expected of [
      "documents_verification_code_uidx",
      "documents_category_status_visibility_idx",
      "documents_issued_on_idx",
      "verification_events_at_idx",
      "verification_events_document_idx",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("does not cache a rejection", async () => {
    let failuresLeft = 1;
    let calls = 0;
    const flaky: SqlClient = (strings, ...values) => {
      calls += 1;
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return Promise.reject(new Error("transient network error"));
      }
      return sql(strings, ...values);
    };
    setSqlClientForTests(flaky);
    resetDocumentTablesCache();
    await expect(ensureDocumentTables()).rejects.toThrow("transient network error");
    await expect(ensureDocumentTables()).resolves.toBeUndefined();
    // once it has succeeded it is cached: no further statements are issued
    const callsAfterSuccess = calls;
    await ensureDocumentTables();
    await ensureDocumentTables();
    expect(calls).toBe(callsAfterSuccess);
  });

  it("issues one statement per call", async () => {
    const seen: string[] = [];
    const recording: SqlClient = (strings, ...values) => {
      seen.push(strings.join("?"));
      return sql(strings, ...values);
    };
    setSqlClientForTests(recording);
    resetDocumentTablesCache();
    await ensureDocumentTables();
    // 3 tables + 5 indexes + the two stamp columns + the view-only column + the reference-number index
    expect(seen.length).toBe(12);
    for (const text of seen) expect(text.trim().replace(/;\s*$/, "")).not.toContain(";");
  });

  it("only stores the five known categories (the SQL list matches the TypeScript list)", async () => {
    for (const spec of CATEGORY_LIST) {
      await db.query("INSERT INTO documents (category, title, visibility) VALUES ($1, 't', 'private')", [spec.key]);
    }
    expect(await count("documents")).toBe(CATEGORY_LIST.length);
    expect(CATEGORY_LIST).toHaveLength(5);
    await expect(db.query("INSERT INTO documents (category, title, visibility) VALUES ('other', 't', 'private')")).rejects.toThrow();
  });

  it("does not allow the retired id_card category on a new install", async () => {
    // Only a database created before the category was removed still carries the wider CHECK, which is harmless
    // because the API validates the category first; there is deliberately no migration (see lib/documents/schema.ts).
    await expect(db.query("INSERT INTO documents (category, title, visibility) VALUES ('id_card', 't', 'private')")).rejects.toThrow(/category/);
    expect(await count("documents")).toBe(0);
  });

  it("rejects values outside the status, visibility and role checks", async () => {
    await expect(db.query("INSERT INTO documents (category, title, visibility, status) VALUES ('certification', 't', 'private', 'live')")).rejects.toThrow();
    await expect(db.query("INSERT INTO documents (category, title, visibility) VALUES ('certification', 't', 'secret')")).rejects.toThrow();
    const created = await seed("certification");
    await expect(
      db.query("INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data) VALUES ($1, 'banner', 'a', 'a', 1, 'a', '\\x00')", [created.id]),
    ).rejects.toThrow();
  });

  it("allows one file per role per document", async () => {
    const created = await seed("certification");
    await expect(
      db.query("INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data) VALUES ($1, 'primary', 'a', 'a', 1, 'a', '\\x00')", [created.id]),
    ).rejects.toThrow();
  });

  it("enforces unique verification codes but allows many records without one", async () => {
    await db.query("INSERT INTO documents (category, title, visibility, verification_code) VALUES ('certification', 'a', 'private', 'ACV-AAAA-AAAA-AAAA')");
    await expect(
      db.query("INSERT INTO documents (category, title, visibility, verification_code) VALUES ('certification', 'b', 'private', 'ACV-AAAA-AAAA-AAAA')"),
    ).rejects.toThrow(/verification_code/);
    await db.query("INSERT INTO documents (category, title, visibility) VALUES ('certification', 'c', 'private')");
    await db.query("INSERT INTO documents (category, title, visibility) VALUES ('certification', 'd', 'private')");
    expect(await count("documents")).toBe(3);
  });
});

/* ------------------------------------------------------------------ *
 * Create / read                                                       *
 * ------------------------------------------------------------------ */

describe("createDocument", () => {
  it.each(CATEGORY_LIST.map((spec) => [spec.key]))("creates a %s record and reads it back", async (category) => {
    const spec = CATEGORIES[category];
    const wanted = input(category);
    const created = await seed(category, { referenceNo: wanted.referenceNo });
    expect(created.id).toMatch(UUID_PATTERN);
    expect(created).toMatchObject({
      category,
      title: wanted.title,
      summary: wanted.summary,
      status: "draft",
      visibility: spec.defaultVisibility,
      allowDownload: false,
      featured: false,
      sortOrder: 0,
      holderName: wanted.holderName,
      referenceNo: wanted.referenceNo,
      issuedOn: wanted.issuedOn,
      expiresOn: wanted.expiresOn,
      revokedAt: null,
      revokedReason: "",
      verifyCount: 0,
      lastVerifiedAt: null,
      publishedAt: null,
    });
    expect(created.data).toEqual(wanted.data);
    expect(created.createdAt).toMatch(ISO_PATTERN);
    expect(created.updatedAt).toMatch(ISO_PATTERN);
    expect(created.verificationCode === null).toBe(!spec.verifiable);
    expect(await getDocument(created.id)).toEqual(created);
  });

  it("issues a verification code when asked, and none when not", async () => {
    const withCode = await seed("certification");
    expect(withCode.verificationCode).toMatch(CODE_PATTERN);
    const without = await seed("certification", { enableVerification: false });
    expect(without.verificationCode).toBeNull();
    const financial = await seed("financial_report");
    expect(financial.verificationCode).toBeNull();
    const forced = await seed("financial_report", { enableVerification: true });
    expect(forced.verificationCode).toMatch(CODE_PATTERN);
  });

  it("gives every record a different code", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 25; i += 1) codes.add((await seed("certification", { title: `Cert ${i}` }, {}, { files: false })).verificationCode ?? "");
    expect(codes.size).toBe(25);
  });

  it("stores files with their metadata and returns the exact bytes", async () => {
    const primary = pdfUpload("Annual Report.pdf", 5000);
    const photo = randomPhoto("face.jpg", 3000);
    const created = await createDocument(input("program_record"), { primary, photo });
    expect(created.files).toHaveLength(2);

    const storedPrimary = created.files.find((file) => file.role === "primary");
    const storedPhoto = created.files.find((file) => file.role === "photo");
    expect(storedPrimary).toMatchObject({
      documentId: created.id,
      filename: "Annual Report.pdf",
      mimeType: "application/pdf",
      sizeBytes: primary.bytes.length,
      sha256: primary.sha256,
    });
    expect(storedPhoto).toMatchObject({ mimeType: "image/jpeg", sizeBytes: photo.bytes.length, sha256: photo.sha256 });
    expect(storedPrimary?.id).toMatch(UUID_PATTERN);
    expect(storedPrimary?.createdAt).toMatch(ISO_PATTERN);

    const fetchedPrimary = await getFile(created.id, "primary");
    const fetchedPhoto = await getFile(created.id, "photo");
    expect(fetchedPrimary?.bytes.equals(primary.bytes)).toBe(true);
    expect(fetchedPhoto?.bytes.equals(photo.bytes)).toBe(true);
    expect(createHash("sha256").update(fetchedPrimary?.bytes ?? Buffer.alloc(0)).digest("hex")).toBe(primary.sha256);
    expect(fetchedPrimary?.meta).toEqual(storedPrimary);
  });

  it("creates with only a photo, or only a document, or no files", async () => {
    const photoOnly = await createDocument(input("program_record"), { photo: randomPhoto() });
    expect(photoOnly.files.map((f) => f.role)).toEqual(["photo"]);
    const docOnly = await createDocument(input("certification"), { primary: pdfUpload() });
    expect(docOnly.files.map((f) => f.role)).toEqual(["primary"]);
    const none = await createDocument(input("certification"));
    expect(none.files).toEqual([]);
  });

  it("writes the document and its files in one statement (so they are atomic)", async () => {
    const seen: string[] = [];
    const recording: SqlClient = (strings, ...values) => {
      seen.push(strings.join("?"));
      return sql(strings, ...values);
    };
    setSqlClientForTests(recording);
    await createDocument(input("certification"), { primary: pdfUpload() });
    const inserts = seen.filter((text) => text.includes("INSERT INTO documents"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toContain("INSERT INTO document_files");
  });

  it("stores nothing when the document cannot be created", async () => {
    const bad = { ...input("certification"), category: "not_a_category" as DocumentCategory };
    await expect(createDocument(bad, { primary: pdfUpload() })).rejects.toThrow();
    expect(await count("documents")).toBe(0);
    expect(await count("document_files")).toBe(0);
  });

  it("sets publishedAt only for published records", async () => {
    const draft = await seed("certification");
    expect(draft.publishedAt).toBeNull();
    const published = await seed("certification", { status: "published" });
    expect(published.status).toBe("published");
    expect(published.publishedAt).toMatch(ISO_PATTERN);
  });

  it("refuses to create a published record that is not publishable, and stores nothing", async () => {
    const error = await createDocument(input("certification", { status: "published" })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublishBlockedError);
    expect((error as PublishBlockedError).errors.file).toMatch(/Upload/);
    expect(await count("documents")).toBe(0);
  });

  it("refuses to publish without a photo when the category requires one", async () => {
    // No shipped category requires a photo, so the requirement is switched on for one category here.
    const undo = requirePhoto("program_record");
    try {
      const error = await createDocument(input("program_record", { status: "published" })).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PublishBlockedError);
      expect((error as PublishBlockedError).errors.photo).toBeTruthy();
      expect(await count("documents")).toBe(0);
      const ok = await createDocument(input("program_record", { status: "published" }), { photo: randomPhoto() });
      expect(ok.status).toBe("published");
    } finally {
      undo();
    }
  });

  it("publishes a people record without a photo, because its category does not require one", async () => {
    expect(CATEGORIES.program_record.photoRequired).toBe(false);
    const published = await createDocument(input("program_record", { status: "published" }));
    expect(published.status).toBe("published");
    expect(published.files).toEqual([]);
  });

  it("round-trips data of every shape, unicode included", async () => {
    const created = await createDocument(
      input("certification", { title: "Sécurité 安全 😀", summary: "Line one\n\nLine two" }, { skills: ["a", "b"], level: "Distinction", credential_url: "https://example.com/x?y=1&z=2" }),
    );
    expect(created.title).toBe("Sécurité 安全 😀");
    expect(created.summary).toBe("Line one\n\nLine two");
    expect(created.data.skills).toEqual(["a", "b"]);
    expect(created.data.credential_url).toBe("https://example.com/x?y=1&z=2");
  });

  it("returns dates exactly as written, never shifted by a time zone", async () => {
    const created = await createDocument(input("certification", { issuedOn: "2026-01-01", expiresOn: "2026-12-31" }));
    expect(created.issuedOn).toBe("2026-01-01");
    expect(created.expiresOn).toBe("2026-12-31");
    const edge = await createDocument(input("certification", { issuedOn: "2024-02-29", expiresOn: "2024-03-01" }));
    expect(edge.issuedOn).toBe("2024-02-29");
    expect(edge.expiresOn).toBe("2024-03-01");
  });

  it("treats hostile text as data, never as SQL", async () => {
    const title = "Robert'); DROP TABLE documents;--";
    const created = await createDocument(input("certification", { title, holderName: "\" OR 1=1 --" }));
    expect(created.title).toBe(title);
    expect(await count("documents")).toBe(1);
  });

  it("refuses a file whose type the slot does not allow", async () => {
    const png = inspectUpload({ name: "a.png", bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]) }, "primary");
    if (!png.ok) throw new Error("fixture");
    const asPdf: InspectedUpload = { ...png.file, mimeType: "application/zip" };
    await expect(createDocument(input("certification"), { primary: asPdf })).rejects.toThrow(/may not be/);
    expect(await count("documents")).toBe(0);
  });
});

describe("getDocument / getDocumentByCode", () => {
  it("returns null for malformed ids instead of throwing", async () => {
    for (const bad of ["", "nope", "123", "' OR 1=1 --", "../../etc", "99999999-9999-4999-8999-99999999999g", "x".repeat(500)]) {
      await expect(getDocument(bad)).resolves.toBeNull();
    }
    await expect(getDocument(undefined as unknown as string)).resolves.toBeNull();
    await expect(getDocument(MISSING_ID)).resolves.toBeNull();
  });

  it("finds a record by any spelling of its code", async () => {
    const created = await seed("certification");
    const code = created.verificationCode ?? "";
    for (const spelling of [code, code.toLowerCase(), code.replace(/-/g, ""), code.replace(/-/g, " ")]) {
      expect((await getDocumentByCode(spelling))?.id).toBe(created.id);
    }
  });

  it("returns null for unknown or malformed codes", async () => {
    await seed("certification");
    expect(await getDocumentByCode("ACV-0000-0000-0000")).toBeNull();
    expect(await getDocumentByCode("garbage")).toBeNull();
    expect(await getDocumentByCode("")).toBeNull();
  });

  it("never returns file bytes on a record", async () => {
    const created = await seed("certification");
    expect(JSON.stringify(created)).not.toMatch(/data_hex|"data":\{"type"/);
    for (const file of created.files) expect(Object.keys(file).sort()).toEqual(["createdAt", "documentId", "filename", "id", "mimeType", "role", "sha256", "sizeBytes", "stamp"]);
  });
});

/* ------------------------------------------------------------------ *
 * Update                                                              *
 * ------------------------------------------------------------------ */

describe("updateDocument", () => {
  it("changes the fields and moves updatedAt forward, leaving createdAt alone", async () => {
    const created = await seed("certification");
    const updated = await updateDocument(created.id, input("certification", { title: "Renamed", featured: true, sortOrder: 4 }, { level: "Advanced" }));
    expect(updated).toMatchObject({ id: created.id, title: "Renamed", featured: true, sortOrder: 4, createdAt: created.createdAt });
    expect(updated?.data.level).toBe("Advanced");
    expect(Date.parse(updated?.updatedAt ?? "")).toBeGreaterThan(Date.parse(created.updatedAt));
  });

  it("strictly increases updatedAt on every save, even back to back", async () => {
    let current = await seed("certification");
    for (let i = 0; i < 5; i += 1) {
      const next = await updateDocument(current.id, input("certification", { title: `Save ${i}` }));
      expect(Date.parse(next?.updatedAt ?? "")).toBeGreaterThan(Date.parse(current.updatedAt));
      current = next as DocumentRecord;
    }
  });

  it("returns null for an unknown or malformed id", async () => {
    expect(await updateDocument(MISSING_ID, input("certification"))).toBeNull();
    expect(await updateDocument("not-an-id", input("certification"))).toBeNull();
  });

  it("clears fields that were emptied", async () => {
    const created = await seed("certification", { expiresOn: "2030-01-01" }, { level: "Gold" });
    const updated = await updateDocument(created.id, input("certification", { expiresOn: null, summary: "" }, { level: "" }));
    expect(updated?.expiresOn).toBeNull();
    expect(updated?.data).not.toHaveProperty("level");
  });

  it("cannot change the category", async () => {
    const created = await seed("certification");
    await expect(updateDocument(created.id, input("company_identity"))).rejects.toBeInstanceOf(DocumentCategoryChangeError);
    expect((await getDocument(created.id))?.category).toBe("certification");
  });

  describe("files", () => {
    it("keeps files when none are mentioned", async () => {
      const created = await seedWithBothFiles();
      const updated = await updateDocument(created.id, input("program_record", { title: "New title" }));
      expect(updated?.files).toHaveLength(2);
      expect(updated?.files.map((file) => file.sha256).sort()).toEqual(created.files.map((file) => file.sha256).sort());
    });

    it("keeps files when the options are explicitly undefined", async () => {
      const created = await seedWithBothFiles();
      const updated = await updateDocument(created.id, input("program_record"), { files: { primary: undefined, photo: undefined } });
      expect(updated?.files).toHaveLength(2);
    });

    it("replaces a file, with new bytes, hash and name, leaving one row per role", async () => {
      const created = await seed("certification");
      const before = created.files[0];
      const replacement = pdfUpload("Updated.pdf", 777);
      const updated = await updateDocument(created.id, input("certification"), { files: { primary: replacement } });
      expect(updated?.files).toHaveLength(1);
      expect(updated?.files[0]).toMatchObject({ filename: "Updated.pdf", sha256: replacement.sha256, sizeBytes: replacement.bytes.length });
      expect(updated?.files[0].sha256).not.toBe(before.sha256);
      expect((await getFile(created.id, "primary"))?.bytes.equals(replacement.bytes)).toBe(true);
      expect(await count("document_files")).toBe(1);
    });

    it("replaces one role without touching the other", async () => {
      const created = await seedWithBothFiles();
      const primaryBefore = created.files.find((f) => f.role === "primary");
      const newPhoto = randomPhoto("new.jpg", 500);
      const updated = await updateDocument(created.id, input("program_record"), { files: { photo: newPhoto } });
      expect(updated?.files.find((f) => f.role === "photo")?.sha256).toBe(newPhoto.sha256);
      expect(updated?.files.find((f) => f.role === "primary")?.sha256).toBe(primaryBefore?.sha256);
    });

    it("adds a file to a record that had none", async () => {
      const created = await seed("certification", {}, {}, { files: false });
      expect(created.files).toEqual([]);
      const updated = await updateDocument(created.id, input("certification"), { files: { primary: pdfUpload() } });
      expect(updated?.files).toHaveLength(1);
    });

    it("removes a file when given null", async () => {
      const created = await seedWithBothFiles();
      const updated = await updateDocument(created.id, input("program_record"), { files: { primary: null } });
      expect(updated?.files.map((f) => f.role)).toEqual(["photo"]);
      expect(await getFile(created.id, "primary")).toBeNull();
      expect(await getFile(created.id, "photo")).not.toBeNull();
    });

    it("removes and replaces in the same save", async () => {
      const created = await seedWithBothFiles();
      const replacement = pdfUpload("fresh.pdf");
      const updated = await updateDocument(created.id, input("program_record"), { files: { primary: replacement, photo: null } });
      expect(updated?.files.map((f) => f.role)).toEqual(["primary"]);
      expect(updated?.files[0].filename).toBe("fresh.pdf");
    });

    it("removing a file that does not exist is harmless", async () => {
      const created = await seed("certification", {}, {}, { files: false });
      const updated = await updateDocument(created.id, input("certification"), { files: { primary: null, photo: null } });
      expect(updated?.files).toEqual([]);
    });

    it("rejects a mistyped upload without changing anything", async () => {
      const created = await seed("certification");
      const bogus: InspectedUpload = { ...pdfUpload(), mimeType: "text/html" };
      await expect(updateDocument(created.id, input("certification", { title: "Should not stick" }), { files: { primary: bogus } })).rejects.toThrow();
      const after = await getDocument(created.id);
      expect(after?.title).toBe(created.title);
      expect(after?.files[0].sha256).toBe(created.files[0].sha256);
    });
  });

  describe("optimistic concurrency", () => {
    it("accepts a save made against the current version", async () => {
      const created = await seed("certification");
      const updated = await updateDocument(created.id, input("certification", { title: "Mine" }), { expectedUpdatedAt: created.updatedAt });
      expect(updated?.title).toBe("Mine");
    });

    it("refuses a stale save and changes nothing", async () => {
      const created = await seed("certification");
      await updateDocument(created.id, input("certification", { title: "First editor" }), { expectedUpdatedAt: created.updatedAt });
      await expect(
        updateDocument(created.id, input("certification", { title: "Second editor" }), { expectedUpdatedAt: created.updatedAt }),
      ).rejects.toBeInstanceOf(StaleDocumentError);
      expect((await getDocument(created.id))?.title).toBe("First editor");
    });

    it("a stale save does not apply its file changes either", async () => {
      const created = await seed("certification");
      const current = await updateDocument(created.id, input("certification"));
      await expect(
        updateDocument(created.id, input("certification"), { files: { primary: null }, expectedUpdatedAt: created.updatedAt }),
      ).rejects.toBeInstanceOf(StaleDocumentError);
      const after = await getDocument(created.id);
      expect(after?.files).toHaveLength(1);
      expect(after?.updatedAt).toBe(current?.updatedAt);
    });

    it("lets the second editor retry with the fresh token", async () => {
      const created = await seed("certification");
      const first = await updateDocument(created.id, input("certification", { title: "A" }), { expectedUpdatedAt: created.updatedAt });
      const second = await updateDocument(created.id, input("certification", { title: "B" }), { expectedUpdatedAt: first?.updatedAt });
      expect(second?.title).toBe("B");
    });

    it("treats an unparseable token as stale", async () => {
      const created = await seed("certification");
      for (const token of ["garbage", "'; DROP TABLE documents;--", "2026-99-99"]) {
        await expect(updateDocument(created.id, input("certification"), { expectedUpdatedAt: token })).rejects.toBeInstanceOf(StaleDocumentError);
      }
      expect(await count("documents")).toBe(1);
    });

    it("answers null, not stale, when the record is gone", async () => {
      const created = await seed("certification");
      await deleteDocument(created.id);
      expect(await updateDocument(created.id, input("certification"), { expectedUpdatedAt: created.updatedAt })).toBeNull();
    });

    it("public lookups do not invalidate an open editor", async () => {
      const created = await seed("certification", { status: "published", visibility: "unlisted" });
      await lookupVerification(created.verificationCode ?? "");
      const saved = await updateDocument(created.id, input("certification", { title: "Edited while people scan" }), { expectedUpdatedAt: created.updatedAt });
      expect(saved?.title).toBe("Edited while people scan");
    });
  });

  describe("verification codes", () => {
    it("adds a code when verification is switched on", async () => {
      const created = await seed("financial_report");
      expect(created.verificationCode).toBeNull();
      const updated = await updateDocument(created.id, input("financial_report", { enableVerification: true }));
      expect(updated?.verificationCode).toMatch(CODE_PATTERN);
    });

    it("never removes or changes a code that was issued", async () => {
      const created = await seed("certification");
      const code = created.verificationCode;
      expect(code).toMatch(CODE_PATTERN);
      const off = await updateDocument(created.id, input("certification", { enableVerification: false }));
      expect(off?.verificationCode).toBe(code);
      const on = await updateDocument(created.id, input("certification", { enableVerification: true }));
      expect(on?.verificationCode).toBe(code);
    });
  });

  describe("publishing through a save", () => {
    it("is blocked while the required file is missing", async () => {
      const created = await seed("certification", {}, {}, { files: false });
      const error = await updateDocument(created.id, input("certification", { status: "published" })).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PublishBlockedError);
      expect((await getDocument(created.id))?.status).toBe("draft");
    });

    it("is allowed when the same save supplies the file", async () => {
      const created = await seed("certification", {}, {}, { files: false });
      const updated = await updateDocument(created.id, input("certification", { status: "published" }), { files: { primary: pdfUpload() } });
      expect(updated?.status).toBe("published");
      expect(updated?.publishedAt).toMatch(ISO_PATTERN);
    });

    it("is blocked when the same save removes the file", async () => {
      const created = await seed("certification", { status: "published" });
      const error = await updateDocument(created.id, input("certification", { status: "published" }), { files: { primary: null } }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PublishBlockedError);
      expect((await getDocument(created.id))?.files).toHaveLength(1);
    });

    it("keeps the original publication time across unpublish and republish", async () => {
      const created = await seed("certification", { status: "published" });
      const drafted = await updateDocument(created.id, input("certification", { status: "draft" }));
      expect(drafted?.publishedAt).toBe(created.publishedAt);
      const again = await updateDocument(created.id, input("certification", { status: "published" }));
      expect(again?.publishedAt).toBe(created.publishedAt);
    });

    it("sets publishedAt the first time a draft is published", async () => {
      const created = await seed("certification");
      expect(created.publishedAt).toBeNull();
      const published = await updateDocument(created.id, input("certification", { status: "published" }));
      expect(published?.publishedAt).toMatch(ISO_PATTERN);
    });
  });
});

/* ------------------------------------------------------------------ *
 * Workflow actions                                                    *
 * ------------------------------------------------------------------ */

describe("setDocumentStatus", () => {
  it("publishes a complete record", async () => {
    const created = await seed("certification");
    const published = await setDocumentStatus(created.id, "published");
    expect(published?.status).toBe("published");
    expect(published?.publishedAt).toMatch(ISO_PATTERN);
    expect(Date.parse(published?.updatedAt ?? "")).toBeGreaterThan(Date.parse(created.updatedAt));
  });

  it("refuses to publish an incomplete record and says why", async () => {
    const created = await seed("certification", {}, {}, { files: false });
    const error = await setDocumentStatus(created.id, "published").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublishBlockedError);
    expect((error as PublishBlockedError).errors).toHaveProperty("file");
    expect((await getDocument(created.id))?.status).toBe("draft");
  });

  it("refuses to publish a public person who has not consented (even if the row was edited around the validator)", async () => {
    const created = await seed("program_record", { visibility: "unlisted" });
    await db.query("UPDATE documents SET visibility = 'public' WHERE id = $1", [created.id]);
    const error = await setDocumentStatus(created.id, "published").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublishBlockedError);
    expect((error as PublishBlockedError).errors.visibility).toMatch(/consent/i);
  });

  it("archives and drafts without the publish checks", async () => {
    const created = await seed("certification", {}, {}, { files: false });
    expect((await setDocumentStatus(created.id, "archived"))?.status).toBe("archived");
    expect((await setDocumentStatus(created.id, "draft"))?.status).toBe("draft");
  });

  it("is idempotent and keeps the first publication time", async () => {
    const created = await seed("certification");
    const first = await setDocumentStatus(created.id, "published");
    const second = await setDocumentStatus(created.id, "published");
    expect(second?.publishedAt).toBe(first?.publishedAt);
  });

  it("returns null for unknown ids and throws for unknown statuses", async () => {
    expect(await setDocumentStatus(MISSING_ID, "published")).toBeNull();
    expect(await setDocumentStatus("nope", "published")).toBeNull();
    const created = await seed("certification");
    await expect(setDocumentStatus(created.id, "live" as never)).rejects.toThrow();
  });
});

describe("revokeDocument / reinstateDocument", () => {
  it("revokes with a reason and reinstates", async () => {
    const created = await seed("certification", { status: "published", visibility: "unlisted" });
    const revoked = await revokeDocument(created.id, "  Issued   in error  ");
    expect(revoked?.revokedAt).toMatch(ISO_PATTERN);
    expect(revoked?.revokedReason).toBe("Issued in error");

    const back = await reinstateDocument(created.id);
    expect(back?.revokedAt).toBeNull();
    expect(back?.revokedReason).toBe("");
  });

  it("keeps the original revocation time when revoked again, but updates the reason", async () => {
    const created = await seed("certification");
    const first = await revokeDocument(created.id, "first");
    const second = await revokeDocument(created.id, "second");
    expect(second?.revokedAt).toBe(first?.revokedAt);
    expect(second?.revokedReason).toBe("second");
  });

  it("caps and cleans the reason", async () => {
    const created = await seed("certification");
    const long = await revokeDocument(created.id, "x".repeat(2000));
    expect(long?.revokedReason).toHaveLength(500);
    const dirty = await revokeDocument(created.id, `bad${String.fromCharCode(0)}reason${String.fromCharCode(0x200b)}`);
    expect(dirty?.revokedReason).toBe("badreason");
    const empty = await revokeDocument(created.id, "");
    expect(empty?.revokedAt).not.toBeNull();
  });

  it("moves updatedAt", async () => {
    const created = await seed("certification");
    const revoked = await revokeDocument(created.id, "r");
    expect(Date.parse(revoked?.updatedAt ?? "")).toBeGreaterThan(Date.parse(created.updatedAt));
  });

  it("returns null for unknown ids", async () => {
    expect(await revokeDocument(MISSING_ID, "r")).toBeNull();
    expect(await reinstateDocument(MISSING_ID)).toBeNull();
    expect(await revokeDocument("bad", "r")).toBeNull();
    expect(await reinstateDocument("bad")).toBeNull();
  });

  it("changes what a lookup reports", async () => {
    const created = await seed("certification", { status: "published", visibility: "unlisted" });
    const code = created.verificationCode ?? "";
    expect((await lookupVerification(code)).state).toBe("valid");
    await revokeDocument(created.id, "Withdrawn");
    const revoked = await lookupVerification(code);
    expect(revoked.state).toBe("revoked");
    expect(revoked.document?.holderName).toBe("");
    expect(JSON.stringify(revoked)).not.toContain("Withdrawn");
    await reinstateDocument(created.id);
    expect((await lookupVerification(code)).state).toBe("valid");
  });
});

describe("regenerateVerificationCode", () => {
  it("replaces the code and the old one stops working at once", async () => {
    const created = await seed("certification", { status: "published", visibility: "unlisted" });
    const oldCode = created.verificationCode ?? "";
    expect((await lookupVerification(oldCode)).state).toBe("valid");

    const updated = await regenerateVerificationCode(created.id);
    expect(updated?.verificationCode).toMatch(CODE_PATTERN);
    expect(updated?.verificationCode).not.toBe(oldCode);

    expect((await lookupVerification(oldCode)).state).toBe("not_found");
    expect((await lookupVerification(updated?.verificationCode ?? "")).state).toBe("valid");
    expect(await getDocumentByCode(oldCode)).toBeNull();
  });

  it("issues a first code to a record that had none", async () => {
    const created = await seed("financial_report");
    expect(created.verificationCode).toBeNull();
    expect((await regenerateVerificationCode(created.id))?.verificationCode).toMatch(CODE_PATTERN);
  });

  it("returns null for unknown ids", async () => {
    expect(await regenerateVerificationCode(MISSING_ID)).toBeNull();
    expect(await regenerateVerificationCode("bad")).toBeNull();
  });
});

describe("duplicateDocument", () => {
  it("copies the record into a new draft with a new code and no reference number", async () => {
    const source = await seed("certification", { status: "published", featured: true, allowDownload: true, sortOrder: 3, expiresOn: "2030-01-01" }, { level: "Gold" });
    const copy = await duplicateDocument(source.id);
    expect(copy).not.toBeNull();
    if (!copy) return;

    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe(`${source.title} (copy)`);
    expect(copy.status).toBe("draft");
    expect(copy.publishedAt).toBeNull();
    expect(copy.referenceNo).toBe("");
    expect(copy.featured).toBe(false);
    expect(copy.verificationCode).toMatch(CODE_PATTERN);
    expect(copy.verificationCode).not.toBe(source.verificationCode);
    expect(copy.verifyCount).toBe(0);
    expect(copy.revokedAt).toBeNull();
    expect(copy).toMatchObject({
      category: source.category,
      summary: source.summary,
      visibility: source.visibility,
      allowDownload: true,
      sortOrder: 3,
      holderName: source.holderName,
      issuedOn: source.issuedOn,
      expiresOn: "2030-01-01",
    });
    expect(copy.data).toEqual(source.data);
  });

  it("copies the files byte for byte, as independent rows", async () => {
    const source = await seedWithBothFiles();
    const copy = await duplicateDocument(source.id);
    expect(copy?.files).toHaveLength(2);
    for (const role of ["primary", "photo"] as const) {
      const original = await getFile(source.id, role);
      const duplicated = await getFile(copy?.id ?? "", role);
      if (role === "primary" && !original) continue;
      expect(duplicated?.bytes.equals(original?.bytes ?? Buffer.alloc(0))).toBe(true);
      expect(duplicated?.meta.id).not.toBe(original?.meta.id);
    }
    // deleting the copy leaves the original's files intact
    await deleteDocument(copy?.id ?? "");
    expect(await getFile(source.id, "photo")).not.toBeNull();
  });

  it("does not give a code to a copy of a record that had none", async () => {
    const source = await seed("financial_report");
    expect((await duplicateDocument(source.id))?.verificationCode).toBeNull();
  });

  it("leaves the original untouched", async () => {
    const source = await seed("certification", { status: "published" });
    await duplicateDocument(source.id);
    expect(await getDocument(source.id)).toEqual(source);
  });

  it("does not carry a person's consent over to the copy, and un-lists it", async () => {
    const source = await seed("program_record", { status: "published", visibility: "public" }, { consent_to_publish: true });
    expect(source.visibility).toBe("public");
    const copy = await duplicateDocument(source.id);
    expect(copy?.data).not.toHaveProperty("consent_to_publish");
    expect(copy?.visibility).toBe("unlisted");
    expect(copy?.status).toBe("draft");
  });

  it("keeps an organisation's public visibility", async () => {
    const source = await seed("certification", { visibility: "public" });
    expect((await duplicateDocument(source.id))?.visibility).toBe("public");
  });

  it("truncates a very long title to leave room for the suffix", async () => {
    const source = await seed("certification", { title: "T".repeat(200) });
    const copy = await duplicateDocument(source.id);
    expect(copy?.title).toHaveLength(200);
    expect(copy?.title.endsWith(" (copy)")).toBe(true);
  });

  it("can be repeated", async () => {
    const source = await seed("certification");
    const first = await duplicateDocument(source.id);
    const second = await duplicateDocument(source.id);
    expect(first?.id).not.toBe(second?.id);
    expect(first?.verificationCode).not.toBe(second?.verificationCode);
  });

  it("returns null for unknown ids", async () => {
    expect(await duplicateDocument(MISSING_ID)).toBeNull();
    expect(await duplicateDocument("bad")).toBeNull();
  });
});

describe("deleteDocument", () => {
  it("deletes the record and cascades to its files", async () => {
    const created = await seedWithBothFiles();
    expect(await count("document_files")).toBe(2);
    expect(await deleteDocument(created.id)).toBe(true);
    expect(await getDocument(created.id)).toBeNull();
    expect(await count("documents")).toBe(0);
    expect(await count("document_files")).toBe(0);
    expect(await getFile(created.id, "photo")).toBeNull();
  });

  it("only deletes the one record", async () => {
    const keep = await seed("certification");
    const drop = await seed("certification", { title: "Drop me" });
    await deleteDocument(drop.id);
    expect(await getDocument(keep.id)).not.toBeNull();
    expect(await count("document_files")).toBe(1);
  });

  it("reports false when there was nothing to delete", async () => {
    expect(await deleteDocument(MISSING_ID)).toBe(false);
    expect(await deleteDocument("bad")).toBe(false);
    const created = await seed("certification");
    expect(await deleteDocument(created.id)).toBe(true);
    expect(await deleteDocument(created.id)).toBe(false);
  });

  it("keeps past lookups as anonymous events", async () => {
    const created = await seed("certification", { status: "published", visibility: "unlisted" });
    await lookupVerification(created.verificationCode ?? "");
    await deleteDocument(created.id);
    const { events, total } = await listVerificationEvents();
    expect(total).toBe(1);
    expect(events[0]).toMatchObject({ documentId: null, documentTitle: null, category: null });
  });
});

/* ------------------------------------------------------------------ *
 * Files                                                               *
 * ------------------------------------------------------------------ */

describe("getFile", () => {
  it("returns null for unknown documents, missing roles and bad input", async () => {
    const created = await seed("certification");
    expect(await getFile(MISSING_ID, "primary")).toBeNull();
    expect(await getFile(created.id, "photo")).toBeNull();
    expect(await getFile("bad", "primary")).toBeNull();
    expect(await getFile(created.id, "banner" as never)).toBeNull();
  });

  it("round-trips every byte value exactly", async () => {
    const everyByte = Buffer.from(Array.from({ length: 256 * 8 }, (_, i) => i % 256));
    const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), everyByte, Buffer.alloc(300, 0)]);
    const photo = inspectUpload({ name: "all-bytes.jpg", bytes }, "photo");
    if (!photo.ok) throw new Error(photo.error);
    const created = await createDocument(input("program_record"), { photo: photo.file });
    const fetched = await getFile(created.id, "photo");
    expect(fetched?.bytes.equals(bytes)).toBe(true);
    expect(createHash("sha256").update(fetched?.bytes ?? Buffer.alloc(0)).digest("hex")).toBe(photo.file.sha256);
  });

  it("stores a file of the maximum primary size", async () => {
    const size = 4_000_000;
    const bytes = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(size - 9 - 7, 0x41), Buffer.from("\n%%EOF\n")]);
    expect(bytes.length).toBe(size);
    const upload = inspectUpload({ name: "big.pdf", bytes }, "primary");
    if (!upload.ok) throw new Error(upload.error);
    const created = await createDocument(input("certification"), { primary: upload.file });
    expect(created.files[0].sizeBytes).toBe(size);
    const fetched = await getFile(created.id, "primary");
    expect(fetched?.bytes.length).toBe(size);
    expect(createHash("sha256").update(fetched?.bytes ?? Buffer.alloc(0)).digest("hex")).toBe(upload.file.sha256);
  }, 60_000);

  it("refuses to serve bytes that fail their integrity check", async () => {
    const created = await seed("certification");
    await db.query("UPDATE document_files SET sha256 = $1 WHERE document_id = $2", ["0".repeat(64), created.id]);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await getFile(created.id, "primary")).toBeNull();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(created.id);
  });
});

/* ------------------------------------------------------------------ *
 * Lists                                                               *
 * ------------------------------------------------------------------ */

describe("listDocuments", () => {
  async function seedMany() {
    const cert = await seed("certification", { title: "Alpha Certificate", holderName: "Zed Zebra", referenceNo: "REF-111", issuedOn: "2026-01-01" });
    const intern = await seed("program_record", { title: "Beta Intern", holderName: "Yara Young", referenceNo: "REF-222", issuedOn: "2026-03-01", status: "published" });
    const letter = await seed("experience_letter", { title: "Gamma Letter", holderName: "Xavier Xu", referenceNo: "REF-333", issuedOn: "2025-12-01" });
    const report = await seed("financial_report", { title: "Delta Report", issuedOn: "2026-02-01", visibility: "public", status: "published" });
    // Unlisted and draft, with a code and an expiry date: the one record that is neither public nor published.
    const identity = await seed("company_identity", {
      title: "Epsilon Registration",
      holderName: "Wendy West",
      referenceNo: "REF-555",
      issuedOn: "2026-04-01",
      expiresOn: daysFromToday(20),
      visibility: "unlisted",
      enableVerification: true,
    });
    return { cert, intern, letter, report, identity };
  }

  it("lists everything by default, newest edit first, with a total", async () => {
    const all = await seedMany();
    const { items, total } = await listDocuments();
    expect(total).toBe(5);
    expect(items).toHaveLength(5);
    expect(items[0].id).toBe(all.identity.id);
  });

  it("returns an empty page when there is nothing", async () => {
    expect(await listDocuments()).toEqual({ items: [], total: 0 });
  });

  it("lists every category for a stale link to the retired ID card slug or key, exactly as with no category", async () => {
    // What /admin/documents?category=ids runs: the URL parser drops the unknown category, so nothing narrows the list.
    await seedMany();
    const unfiltered = await listDocuments(toListFilters(parseListQuery({}), EXPIRING_SOON_DAYS));
    expect(unfiltered.total).toBe(5);
    for (const category of ["ids", "id_card"]) {
      const stale = await listDocuments(toListFilters(parseListQuery({ category }), EXPIRING_SOON_DAYS));
      expect(stale.total, category).toBe(5);
      expect(stale.items.map((d) => d.id), category).toEqual(unfiltered.items.map((d) => d.id));
    }
    // A real slug still narrows, so the fallback is specific to the retired one.
    const narrowed = await listDocuments(toListFilters(parseListQuery({ category: "certifications" }), EXPIRING_SOON_DAYS));
    expect(narrowed.items.map((d) => d.title)).toEqual(["Alpha Certificate"]);
  });

  it("filters by category, status, visibility and verifiability", async () => {
    const all = await seedMany();
    expect((await listDocuments({ category: "certification" })).items.map((d) => d.id)).toEqual([all.cert.id]);
    expect((await listDocuments({ status: "published" })).total).toBe(2);
    expect((await listDocuments({ status: "archived" })).total).toBe(0);
    expect((await listDocuments({ visibility: "public" })).items.map((d) => d.id).sort()).toEqual([all.cert.id, all.report.id].sort());
    expect((await listDocuments({ verifiable: true })).total).toBe(4);
    expect((await listDocuments({ verifiable: false })).items.map((d) => d.id)).toEqual([all.report.id]);
  });

  it("combines filters", async () => {
    const all = await seedMany();
    const result = await listDocuments({ status: "published", visibility: "public", category: "financial_report" });
    expect(result.items.map((d) => d.id)).toEqual([all.report.id]);
    expect((await listDocuments({ status: "published", category: "certification" })).total).toBe(0);
  });

  it("finds records expiring soon", async () => {
    const all = await seedMany();
    await seed("certification", { title: "Far Certificate", referenceNo: "REF-FAR", expiresOn: daysFromToday(400), visibility: "unlisted" });
    await seed("certification", { title: "Expired Certificate", referenceNo: "REF-OLD", issuedOn: "2020-01-01", expiresOn: "2021-01-01", visibility: "unlisted" });
    const soon = await listDocuments({ expiringWithinDays: 30 });
    expect(soon.items.map((d) => d.id)).toEqual([all.identity.id]);
    expect((await listDocuments({ expiringWithinDays: 10 })).total).toBe(0);
    expect((await listDocuments({ expiringWithinDays: 500 })).total).toBe(2);
  });

  it("leaves revoked and archived records out of the expiring list", async () => {
    const one = await seed("certification", { title: "Revoked soon", referenceNo: "A", expiresOn: daysFromToday(5) });
    const two = await seed("certification", { title: "Archived soon", referenceNo: "B", expiresOn: daysFromToday(5) });
    await revokeDocument(one.id, "x");
    await setDocumentStatus(two.id, "archived");
    expect((await listDocuments({ expiringWithinDays: 30 })).total).toBe(0);
  });

  describe("search", () => {
    it("matches title, holder, reference and verification code, case-insensitively", async () => {
      const all = await seedMany();
      expect((await listDocuments({ q: "alpha" })).items.map((d) => d.id)).toEqual([all.cert.id]);
      expect((await listDocuments({ q: "YARA" })).items.map((d) => d.id)).toEqual([all.intern.id]);
      expect((await listDocuments({ q: "ref-333" })).items.map((d) => d.id)).toEqual([all.letter.id]);
      const code = all.cert.verificationCode ?? "";
      expect((await listDocuments({ q: code })).items.map((d) => d.id)).toEqual([all.cert.id]);
      expect((await listDocuments({ q: code.toLowerCase() })).items.map((d) => d.id)).toEqual([all.cert.id]);
      expect((await listDocuments({ q: code.slice(4, 9) })).items.map((d) => d.id)).toContain(all.cert.id);
    });

    it("finds a code typed without hyphens", async () => {
      const all = await seedMany();
      const bare = (all.cert.verificationCode ?? "").replace(/-/g, "");
      expect((await listDocuments({ q: bare })).items.map((d) => d.id)).toEqual([all.cert.id]);
    });

    it("matches partial words", async () => {
      await seedMany();
      expect((await listDocuments({ q: "ertific" })).total).toBe(1);
    });

    it("ignores blank queries", async () => {
      await seedMany();
      expect((await listDocuments({ q: "   " })).total).toBe(5);
      expect((await listDocuments({ q: "" })).total).toBe(5);
    });

    it("treats % and _ as ordinary characters", async () => {
      const percent = await seed("certification", { title: "100% pure", referenceNo: "P1" });
      const underscore = await seed("certification", { title: "a_b", referenceNo: "P2" });
      await seed("certification", { title: "ab", referenceNo: "P3" });
      const exclaim = await seed("certification", { title: "Wow! Great", referenceNo: "P4" });
      const backslash = await seed("certification", { title: "back\\slash", referenceNo: "P5" });

      expect((await listDocuments({ q: "%" })).items.map((d) => d.id)).toEqual([percent.id]);
      expect((await listDocuments({ q: "_" })).items.map((d) => d.id)).toEqual([underscore.id]);
      expect((await listDocuments({ q: "a_b" })).items.map((d) => d.id)).toEqual([underscore.id]);
      expect((await listDocuments({ q: "!" })).items.map((d) => d.id)).toEqual([exclaim.id]);
      expect((await listDocuments({ q: "!%" })).total).toBe(0);
      expect((await listDocuments({ q: "\\" })).items.map((d) => d.id)).toEqual([backslash.id]);
      expect((await listDocuments({ q: "a%b" })).total).toBe(0);
      expect((await listDocuments({ q: "%%" })).total).toBe(0);
    });

    it("is not an injection vector", async () => {
      await seedMany();
      for (const hostile of ["'; DROP TABLE documents;--", "' OR '1'='1", "\") OR (1=1", "%' OR 1=1 --"]) {
        const result = await listDocuments({ q: hostile });
        expect(result.total).toBe(0);
      }
      expect(await count("documents")).toBe(5);
    });

    it("caps the length of the query", async () => {
      await seedMany();
      expect((await listDocuments({ q: "a".repeat(10_000) })).total).toBe(0);
    });

    it("escapeLikePattern escapes the wildcards and its own escape character", () => {
      expect(escapeLikePattern("50%_off!")).toBe("50!%!_off!!");
      expect(escapeLikePattern("plain")).toBe("plain");
    });
  });

  describe("sorting", () => {
    it("sorts by title ascending, case-insensitively", async () => {
      await seed("certification", { title: "banana", referenceNo: "1" });
      await seed("certification", { title: "Apple", referenceNo: "2" });
      await seed("certification", { title: "cherry", referenceNo: "3" });
      expect((await listDocuments({ sort: "title" })).items.map((d) => d.title)).toEqual(["Apple", "banana", "cherry"]);
    });

    it("sorts by issue date, newest first, undated last", async () => {
      await seed("certification", { title: "old", issuedOn: "2020-01-01", referenceNo: "1" });
      await seed("certification", { title: "new", issuedOn: "2026-06-01", referenceNo: "2" });
      await seed("company_identity", { title: "undated" });
      expect((await listDocuments({ sort: "issued" })).items.map((d) => d.title)).toEqual(["new", "old", "undated"]);
    });

    it("sorts by creation and by update, newest first", async () => {
      const a = await seed("certification", { title: "first", referenceNo: "1" });
      const b = await seed("certification", { title: "second", referenceNo: "2" });
      const c = await seed("certification", { title: "third", referenceNo: "3" });
      expect((await listDocuments({ sort: "created" })).items.map((d) => d.id)).toEqual([c.id, b.id, a.id]);
      await updateDocument(a.id, input("certification", { title: "first, edited", referenceNo: "1" }));
      expect((await listDocuments({ sort: "updated" })).items.map((d) => d.id)).toEqual([a.id, c.id, b.id]);
      expect((await listDocuments({ sort: "created" })).items.map((d) => d.id)).toEqual([c.id, b.id, a.id]);
    });

    it("falls back to 'updated' for an unknown sort", async () => {
      const a = await seed("certification", { title: "one", referenceNo: "1" });
      const b = await seed("certification", { title: "two", referenceNo: "2" });
      expect((await listDocuments({ sort: "bogus" as never })).items.map((d) => d.id)).toEqual([b.id, a.id]);
    });
  });

  describe("paging", () => {
    async function seedTwelve() {
      const ids: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        ids.push((await seed("certification", { title: `Doc ${String(i).padStart(2, "0")}`, referenceNo: `R${i}` }, {}, { files: false })).id);
      }
      return ids;
    }

    it("pages with limit and offset and reports the full total", async () => {
      await seedTwelve();
      const first = await listDocuments({ sort: "title", limit: 5, offset: 0 });
      const second = await listDocuments({ sort: "title", limit: 5, offset: 5 });
      const third = await listDocuments({ sort: "title", limit: 5, offset: 10 });
      expect([first.total, second.total, third.total]).toEqual([12, 12, 12]);
      expect(first.items.map((d) => d.title)).toEqual(["Doc 00", "Doc 01", "Doc 02", "Doc 03", "Doc 04"]);
      expect(second.items.map((d) => d.title)).toEqual(["Doc 05", "Doc 06", "Doc 07", "Doc 08", "Doc 09"]);
      expect(third.items.map((d) => d.title)).toEqual(["Doc 10", "Doc 11"]);
    });

    it("still reports the total for a page past the end", async () => {
      await seedTwelve();
      const past = await listDocuments({ limit: 5, offset: 100 });
      expect(past.items).toEqual([]);
      expect(past.total).toBe(12);
    });

    it("pages stably through ties", async () => {
      await seedTwelve();
      const seen = new Set<string>();
      for (let offset = 0; offset < 12; offset += 4) {
        for (const item of (await listDocuments({ sort: "issued", limit: 4, offset })).items) seen.add(item.id);
      }
      expect(seen.size).toBe(12);
    });

    it("defaults to 50 and clamps to 200", async () => {
      await seedTwelve();
      expect((await listDocuments({ limit: 100_000 })).items).toHaveLength(12);
      expect((await listDocuments({ limit: 1 })).items).toHaveLength(1);
      expect((await listDocuments({ limit: -3 })).items).toHaveLength(1);
      expect((await listDocuments({ limit: Number.NaN })).items).toHaveLength(12);
      expect((await listDocuments({ offset: -5 })).items).toHaveLength(12);
    });
  });

  it("returns nothing for a filter value that is not a real option", async () => {
    await seedMany();
    expect(await listDocuments({ category: "nope" as never })).toEqual({ items: [], total: 0 });
    expect(await listDocuments({ status: "nope" as never })).toEqual({ items: [], total: 0 });
    expect(await listDocuments({ visibility: "nope" as never })).toEqual({ items: [], total: 0 });
  });

  it("attaches file metadata to every record", async () => {
    await seedMany();
    await seedWithBothFiles();
    const { items } = await listDocuments();
    const person = items.find((d) => d.title === "Software Engineering Intern");
    expect(person?.files.map((f) => f.role).sort()).toEqual(["photo", "primary"]);
    expect(items.find((d) => d.category === "certification")?.files.map((f) => f.role)).toEqual(["primary"]);
    expect(items.find((d) => d.title === "Beta Intern")?.files).toEqual([]);
  });
});

describe("listPublicDocuments", () => {
  it("lists only published, public, non-revoked records", async () => {
    const shown = await seed("certification", { title: "Shown", status: "published", visibility: "public" });
    await seed("certification", { title: "Draft", status: "draft", visibility: "public", referenceNo: "2" });
    await seed("certification", { title: "Archived", status: "archived", visibility: "public", referenceNo: "3" });
    await seed("certification", { title: "Private", status: "published", visibility: "private", referenceNo: "4" });
    await seed("certification", { title: "Unlisted", status: "published", visibility: "unlisted", referenceNo: "5" });
    const revoked = await seed("certification", { title: "Revoked", status: "published", visibility: "public", referenceNo: "6" });
    await revokeDocument(revoked.id, "withdrawn");

    const listed = await listPublicDocuments();
    expect(listed.map((d) => d.id)).toEqual([shown.id]);
  });

  it("never lists experience letters (they cannot be public)", async () => {
    await seed("experience_letter", { status: "published" });
    expect(await listPublicDocuments()).toEqual([]);
  });

  it("lists a person only with consent", async () => {
    await seed("program_record", { title: "With consent", status: "published", visibility: "public" }, { consent_to_publish: true });
    await seed("program_record", { title: "Without", status: "published", visibility: "unlisted", referenceNo: "2" });
    const listed = await listPublicDocuments();
    expect(listed.map((d) => d.title)).toEqual(["With consent"]);
    expect(listed[0].holderName).toBe("Aisha Khan");
  });

  it("returns projections, not records", async () => {
    await seed("program_record", { status: "published", visibility: "public" }, { consent_to_publish: true, contact_email: "private@example.com", internal_notes: "SECRET" });
    const payload = JSON.stringify(await listPublicDocuments());
    expect(payload).not.toMatch(/private@example|SECRET|contact_email|internal_notes|consent_to_publish/);
  });

  it("orders featured first, then sort order, then newest issue date", async () => {
    const plain = await seed("certification", { title: "plain", status: "published", visibility: "public", issuedOn: "2026-03-01", referenceNo: "1" });
    const newer = await seed("certification", { title: "newer", status: "published", visibility: "public", issuedOn: "2026-05-01", referenceNo: "2" });
    const early = await seed("certification", { title: "early order", status: "published", visibility: "public", sortOrder: -5, issuedOn: "2020-01-01", referenceNo: "3" });
    const star = await seed("certification", { title: "starred", status: "published", visibility: "public", featured: true, sortOrder: 50, issuedOn: "2019-01-01", referenceNo: "4" });
    const listed = await listPublicDocuments();
    expect(listed.map((d) => d.id)).toEqual([star.id, early.id, newer.id, plain.id]);
  });

  it("filters by category", async () => {
    const cert = await seed("certification", { status: "published", visibility: "public" });
    await seed("company_identity", { status: "published", visibility: "public" });
    expect((await listPublicDocuments({ category: "certification" })).map((d) => d.id)).toEqual([cert.id]);
    expect((await listPublicDocuments({ category: "company_identity" }))).toHaveLength(1);
    expect(await listPublicDocuments({ category: "nope" as never })).toEqual([]);
  });

  it("flags download availability from the admin's choice", async () => {
    await seed("certification", { status: "published", visibility: "public", allowDownload: true });
    await seed("certification", { status: "published", visibility: "public", allowDownload: false, referenceNo: "2" });
    const listed = await listPublicDocuments();
    expect(listed.filter((d) => d.hasFile)).toHaveLength(1);
  });

  it("shows expired records as expired", async () => {
    await seed("certification", { status: "published", visibility: "public", issuedOn: "2020-01-01", expiresOn: "2021-01-01" });
    expect((await listPublicDocuments())[0].state).toBe("expired");
  });
});

/* ------------------------------------------------------------------ *
 * Public verification                                                 *
 * ------------------------------------------------------------------ */

describe("lookupVerification", () => {
  it("resolves a published record", async () => {
    const created = await seed("certification", { status: "published", visibility: "unlisted", allowDownload: true });
    const result = await lookupVerification(created.verificationCode ?? "");
    expect(result.state).toBe("valid");
    expect(result.document).toMatchObject({ id: created.id, title: created.title, holderName: created.holderName, state: "valid", hasFile: true });
  });

  it("accepts sloppy spellings of a code", async () => {
    const created = await seed("certification", { status: "published", visibility: "public" });
    const code = created.verificationCode ?? "";
    for (const spelling of [code.toLowerCase(), code.replace(/-/g, ""), `  ${code}  `, code.replace(/-/g, " ")]) {
      expect((await lookupVerification(spelling)).state).toBe("valid");
    }
  });

  it("resolves public records too", async () => {
    const created = await seed("certification", { status: "published", visibility: "public" });
    expect((await lookupVerification(created.verificationCode ?? "")).state).toBe("valid");
  });

  it("reports expiry, valid through the expiry day", async () => {
    const today = await seed("certification", { status: "published", visibility: "public", issuedOn: "2020-01-01", expiresOn: daysFromToday(0), referenceNo: "1" });
    const yesterday = await seed("certification", { status: "published", visibility: "public", issuedOn: "2020-01-01", expiresOn: daysFromToday(-1), referenceNo: "2" });
    expect((await lookupVerification(today.verificationCode ?? "")).state).toBe("valid");
    const expired = await lookupVerification(yesterday.verificationCode ?? "");
    expect(expired.state).toBe("expired");
    expect(expired.document?.state).toBe("expired");
  });

  it("answers not_found, identically, for private, draft, archived and unknown codes", async () => {
    const hidden = await Promise.all([
      seed("certification", { status: "published", visibility: "private", referenceNo: "1" }),
      seed("certification", { status: "draft", visibility: "unlisted", referenceNo: "2" }),
      seed("certification", { status: "archived", visibility: "public", referenceNo: "3" }),
    ]);
    for (const record of hidden) {
      expect(await lookupVerification(record.verificationCode ?? "")).toEqual({ state: "not_found", document: null });
    }
    expect(await lookupVerification("ACV-0000-0000-0000")).toEqual({ state: "not_found", document: null });
  });

  it("answers not_found for malformed codes without touching the database", async () => {
    const spy = vi.fn(sql);
    setSqlClientForTests(spy);
    for (const bad of ["", "garbage", "ACV-1234", "'; DROP TABLE documents;--", "../../admin", "ACV-7K3U-9QXD-4TRH", "x".repeat(10_000)]) {
      expect(await lookupVerification(bad)).toEqual({ state: "not_found", document: null });
    }
    expect(spy).not.toHaveBeenCalled();
    expect(await count("verification_events")).toBe(0);
  });

  it("returns only the public projection", async () => {
    const created = await seed("program_record", { status: "published", visibility: "unlisted" }, { contact_email: "private@example.com", internal_notes: "SECRET" });
    const payload = JSON.stringify(await lookupVerification(created.verificationCode ?? ""));
    expect(payload).not.toMatch(/private@example|SECRET|internal_notes|contact_email/);
  });

  describe("events and counters", () => {
    it("records an event and bumps the counters for a visible record", async () => {
      const created = await seed("certification", { status: "published", visibility: "unlisted" });
      const code = created.verificationCode ?? "";
      await lookupVerification(code, { ipHash: "abc123" });
      await lookupVerification(code);
      const after = await getDocument(created.id);
      expect(after?.verifyCount).toBe(2);
      expect(after?.lastVerifiedAt).toMatch(ISO_PATTERN);

      const { events, total } = await listVerificationEvents();
      expect(total).toBe(2);
      expect(events[0]).toMatchObject({ result: "valid", documentId: created.id, documentTitle: created.title, category: "certification", codeSuffix: code.slice(-4) });
    });

    it("does not change updatedAt", async () => {
      const created = await seed("certification", { status: "published", visibility: "unlisted" });
      await lookupVerification(created.verificationCode ?? "");
      expect((await getDocument(created.id))?.updatedAt).toBe(created.updatedAt);
    });

    it("stores only the last four characters of the code, never the code itself", async () => {
      const created = await seed("certification", { status: "published", visibility: "unlisted" });
      const code = created.verificationCode ?? "";
      await lookupVerification(code, { ipHash: "deadbeef" });
      await lookupVerification("ACV-0000-0000-0000");
      const rows = await db.query("SELECT * FROM verification_events");
      const dump = JSON.stringify(rows.rows);
      expect(dump).not.toContain(code);
      expect(dump).not.toContain(code.slice(4, 14));
      expect(dump).not.toContain("ACV-0000-0000-0000");
      for (const row of rows.rows as Array<{ code_suffix: string }>) expect(row.code_suffix).toHaveLength(4);
    });

    it("records unknown codes too, without counting them against any record", async () => {
      await lookupVerification("ACV-0000-0000-0000");
      const { events } = await listVerificationEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ result: "not_found", documentId: null, codeSuffix: "0000" });
    });

    it("links a hidden record to the event but does not count it", async () => {
      const created = await seed("certification", { status: "draft", visibility: "unlisted" });
      expect((await lookupVerification(created.verificationCode ?? "")).state).toBe("not_found");
      const { events } = await listVerificationEvents();
      expect(events[0]).toMatchObject({ result: "not_found", documentId: created.id });
      expect((await getDocument(created.id))?.verifyCount).toBe(0);
    });

    it("records the state that was reported", async () => {
      const expired = await seed("certification", { status: "published", visibility: "public", issuedOn: "2020-01-01", expiresOn: "2021-01-01", referenceNo: "1" });
      const revoked = await seed("certification", { status: "published", visibility: "public", referenceNo: "2" });
      await revokeDocument(revoked.id, "r");
      await lookupVerification(expired.verificationCode ?? "");
      await lookupVerification(revoked.verificationCode ?? "");
      const results = (await listVerificationEvents()).events.map((e) => e.result).sort();
      expect(results).toEqual(["expired", "revoked"]);
    });

    it("keeps only a well-formed ip hash", async () => {
      const created = await seed("certification", { status: "published", visibility: "public" });
      await lookupVerification(created.verificationCode ?? "", { ipHash: "a1b2c3d4e5f6" });
      await lookupVerification(created.verificationCode ?? "", { ipHash: "<script>alert(1)</script>" });
      await lookupVerification(created.verificationCode ?? "", { ipHash: "x".repeat(200) });
      const rows = await db.query<{ ip_hash: string }>("SELECT ip_hash FROM verification_events ORDER BY id");
      expect(rows.rows.map((r) => r.ip_hash)).toEqual(["a1b2c3d4e5f6", "", ""]);
    });

    it("never fails a lookup because event logging failed", async () => {
      const created = await seed("certification", { status: "published", visibility: "unlisted" });
      const code = created.verificationCode ?? "";
      const flaky: SqlClient = (strings, ...values) => {
        if (strings.join("").includes("INSERT INTO verification_events")) return Promise.reject(new Error("events table unavailable"));
        return sql(strings, ...values);
      };
      setSqlClientForTests(flaky);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const found = await lookupVerification(code);
      expect(found.state).toBe("valid");
      expect(found.document?.id).toBe(created.id);
      const missing = await lookupVerification("ACV-0000-0000-0000");
      expect(missing.state).toBe("not_found");
      expect(log).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(code);
      setSqlClientForTests(sql);
      expect((await getDocument(created.id))?.verifyCount).toBe(0);
    });

    it("counts concurrent lookups without losing any", async () => {
      const created = await seed("certification", { status: "published", visibility: "public" });
      await Promise.all(Array.from({ length: 8 }, () => lookupVerification(created.verificationCode ?? "")));
      expect((await getDocument(created.id))?.verifyCount).toBe(8);
      expect((await listVerificationEvents()).total).toBe(8);
    });
  });
});

/* ------------------------------------------------------------------ *
 * Dashboard and activity                                              *
 * ------------------------------------------------------------------ */

describe("getDashboardStats", () => {
  it("is all zeros for an empty registry", async () => {
    const stats = await getDashboardStats();
    expect(stats.totals).toEqual({ total: 0, published: 0, draft: 0, archived: 0 });
    expect(stats.revoked).toBe(0);
    expect(stats.expired).toBe(0);
    expect(stats.expiringSoon).toBe(0);
    expect(stats.verifications7d).toBe(0);
    expect(stats.verifications30d).toBe(0);
    expect(stats.recentlyUpdated).toEqual([]);
    expect(stats.soonestExpiring).toEqual([]);
    for (const spec of CATEGORY_LIST) expect(stats.byCategory[spec.key]).toEqual({ total: 0, published: 0, draft: 0, archived: 0 });
  });

  it("counts per category and status", async () => {
    await seed("certification", { status: "published", referenceNo: "1" });
    await seed("certification", { status: "published", referenceNo: "2" });
    await seed("certification", { status: "draft", referenceNo: "3" });
    await seed("certification", { status: "archived", referenceNo: "4" });
    await seed("financial_report", { status: "published" });
    await seed("company_identity", { status: "draft" });
    const stats = await getDashboardStats();
    expect(stats.byCategory.certification).toEqual({ total: 4, published: 2, draft: 1, archived: 1 });
    expect(stats.byCategory.financial_report).toEqual({ total: 1, published: 1, draft: 0, archived: 0 });
    expect(stats.byCategory.company_identity).toEqual({ total: 1, published: 0, draft: 1, archived: 0 });
    expect(Object.keys(stats.byCategory).sort()).toEqual(["certification", "company_identity", "experience_letter", "financial_report", "program_record"]);
    expect(stats.byCategory.program_record.total).toBe(0);
    expect(stats.totals).toEqual({ total: 6, published: 3, draft: 2, archived: 1 });
  });

  it("counts revoked, expired and soon-to-expire records", async () => {
    const revoked = await seed("certification", { referenceNo: "1" });
    await revokeDocument(revoked.id, "r");
    await seed("certification", { referenceNo: "2", issuedOn: "2019-01-01", expiresOn: "2020-01-01" });
    await seed("certification", { referenceNo: "3", issuedOn: "2019-01-01", expiresOn: daysFromToday(-1) });
    await seed("certification", { referenceNo: "4", expiresOn: daysFromToday(0) });
    await seed("certification", { referenceNo: "5", expiresOn: daysFromToday(EXPIRING_SOON_DAYS) });
    await seed("certification", { referenceNo: "6", expiresOn: daysFromToday(EXPIRING_SOON_DAYS + 1) });
    await seed("certification", { referenceNo: "7" });
    const archived = await seed("certification", { referenceNo: "8", issuedOn: "2019-01-01", expiresOn: "2020-06-01" });
    await setDocumentStatus(archived.id, "archived");
    const revokedExpired = await seed("certification", { referenceNo: "9", issuedOn: "2019-01-01", expiresOn: "2020-06-01" });
    await revokeDocument(revokedExpired.id, "r");

    const stats = await getDashboardStats();
    expect(stats.revoked).toBe(2);
    expect(stats.expired).toBe(2); // not the archived one, not the revoked one
    expect(stats.expiringSoon).toBe(2); // today and today + 60, not +61
  });

  it("counts lookups in the last 7 and 30 days", async () => {
    const created = await seed("certification", { status: "published", visibility: "public" });
    await lookupVerification(created.verificationCode ?? "");
    await lookupVerification("ACV-0000-0000-0000");
    await db.query("INSERT INTO verification_events (at, result) VALUES (now() - interval '3 days', 'valid'), (now() - interval '8 days', 'valid'), (now() - interval '29 days', 'valid'), (now() - interval '31 days', 'valid'), (now() - interval '400 days', 'valid')");
    const stats = await getDashboardStats();
    expect(stats.verifications7d).toBe(3);
    expect(stats.verifications30d).toBe(5);
  });

  it("returns the six most recently updated records, newest first", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 8; i += 1) ids.push((await seed("certification", { title: `Doc ${i}`, referenceNo: String(i) }, {}, { files: false })).id);
    await updateDocument(ids[0], input("certification", { title: "Doc 0 edited", referenceNo: "0" }));
    const { recentlyUpdated } = await getDashboardStats();
    expect(recentlyUpdated).toHaveLength(6);
    expect(recentlyUpdated.map((d) => d.id)).toEqual([ids[0], ids[7], ids[6], ids[5], ids[4], ids[3]]);
  });

  it("returns the six soonest-expiring, soonest first, skipping the past, revoked and archived", async () => {
    const days = [40, 5, 90, 12, 3, 300, 21, 8];
    for (const [i, offset] of days.entries()) await seed("certification", { title: `Cert ${offset}`, referenceNo: `I${i}`, expiresOn: daysFromToday(offset) });
    await seed("certification", { title: "Past", referenceNo: "past", issuedOn: "2019-01-01", expiresOn: "2020-01-01" });
    const revoked = await seed("certification", { title: "Revoked", referenceNo: "rev", expiresOn: daysFromToday(1) });
    await revokeDocument(revoked.id, "r");
    const archived = await seed("certification", { title: "Archived", referenceNo: "arc", expiresOn: daysFromToday(2) });
    await setDocumentStatus(archived.id, "archived");
    await seed("certification", { title: "Never expires", referenceNo: "never" });

    const { soonestExpiring } = await getDashboardStats();
    expect(soonestExpiring.map((d) => d.title)).toEqual(["Cert 3", "Cert 5", "Cert 8", "Cert 12", "Cert 21", "Cert 40"]);
  });
});

describe("listVerificationEvents", () => {
  it("lists newest first with the document's title and category", async () => {
    const a = await seed("certification", { title: "Cert A", status: "published", visibility: "public", referenceNo: "1" });
    await seed("company_identity", { title: "Identity B", status: "published", visibility: "public" });
    await lookupVerification(a.verificationCode ?? "");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await lookupVerification("ACV-1111-1111-1111");
    const { events, total } = await listVerificationEvents();
    expect(total).toBe(2);
    expect(events[0]).toMatchObject({ result: "not_found", documentId: null, documentTitle: null, category: null });
    expect(events[1]).toMatchObject({ result: "valid", documentTitle: "Cert A", category: "certification" });
    expect(events[0].id).toMatch(/^\d+$/);
    expect(events[0].at).toMatch(ISO_PATTERN);
  });

  it("filters by document and pages", async () => {
    const a = await seed("certification", { status: "published", visibility: "public", referenceNo: "1" });
    const b = await seed("certification", { status: "published", visibility: "public", referenceNo: "2" });
    for (let i = 0; i < 5; i += 1) await lookupVerification(a.verificationCode ?? "");
    for (let i = 0; i < 2; i += 1) await lookupVerification(b.verificationCode ?? "");

    expect((await listVerificationEvents({ documentId: a.id })).total).toBe(5);
    expect((await listVerificationEvents({ documentId: b.id })).total).toBe(2);
    const page = await listVerificationEvents({ limit: 3, offset: 3 });
    expect(page.total).toBe(7);
    expect(page.events).toHaveLength(3);
    const past = await listVerificationEvents({ limit: 3, offset: 50 });
    expect(past.events).toEqual([]);
    expect(past.total).toBe(7);
  });

  it("returns nothing for a malformed or unknown document id", async () => {
    await seed("certification");
    expect(await listVerificationEvents({ documentId: "bad" })).toEqual({ events: [], total: 0 });
    expect(await listVerificationEvents({ documentId: MISSING_ID })).toEqual({ events: [], total: 0 });
  });

  it("clamps the page size", async () => {
    await lookupVerification("ACV-1111-1111-1111");
    await lookupVerification("ACV-2222-2222-2222");
    expect((await listVerificationEvents({ limit: 100_000 })).events).toHaveLength(2);
    expect((await listVerificationEvents({ limit: 0 })).events).toHaveLength(2);
    expect((await listVerificationEvents({ limit: -1 })).events).toHaveLength(1);
  });
});

describe("module wiring", () => {
  it("normalises codes the same way everywhere", () => {
    expect(normalizeVerificationCode("acv 0000 0000 0000")).toBe("ACV-0000-0000-0000");
  });

  it("uses whatever client getSql() returns at call time", async () => {
    const seen = vi.fn(sql);
    setSqlClientForTests(seen);
    expect(getSql()).toBe(seen);
    await getDocument(MISSING_ID);
    expect(seen).toHaveBeenCalled();
  });
});

describe("view-only access is stored apart from download", () => {
  it("keeps view and download separate, and reads them back", async () => {
    const viewOnly = await seed("certification", { allowView: true, allowDownload: false });
    expect(viewOnly).toMatchObject({ allowView: true, allowDownload: false });
    const open = await seed("certification", { allowDownload: true });
    expect(open).toMatchObject({ allowView: true, allowDownload: true });
    const closed = await seed("certification", { allowView: false, allowDownload: false });
    expect(closed).toMatchObject({ allowView: false, allowDownload: false });
  });

  it("changes with an edit", async () => {
    const created = await seed("certification", { allowView: true, allowDownload: true });
    const updated = await updateDocument(created.id, input("certification", { referenceNo: created.referenceNo, allowView: true, allowDownload: false }));
    expect(updated).toMatchObject({ allowView: true, allowDownload: false });
    const closed = await updateDocument(created.id, input("certification", { referenceNo: created.referenceNo, allowView: false, allowDownload: false }));
    expect(closed).toMatchObject({ allowView: false, allowDownload: false });
  });

  it("a duplicate keeps the original's view and download settings", async () => {
    const created = await seed("certification", { allowView: true, allowDownload: false });
    const copy = await duplicateDocument(created.id);
    expect(copy).toMatchObject({ allowView: true, allowDownload: false });
  });

  it("a row from before the setting existed reads as view off, and is still open because download is on", async () => {
    const created = await seed("certification", { allowDownload: true });
    await pg.db.query("UPDATE documents SET allow_view = false WHERE id = $1", [created.id]);
    const stored = await getDocument(created.id);
    expect(stored).toMatchObject({ allowView: false, allowDownload: true });
  });
});
