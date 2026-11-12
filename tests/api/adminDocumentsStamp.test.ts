import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as actionsRoute from "@/app/api/admin/documents/[id]/actions/route";
import * as fileRoute from "@/app/api/admin/documents/[id]/file/route";
import * as itemRoute from "@/app/api/admin/documents/[id]/route";
import * as listRoute from "@/app/api/admin/documents/route";
import { getDocument, getFile } from "@/lib/documents/store";
import type { DocumentRecord } from "@/lib/documents/types";
import {
  API,
  auditRows,
  clearDatabase,
  documentForm,
  enableAdmin,
  formRequest,
  getRequest,
  idContext,
  jsonRequest,
  payloadFor,
  startDatabase,
  stopDatabase,
  webpBytes,
  type FormFile,
  type FormParts,
  type TestDatabase,
} from "./adminDocumentsHarness";

/**
 * The QR stamp and the unique reference numbers, through the real admin routes: what an admin sends, what
 * comes back, and what they are told when it cannot be done.
 */

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let database: TestDatabase;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await stopDatabase(database);
});
beforeEach(async () => {
  enableAdmin();
  await clearDatabase(database);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** A real, readable PDF (the harness's own PDFs are placeholders that no PDF reader would open). */
async function realPdf(name = "certificate.pdf"): Promise<FormFile> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText("Certificate", { x: 60, y: 700 });
  return { name, type: "application/pdf", bytes: await doc.save() };
}

const STAMP = { enabled: true, position: "top-right", size: "medium", pages: "first" };

async function create(overrides: Record<string, unknown>, parts: FormParts): Promise<Response> {
  return listRoute.POST(await formRequest("POST", API, documentForm(payloadFor("certification", overrides), parts)));
}

async function createOk(overrides: Record<string, unknown>, parts: FormParts = {}): Promise<DocumentRecord> {
  const response = await create(overrides, parts);
  const body = (await response.json()) as { document: DocumentRecord };
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.document;
}

async function problems(response: Response): Promise<{ status: number; messages: Record<string, string>; message: string }> {
  const body = (await response.json()) as { error: string; fieldMessages?: Record<string, string> };
  return { status: response.status, messages: body.fieldMessages ?? {}, message: body.error };
}

const primaryOf = (record: DocumentRecord) => record.files.find((file) => file.role === "primary");

/** The code a stored PDF says it carries, read from the file itself. */
async function codePrintedOn(id: string): Promise<string | null> {
  const file = await getFile(id, "primary");
  if (!file) return null;
  return /aceva-verification:(ACV-[0-9A-Z-]+)/.exec((await PDFDocument.load(file.bytes)).getKeywords() ?? "")?.[1] ?? null;
}

describe("POST /api/admin/documents with a stamp", () => {
  it("attaches the QR and the code to the uploaded certificate, using the record's own code", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/S-1", stamp: STAMP }, { primary: await realPdf() });
    expect(record.verificationCode).toMatch(/^ACV-/);
    expect(primaryOf(record)?.stamp).toMatchObject({ code: record.verificationCode, position: "top-right", size: "medium", pages: "first" });
    expect(await codePrintedOn(record.id)).toBe(record.verificationCode);
  });

  it("leaves the file alone when the request does not ask for a stamp", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/S-2" }, { primary: await realPdf() });
    expect(primaryOf(record)?.stamp ?? null).toBeNull();
    expect(await codePrintedOn(record.id)).toBeNull();
  });

  it("explains a file that cannot be stamped, against the file, and stores nothing", async () => {
    const webp = await create({ referenceNo: "ACV/CERT/S-3", stamp: STAMP }, { primary: { name: "scan.webp", type: "image/webp", bytes: webpBytes() } });
    const result = await problems(webp);
    expect(result.status).toBe(400);
    expect(result.messages.primary).toMatch(/PDF, PNG or JPEG/);

    const notAPdf = await create({ referenceNo: "ACV/CERT/S-4", stamp: STAMP }, { primary: { name: "fake.pdf", type: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.7\nnot really") } });
    expect((await problems(notAPdf)).messages.primary).toMatch(/could not be read/);

    const rows = await database.db.query<{ n: number }>("SELECT count(*)::int AS n FROM documents");
    expect(rows.rows[0].n).toBe(0);
  });

  it("refuses a stamp when QR verification is off, naming what to switch on", async () => {
    const response = await create({ referenceNo: "ACV/CERT/S-5", enableVerification: false, stamp: STAMP }, { primary: await realPdf() });
    const result = await problems(response);
    expect(result.status).toBe(400);
    expect(result.messages.stamp).toMatch(/verification code/i);
  });

  it("refuses a corner that is not one of the choices", async () => {
    const response = await create({ referenceNo: "ACV/CERT/S-6", stamp: { ...STAMP, position: "middle" } }, { primary: await realPdf() });
    expect((await problems(response)).messages.stamp).toMatch(/Choose one of/);
  });
});

describe("the admin can download the certificate with its QR", () => {
  it("serves the stamped file as an attachment, and it is the very file the public gets", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/D-1", stamp: STAMP }, { primary: await realPdf("certificate.pdf") });
    const response = await fileRoute.GET(await getRequest(`${API}/${record.id}/file?role=primary&download=1`), idContext(record.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("content-disposition")).toContain("certificate.pdf");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(/aceva-verification:(ACV-[0-9A-Z-]+)/.exec((await PDFDocument.load(bytes)).getKeywords() ?? "")?.[1]).toBe(record.verificationCode);
    // Same bytes as the stored, fingerprinted file.
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(primaryOf(record)?.sha256);
  });

  it("opens the same file in the browser when it is not a download", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/D-2", stamp: STAMP }, { primary: await realPdf() });
    const response = await fileRoute.GET(await getRequest(`${API}/${record.id}/file?role=primary`), idContext(record.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition") ?? "").not.toMatch(/^attachment/);
  });
});

describe("unique reference numbers through the routes", () => {
  it("answers a repeated certificate number with a message that names the first document", async () => {
    await createOk({ title: "ISO/IEC 27001", referenceNo: "ACV/CERT/2026/0042" });
    const response = await create({ title: "Something else", referenceNo: "acv/cert/2026/0042" }, {});
    const result = await problems(response);
    expect(result.status).toBe(400);
    expect(result.messages.referenceNo).toContain("ACV/CERT/2026/0042".toLowerCase().replace(/\//g, "/"));
    expect(result.messages.referenceNo).toContain("ISO/IEC 27001");
    expect(result.messages.referenceNo).toMatch(/own number/);
    expect(result.message).toBe(result.messages.referenceNo);
  });

  it("refuses an edit onto another document's number, and keeps what was there", async () => {
    await createOk({ title: "First", referenceNo: "TAKEN-1" });
    const second = await createOk({ title: "Second", referenceNo: "FREE-1" });
    const response = await itemRoute.PATCH(
      await formRequest("PATCH", `${API}/${second.id}`, documentForm(payloadFor("certification", { title: "Second", referenceNo: "TAKEN-1" }))),
      idContext(second.id),
    );
    expect((await problems(response)).messages.referenceNo).toContain("First");
    expect((await getDocument(second.id))?.referenceNo).toBe("FREE-1");
  });

  it("lets an edit keep the document's own number", async () => {
    const record = await createOk({ title: "Mine", referenceNo: "MINE-1" });
    const response = await itemRoute.PATCH(
      await formRequest("PATCH", `${API}/${record.id}`, documentForm(payloadFor("certification", { title: "Mine, renamed", referenceNo: "MINE-1" }))),
      idContext(record.id),
    );
    expect(response.status).toBe(200);
  });
});

describe("the stamp_file action", () => {
  async function act(id: string, body: unknown): Promise<Response> {
    return actionsRoute.POST(await jsonRequest("POST", `${API}/${id}/actions`, body), idContext(id));
  }

  it("adds the QR to a file saved without one, in the placement asked for", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/A-1" }, { primary: await realPdf() });
    expect(primaryOf(record)?.stamp ?? null).toBeNull();

    const response = await act(record.id, { action: "stamp_file", position: "bottom-left", size: "large", pages: "all" });
    const body = (await response.json()) as { document: DocumentRecord };
    expect(response.status).toBe(200);
    expect(primaryOf(body.document)?.stamp).toMatchObject({ code: record.verificationCode, position: "bottom-left", size: "large", pages: "all" });
    expect(await codePrintedOn(record.id)).toBe(record.verificationCode);
  });

  it("logs the placement but never the code", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/A-2" }, { primary: await realPdf() });
    await act(record.id, { action: "stamp_file" });
    const rows = (await auditRows(database)).filter((row) => row.action === "document.stamp_file");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(record.verificationCode as string);
    expect(rows[0].detail).toMatchObject({ position: "bottom-right", size: "medium", pages: "first" });
  });

  it("explains what is missing instead of failing quietly", async () => {
    const noFile = await createOk({ referenceNo: "ACV/CERT/A-3" });
    expect((await problems(await act(noFile.id, { action: "stamp_file" }))).message).toMatch(/no file/i);

    const noCode = await createOk({ referenceNo: "ACV/CERT/A-4", enableVerification: false }, { primary: await realPdf() });
    expect((await problems(await act(noCode.id, { action: "stamp_file" }))).message).toMatch(/verification code/i);
  });

  it("rejects a placement that is not one of the choices", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/A-5" }, { primary: await realPdf() });
    const result = await problems(await act(record.id, { action: "stamp_file", position: "centre" }));
    expect(result.status).toBe(400);
    expect(result.messages.stamp).toMatch(/corner/i);
  });

  it("regenerating the code re-stamps the file through the route too", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/A-6", stamp: STAMP }, { primary: await realPdf() });
    const response = await act(record.id, { action: "regenerate_code" });
    const body = (await response.json()) as { document: DocumentRecord };
    expect(body.document.verificationCode).not.toBe(record.verificationCode);
    expect(await codePrintedOn(record.id)).toBe(body.document.verificationCode);
  });

  it("duplicating gives the copy its own code on its own file", async () => {
    const record = await createOk({ referenceNo: "ACV/CERT/A-7", stamp: STAMP }, { primary: await realPdf() });
    const response = await act(record.id, { action: "duplicate" });
    const body = (await response.json()) as { document: DocumentRecord };
    expect(body.document.verificationCode).not.toBe(record.verificationCode);
    expect(await codePrintedOn(body.document.id)).toBe(body.document.verificationCode);
    expect(await codePrintedOn(record.id)).toBe(record.verificationCode);
  });
});
