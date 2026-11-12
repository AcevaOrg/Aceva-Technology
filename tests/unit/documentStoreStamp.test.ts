import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlClientForTests } from "@/lib/db";
import { CATEGORIES } from "@/lib/documents/categories";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { StampError } from "@/lib/documents/stamp";
import {
  DuplicateReferenceError,
  createDocument,
  duplicateDocument,
  getDocument,
  getFile,
  regenerateVerificationCode,
  restampDocument,
  updateDocument,
} from "@/lib/documents/store";
import { DOCUMENT_CATEGORY_KEYS, type DocumentCategory, type StampOptions } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";

/**
 * The verification stamp as the store uses it (the QR drawn on the stored file with the record's own code,
 * the original kept beside it, a new code or a copy re-stamped) and the rule that two papers of a kind never
 * share a reference number.
 */

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let pg: Awaited<ReturnType<typeof createPgliteSql>>;

beforeAll(async () => {
  pg = await createPgliteSql();
  setSqlClientForTests(pg.sql);
  await ensureDocumentTables();
});

afterAll(async () => {
  setSqlClientForTests(null);
  resetDocumentTablesCache();
  await pg.close();
});

beforeEach(async () => {
  setSqlClientForTests(pg.sql);
  await pg.db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

const STAMP: StampOptions = { position: "bottom-right", size: "medium", pages: "first" };
let sequence = 0;

function certification(overrides: Record<string, unknown> = {}): DocumentInput {
  sequence += 1;
  const result = validateDocumentInput(
    {
      title: `Certificate ${sequence}`,
      holderName: "ACEVA",
      referenceNo: `ACV/CERT/${sequence}`,
      issuedOn: "2026-01-01",
      enableVerification: true,
      data: { direction: "held", issuing_body: "BSI" },
      ...overrides,
    },
    { category: "certification" },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

async function pdfUpload(name = "certificate.pdf", pages = 1): Promise<InspectedUpload> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([595, 842]).drawText(`Original ${name} page ${i + 1}`, { x: 50, y: 700 });
  const result = inspectUpload({ name, bytes: Buffer.from(await doc.save()) }, "primary");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

const primaryOf = (record: { files: Array<{ role: string }> }) => record.files.find((file) => file.role === "primary") as (typeof record.files)[number] & {
  stamp?: { code: string; position: string; size: string; pages: string } | null;
  sha256: string;
  mimeType: string;
  filename: string;
};

/** The code a stored PDF says it carries (read from the file itself, not from the database). */
async function codePrintedOn(documentId: string): Promise<string | null> {
  const file = await getFile(documentId, "primary");
  if (!file) return null;
  const keywords = (await PDFDocument.load(file.bytes)).getKeywords() ?? "";
  return /aceva-verification:(ACV-[0-9A-Z-]+)/.exec(keywords)?.[1] ?? null;
}

/* ------------------------------------------------------------------ *
 * Stamping on create                                                  *
 * ------------------------------------------------------------------ */

describe("createDocument with a stamp", () => {
  it("prints the record's own code on the stored file and remembers what it drew", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const file = primaryOf(created);
    expect(created.verificationCode).toMatch(/^ACV-/);
    expect(file.stamp).toMatchObject({ code: created.verificationCode, ...STAMP });
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("stores the stamped bytes under a matching size and fingerprint (what the verify page shows)", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const stored = await getFile(created.id, "primary");
    expect(stored).not.toBeNull();
    expect(stored?.bytes.length).toBe(stored?.meta.sizeBytes);
    expect(createHash("sha256").update(stored?.bytes ?? Buffer.alloc(0)).digest("hex")).toBe(primaryOf(created).sha256);
  });

  it("leaves the file alone when no stamp is asked for", async () => {
    const original = await pdfUpload();
    const created = await createDocument(certification(), { primary: original });
    expect(primaryOf(created).stamp ?? null).toBeNull();
    expect((await getFile(created.id, "primary"))?.bytes.equals(original.bytes)).toBe(true);
  });

  it("the form's rules refuse a stamp when verification is off, saying why", () => {
    const result = validateDocumentInput(
      { title: "T", holderName: "H", referenceNo: "R", issuedOn: "2026-01-01", enableVerification: false, stamp: { enabled: true }, data: { direction: "held", issuing_body: "B" } },
      { category: "certification" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.stamp).toMatch(/verification code/i);
  });

  it("even if asked directly, the store draws nothing when there is no code to print", async () => {
    const input = { ...certification({ enableVerification: false }), stamp: STAMP };
    const created = await createDocument(input, { primary: await pdfUpload() });
    expect(created.verificationCode).toBeNull();
    expect(primaryOf(created).stamp ?? null).toBeNull();
  });

  it("turns an image into a PDF that carries the QR", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const image = inspectUpload({ name: "scan.png", bytes: png }, "primary");
    if (!image.ok) throw new Error(image.error);
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: image.file });
    expect(primaryOf(created)).toMatchObject({ mimeType: "application/pdf", filename: "scan.pdf" });
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("refuses a file that cannot carry the QR, and stores nothing", async () => {
    const webp = inspectUpload({ name: "scan.webp", bytes: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(32)]) }, "primary");
    if (!webp.ok) throw new Error(webp.error);
    await expect(createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: webp.file })).rejects.toBeInstanceOf(StampError);
    expect(await pg.db.query("SELECT count(*)::int AS n FROM documents")).toMatchObject({ rows: [{ n: 0 }] });
  });

  it("keeps the untouched original beside the stamped copy, and never serves it", async () => {
    const original = await pdfUpload();
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: original });
    const rows = (await pg.db.query("SELECT source_data, data FROM document_files WHERE document_id = $1 AND role = 'primary'", [created.id])).rows as Array<{
      source_data: Uint8Array | null;
      data: Uint8Array;
    }>;
    expect(Buffer.from(rows[0].source_data ?? []).equals(original.bytes)).toBe(true);
    expect(Buffer.from(rows[0].data).equals(original.bytes)).toBe(false);
    expect((await getFile(created.id, "primary"))?.bytes.equals(original.bytes)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * A new code, a copy, a new placement                                 *
 * ------------------------------------------------------------------ */

describe("keeping the printed QR true", () => {
  it("regenerating the code stamps the file again with the NEW code, from the original", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const before = created.verificationCode;
    const regenerated = await regenerateVerificationCode(created.id);
    expect(regenerated?.verificationCode).not.toBe(before);
    expect(await codePrintedOn(created.id)).toBe(regenerated?.verificationCode);
    expect(primaryOf(regenerated as typeof created).stamp?.code).toBe(regenerated?.verificationCode);
    // One QR, not two: a second pass starts from the original, so the page is not stamped on top of a stamp.
    const file = await getFile(created.id, "primary");
    expect(file).not.toBeNull();
    expect((await PDFDocument.load(file?.bytes ?? Buffer.alloc(0))).getPageCount()).toBe(1);
  });

  it("regenerating the code leaves an unstamped file exactly as it was", async () => {
    const original = await pdfUpload();
    const created = await createDocument(certification(), { primary: original });
    await regenerateVerificationCode(created.id);
    expect((await getFile(created.id, "primary"))?.bytes.equals(original.bytes)).toBe(true);
  });

  it("a duplicate gets its own code printed on its own copy of the file, not the original's", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const copy = await duplicateDocument(created.id);
    expect(copy?.verificationCode).toBeTruthy();
    expect(copy?.verificationCode).not.toBe(created.verificationCode);
    expect(await codePrintedOn(copy?.id as string)).toBe(copy?.verificationCode);
    // The original is untouched.
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("saving with a different corner draws the stamp again, still once", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const moved = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, stamp: { enabled: true, ...STAMP, position: "top-left" } }));
    expect(primaryOf(moved as typeof created).stamp).toMatchObject({ position: "top-left", code: created.verificationCode });
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("saving with the same placement does not rewrite the file", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const before = primaryOf(created).sha256;
    const again = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, title: "Renamed", stamp: { enabled: true, ...STAMP } }));
    expect(primaryOf(again as typeof created).sha256).toBe(before);
  });

  it("switching the stamp off puts the original file back", async () => {
    const original = await pdfUpload();
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: original });
    const off = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, stamp: null }));
    expect(primaryOf(off as typeof created).stamp ?? null).toBeNull();
    expect((await getFile(created.id, "primary"))?.bytes.equals(original.bytes)).toBe(true);
  });

  it("a save that says nothing about the stamp leaves the file as it is", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload() });
    const before = primaryOf(created).sha256;
    const saved = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, title: "Edited" }));
    expect(primaryOf(saved as typeof created).sha256).toBe(before);
    expect(primaryOf(saved as typeof created).stamp?.code).toBe(created.verificationCode);
  });

  it("a replacement file is stamped with the code the record already has", async () => {
    const created = await createDocument(certification({ stamp: { enabled: true, ...STAMP } }), { primary: await pdfUpload("first.pdf") });
    const replaced = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, stamp: { enabled: true, ...STAMP } }), {
      files: { primary: await pdfUpload("second.pdf") },
    });
    expect(primaryOf(replaced as typeof created).filename).toBe("second.pdf");
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("turning verification on in the same save issues the code and prints that one", async () => {
    const created = await createDocument(certification({ enableVerification: false }), { primary: await pdfUpload() });
    expect(created.verificationCode).toBeNull();
    const saved = await updateDocument(created.id, certification({ referenceNo: created.referenceNo, enableVerification: true, stamp: { enabled: true, ...STAMP } }));
    expect(saved?.verificationCode).toMatch(/^ACV-/);
    expect(await codePrintedOn(created.id)).toBe(saved?.verificationCode);
  });

  it("restampDocument adds the QR to a file saved before stamping existed", async () => {
    const original = await pdfUpload();
    const created = await createDocument(certification(), { primary: original });
    expect(primaryOf(created).stamp ?? null).toBeNull();
    const stamped = await restampDocument(created.id, { position: "top-right", size: "large", pages: "all" });
    expect(primaryOf(stamped as typeof created).stamp).toMatchObject({ code: created.verificationCode, position: "top-right", size: "large", pages: "all" });
    expect(await codePrintedOn(created.id)).toBe(created.verificationCode);
  });

  it("restampDocument says plainly why it cannot, instead of failing quietly", async () => {
    const noCode = await createDocument(certification({ enableVerification: false }), { primary: await pdfUpload() });
    await expect(restampDocument(noCode.id)).rejects.toThrow(/no verification code/i);
    const noFile = await createDocument(certification());
    await expect(restampDocument(noFile.id)).rejects.toThrow(/no file/i);
    expect(await restampDocument("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Reference numbers are unique                                        *
 * ------------------------------------------------------------------ */

describe("a reference number belongs to one document", () => {
  it("refuses a second certificate with the same number, and names the first", async () => {
    const first = await createDocument(certification({ title: "ISO 27001", referenceNo: "ACV/CERT/2026/0042" }));
    const error = await createDocument(certification({ title: "Another", referenceNo: "ACV/CERT/2026/0042" })).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DuplicateReferenceError);
    expect((error as DuplicateReferenceError).existing).toEqual({ id: first.id, title: "ISO 27001" });
    expect((error as DuplicateReferenceError).category).toBe("certification");
  });

  it("ignores case and surrounding spaces", async () => {
    await createDocument(certification({ referenceNo: "ACV/CERT/2026/0042" }));
    await expect(createDocument(certification({ referenceNo: "  acv/cert/2026/0042 " }))).rejects.toBeInstanceOf(DuplicateReferenceError);
  });

  it("stores nothing for the refused one", async () => {
    await createDocument(certification({ referenceNo: "X-1" }));
    await createDocument(certification({ referenceNo: "X-1" })).catch(() => undefined);
    expect(await pg.db.query("SELECT count(*)::int AS n FROM documents")).toMatchObject({ rows: [{ n: 1 }] });
  });

  it("lets the same number stand in a different category", async () => {
    await createDocument(certification({ referenceNo: "SHARED-1" }));
    const letter = validateDocumentInput(
      { title: "Letter", holderName: "Bilal", referenceNo: "SHARED-1", issuedOn: "2026-02-01", data: { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "HR" } },
      { category: "experience_letter" },
    );
    if (!letter.ok) throw new Error(JSON.stringify(letter.errors));
    await expect(createDocument(letter.value)).resolves.toMatchObject({ referenceNo: "SHARED-1" });
  });

  it("lets a company registration number repeat, since one number is quoted on several papers", async () => {
    const identity = (title: string) => {
      const result = validateDocumentInput({ title, referenceNo: "0123456-7", data: { identity_type: "incorporation_certificate" } }, { category: "company_identity" });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result.value;
    };
    await createDocument(identity("Certificate of incorporation"));
    await expect(createDocument(identity("Tax registration"))).resolves.toMatchObject({ referenceNo: "0123456-7" });
  });

  it("allows an empty number on any number of records", async () => {
    const bare = () => {
      const result = validateDocumentInput({ title: "FY report", issuedOn: "2026-01-10", data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" } }, { category: "financial_report" });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result.value;
    };
    await createDocument(bare());
    await expect(createDocument(bare())).resolves.toMatchObject({ referenceNo: "" });
  });

  it("lets a record keep its own number when it is edited", async () => {
    const created = await createDocument(certification({ referenceNo: "KEEP-1" }));
    await expect(updateDocument(created.id, certification({ referenceNo: "KEEP-1", title: "Edited" }))).resolves.toMatchObject({ title: "Edited" });
  });

  it("refuses an edit that moves a record onto another one's number", async () => {
    await createDocument(certification({ referenceNo: "TAKEN-1" }));
    const second = await createDocument(certification({ referenceNo: "FREE-1" }));
    await expect(updateDocument(second.id, certification({ referenceNo: "taken-1" }))).rejects.toBeInstanceOf(DuplicateReferenceError);
    expect((await getDocument(second.id))?.referenceNo).toBe("FREE-1");
  });

  it("does not trap a record that already shares a number (saved before numbers had to be unique)", async () => {
    const a = await createDocument(certification({ referenceNo: "OLD-1" }));
    const b = await createDocument(certification({ referenceNo: "OLD-2" }));
    // Simulate the legacy state straight in the database, below the rule and its index.
    await pg.db.exec("DROP INDEX IF EXISTS documents_category_reference_uidx");
    try {
      await pg.db.query("UPDATE documents SET reference_no = 'OLD-1' WHERE id = $1", [b.id]);
      await expect(updateDocument(b.id, certification({ referenceNo: "OLD-1", title: "Edited anyway" }))).resolves.toMatchObject({ title: "Edited anyway" });
      expect((await getDocument(a.id))?.referenceNo).toBe("OLD-1");
    } finally {
      // Put the index back for the tests after this one (the shared database keeps what a test leaves behind).
      await pg.db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
      resetDocumentTablesCache();
      await ensureDocumentTables();
    }
  });

  it("a duplicate starts without a number, so it never collides with the original", async () => {
    const created = await createDocument(certification({ referenceNo: "DUP-1" }));
    expect((await duplicateDocument(created.id))?.referenceNo).toBe("");
  });

  it("the database refuses it too, if two saves race past the check", async () => {
    await createDocument(certification({ referenceNo: "RACE-1" }));
    await expect(
      pg.db.query(
        "INSERT INTO documents (category, title, visibility, reference_no) VALUES ('certification', 'sneaky', 'private', ' race-1 ')",
      ),
    ).rejects.toThrow(/reference/);
  });

  it("the unique index covers exactly the categories that say so", async () => {
    const wanted = DOCUMENT_CATEGORY_KEYS.filter((key: DocumentCategory) => CATEGORIES[key].uniqueReference).sort();
    const rows = (await pg.db.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'documents_category_reference_uidx'")).rows as Array<{ indexdef: string }>;
    expect(rows).toHaveLength(1);
    const covered = [...rows[0].indexdef.matchAll(/'([a-z_]+)'::text/g)].map((match) => match[1]).sort();
    expect(covered).toEqual(wanted);
  });
});

/* ------------------------------------------------------------------ *
 * Verification codes stay unique                                      *
 * ------------------------------------------------------------------ */

describe("verification codes are never shared", () => {
  it("a hundred records get a hundred different codes", async () => {
    const records = await Promise.all(Array.from({ length: 100 }, (_, i) => createDocument(certification({ referenceNo: `BULK-${i}` }))));
    expect(new Set(records.map((record) => record.verificationCode)).size).toBe(100);
  });

  it("the database refuses a repeated code outright", async () => {
    const created = await createDocument(certification());
    await expect(
      pg.db.query("INSERT INTO documents (category, title, visibility, verification_code) VALUES ('certification', 'copycat', 'private', $1)", [created.verificationCode]),
    ).rejects.toThrow(/verification_code/);
  });
});
