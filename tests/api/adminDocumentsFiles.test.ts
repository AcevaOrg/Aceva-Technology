import { createRequire } from "node:module";
import jsQR from "jsqr";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as actionsRoute from "@/app/api/admin/documents/[id]/actions/route";
import * as fileRoute from "@/app/api/admin/documents/[id]/file/route";
import * as qrRoute from "@/app/api/admin/documents/[id]/qr/route";
import * as listRoute from "@/app/api/admin/documents/route";
import { ADMIN_FILE_CSP, ADMIN_SVG_CSP } from "@/lib/admin/documentsApi";
import { verificationUrl } from "@/lib/documents/qr";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import {
  API,
  MISSING_ID,
  clearDatabase,
  documentForm,
  enableAdmin,
  formRequest,
  getRequest,
  idContext,
  jpegFile,
  jsonRequest,
  payloadFor,
  pdfBytes,
  pdfFile,
  pngBytes,
  startDatabase,
  stopDatabase,
  webpBytes,
  type FormFile,
  type FormParts,
  type TestDatabase,
} from "./adminDocumentsHarness";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// pngjs ships no type declarations and only a decode is needed here, so describe just that.
interface DecodedPng {
  width: number;
  height: number;
  data: Buffer;
}
const nodeRequire = createRequire(import.meta.url);
const { PNG } = nodeRequire("pngjs") as { PNG: { sync: { read: (buffer: Buffer) => DecodedPng } } };

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

async function createDoc(category: DocumentCategory, overrides: Record<string, unknown> = {}, parts: FormParts = {}): Promise<DocumentRecord> {
  const response = await listRoute.POST(await formRequest("POST", API, documentForm(payloadFor(category, overrides), parts)));
  const body = (await response.json()) as { document: DocumentRecord };
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.document;
}

async function fetchFile(id: string, query = ""): Promise<Response> {
  return fileRoute.GET(await getRequest(`${API}/${id}/file${query}`), idContext(id));
}

async function fetchQr(id: string, query = ""): Promise<Response> {
  return qrRoute.GET(await getRequest(`${API}/${id}/qr${query}`), idContext(id));
}

async function bytesOf(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

async function errorOf(response: Response): Promise<{ code: string; fieldMessages?: Record<string, string> }> {
  return (await response.json()) as { code: string; fieldMessages?: Record<string, string> };
}

/* ------------------------------------------------------------------ *
 * File preview                                                         *
 * ------------------------------------------------------------------ */

describe("GET /api/admin/documents/[id]/file", () => {
  it("serves the stored bytes with the stored type and a locked-down header set", async () => {
    const primary = pdfFile("annual-report.pdf", 5000, 4);
    const doc = await createDoc("financial_report", {}, { primary });

    const response = await fetchFile(doc.id);

    expect(response.status).toBe(200);
    expect(await bytesOf(response)).toEqual(Buffer.from(primary.bytes));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(primary.bytes.length));
    expect(response.headers.get("content-disposition")).toBe(`inline; filename="annual-report.pdf"; filename*=UTF-8''annual-report.pdf`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toBe(ADMIN_FILE_CSP);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("has a CSP that lets a PDF viewer in and keeps scripts out", () => {
    expect(ADMIN_FILE_CSP).toContain("default-src 'none'");
    expect(ADMIN_FILE_CSP).toContain("object-src 'self'");
    expect(ADMIN_FILE_CSP).toContain("frame-ancestors 'self'");
    expect(ADMIN_FILE_CSP).not.toContain("script-src");
    expect(ADMIN_FILE_CSP).not.toContain("unsafe-eval");
  });

  it("asks the browser to download when download=1 (or true), and previews otherwise", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile("report.pdf") });
    for (const query of ["?download=1", "?download=true", "?role=primary&download=1"]) {
      expect((await fetchFile(doc.id, query)).headers.get("content-disposition")).toMatch(/^attachment; filename="report\.pdf"/);
    }
    for (const query of ["", "?download=0", "?download=", "?download=maybe"]) {
      expect((await fetchFile(doc.id, query)).headers.get("content-disposition")).toMatch(/^inline; /);
    }
  });

  it.each([
    ["PDF", pdfFile("a.pdf"), "application/pdf"],
    ["PNG", { name: "a.png", type: "image/png", bytes: pngBytes() }, "image/png"],
    ["JPEG", jpegFile("a.jpg"), "image/jpeg"],
    ["WEBP", { name: "a.webp", type: "image/webp", bytes: webpBytes() }, "image/webp"],
  ] as Array<[string, FormFile, string]>)("serves a %s as %s", async (_label, file, mime) => {
    const doc = await createDoc("financial_report", {}, { primary: file });
    const response = await fetchFile(doc.id);
    expect(response.headers.get("content-type")).toBe(mime);
    expect(await bytesOf(response)).toEqual(Buffer.from(file.bytes));
  });

  it("serves the photo when asked for it, and the document file by default", async () => {
    const primary = pdfFile("record.pdf", 900, 1);
    const photo = jpegFile("face.jpg", 450, 3);
    const doc = await createDoc("program_record", {}, { primary, photo });

    const photoResponse = await fetchFile(doc.id, "?role=photo");
    expect(photoResponse.headers.get("content-type")).toBe("image/jpeg");
    expect(await bytesOf(photoResponse)).toEqual(Buffer.from(photo.bytes));

    const defaultResponse = await fetchFile(doc.id);
    expect(defaultResponse.headers.get("content-type")).toBe("application/pdf");
    expect(await bytesOf(defaultResponse)).toEqual(Buffer.from(primary.bytes));
  });

  it("serves files of drafts, private records, archived records and revoked records alike", async () => {
    const draft = await createDoc("certification", { visibility: "private" }, { primary: pdfFile("secret.pdf") });
    expect(draft.status).toBe("draft");
    expect((await fetchFile(draft.id)).status).toBe(200);

    await actionsRoute.POST(await jsonRequest("POST", `${API}/${draft.id}/actions`, { action: "revoke", reason: "x" }), idContext(draft.id));
    await actionsRoute.POST(await jsonRequest("POST", `${API}/${draft.id}/actions`, { action: "archive" }), idContext(draft.id));
    expect((await fetchFile(draft.id)).status).toBe(200);
  });

  it("sanitises an awkward file name in the disposition header", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile('Résumé "final"; v2.pdf') });
    const disposition = (await fetchFile(doc.id)).headers.get("content-disposition") ?? "";
    // An ASCII fallback for old clients, and the exact name for everyone else.
    expect(disposition).toBe(`inline; filename="Resume final v2.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9%20final%20v2.pdf`);
    expect(disposition.split('"').length).toBe(3); // exactly one quoted value: nothing broke out of it
  });

  it("keeps a path out of the stored file name", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile("..\..\etc/passwd/x.pdf") });
    expect(doc.files[0].filename).toBe("x.pdf");
    expect((await fetchFile(doc.id)).headers.get("content-disposition")).toMatch(/^inline; filename="x.pdf"/);
  });

  it("cannot be tricked into header injection by a stored name", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile("plain.pdf") });
    await database.db.query("UPDATE document_files SET filename = $1 WHERE document_id = $2", ['x"\r\nSet-Cookie: pwned=1\r\nX-Evil: 1\r\n.pdf', doc.id]);

    const result = await fetchFile(doc.id);
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(result.headers.get("x-evil")).toBeNull();
    expect(result.headers.get("content-disposition") ?? "").not.toMatch(/[\r\n]/);
  });

  it("downgrades a stored type it does not recognise to an opaque download", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile("page.pdf") });
    for (const mime of ["text/html", "image/svg+xml", "application/javascript"]) {
      await database.db.query("UPDATE document_files SET mime_type = $1 WHERE document_id = $2", [mime, doc.id]);
      const result = await fetchFile(doc.id);
      expect(result.status).toBe(200);
      expect(result.headers.get("content-type")).toBe("application/octet-stream");
      expect(result.headers.get("content-disposition")).toMatch(/^attachment; /);
      expect(result.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("will not serve bytes that no longer match their recorded hash", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile("page.pdf", 800) });
    await database.db.query("UPDATE document_files SET data = decode('00112233', 'hex') WHERE document_id = $1", [doc.id]);
    const result = await fetchFile(doc.id);
    expect(result.status).toBe(404);
    expect((await errorOf(result)).code).toBe("NOT_FOUND");
  });

  it("answers a canonical JSON 404 when there is no such file", async () => {
    const doc = await createDoc("financial_report");
    for (const query of ["", "?role=primary", "?role=photo"]) {
      const result = await fetchFile(doc.id, query);
      expect(result.status).toBe(404);
      expect(result.headers.get("content-type")).toMatch(/application\/json/);
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect((await errorOf(result)).code).toBe("NOT_FOUND");
    }
    expect((await fetchFile(MISSING_ID)).status).toBe(404);
  });

  it("answers 400 for a role that does not exist", async () => {
    const doc = await createDoc("financial_report", {}, { primary: pdfFile() });
    for (const query of ["?role=avatar", "?role=PHOTO", "?role=../primary", "?role=primary%27"]) {
      const result = await fetchFile(doc.id, query);
      expect(result.status, query).toBe(400);
      expect((await errorOf(result)).fieldMessages).toHaveProperty("role");
    }
  });

  it("only serves the file of the record it is asked about", async () => {
    const first = await createDoc("financial_report", {}, { primary: pdfFile("first.pdf", 600, 1) });
    const second = await createDoc("financial_report", { title: "Second report" }, { primary: pdfFile("second.pdf", 600, 2) });
    expect(await bytesOf(await fetchFile(first.id))).not.toEqual(await bytesOf(await fetchFile(second.id)));
    expect(await bytesOf(await fetchFile(first.id))).toEqual(pdfBytes(600, 1));
  });
});

/* ------------------------------------------------------------------ *
 * QR codes                                                             *
 * ------------------------------------------------------------------ */

describe("GET /api/admin/documents/[id]/qr", () => {
  async function verifiable(overrides: Record<string, unknown> = {}): Promise<DocumentRecord> {
    const doc = await createDoc("experience_letter", overrides, { primary: pdfFile() });
    expect(doc.verificationCode).not.toBeNull();
    return doc;
  }

  function decodePng(buffer: Buffer): { width: number; text: string | null } {
    const png = PNG.sync.read(buffer);
    return { width: png.width, text: jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null };
  }

  it("serves an SVG by default, with a sandboxing CSP", async () => {
    const doc = await verifiable();
    const result = await fetchQr(doc.id);
    const svg = (await bytesOf(result)).toString("utf8");

    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(result.headers.get("content-security-policy")).toBe(ADMIN_SVG_CSP);
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(result.headers.get("content-disposition")).toMatch(/^inline; /);
    expect(result.headers.get("content-length")).toBe(String(Buffer.byteLength(svg)));
    expect(svg.startsWith('<svg role="img"')).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).not.toMatch(/<script|onload|javascript:/i);
  });

  it("serves a PNG that a scanner decodes to the record's verification URL", async () => {
    const doc = await verifiable();
    const result = await fetchQr(doc.id, "?format=png&size=480");
    const decoded = decodePng(await bytesOf(result));

    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/png");
    expect(result.headers.get("content-security-policy")).toBe(ADMIN_FILE_CSP);
    expect(decoded.text).toBe(verificationUrl(doc.verificationCode ?? ""));
    expect(decoded.text).toMatch(/\/verify\/ACV-/);
    expect(decoded.width).toBeGreaterThanOrEqual(479);
    expect(decoded.width).toBeLessThanOrEqual(480);
  });

  it("accepts the format in any letter case", async () => {
    const doc = await verifiable();
    expect((await fetchQr(doc.id, "?format=PNG")).headers.get("content-type")).toBe("image/png");
    expect((await fetchQr(doc.id, "?format=Svg")).headers.get("content-type")).toMatch(/svg/);
  });

  describe("size", () => {
    const widthOf = (svg: string): number => Number(/<svg[^>]*\swidth="(\d+)"/.exec(svg)?.[1]);

    it.each([
      ["1", 128],
      ["127", 128],
      ["128", 128],
      ["700", 700],
      ["1024", 1024],
      ["1025", 1024],
      ["99999", 1024],
      ["-5", 128],
      ["", 512],
      ["huge", 512],
    ])("clamps an SVG at size=%j to %i pixels", async (requested, expected) => {
      const doc = await verifiable();
      const svg = (await bytesOf(await fetchQr(doc.id, `?format=svg&size=${requested}`))).toString("utf8");
      expect(widthOf(svg)).toBe(expected);
    });

    it.each([
      ["1", 128],
      ["99999", 1024],
      ["", 512],
      ["300", 300],
    ])("clamps a PNG at size=%j to about %i pixels", async (requested, expected) => {
      const doc = await verifiable();
      const png = PNG.sync.read(await bytesOf(await fetchQr(doc.id, `?format=png&size=${requested}`)));
      expect(png.width).toBeGreaterThanOrEqual(expected - 1);
      expect(png.width).toBeLessThanOrEqual(expected);
      expect(png.height).toBe(png.width);
    });

    it("defaults to 512", async () => {
      const doc = await verifiable();
      expect(widthOf((await bytesOf(await fetchQr(doc.id))).toString("utf8"))).toBe(512);
    });
  });

  describe("download", () => {
    it("names the file after the reference number", async () => {
      const doc = await verifiable({ referenceNo: "ACV/EL/2026/0008" });
      const svg = await fetchQr(doc.id, "?download=1");
      expect(svg.headers.get("content-disposition")).toBe(`attachment; filename="aceva-verify-acv-el-2026-0008.svg"; filename*=UTF-8''aceva-verify-acv-el-2026-0008.svg`);
      const png = await fetchQr(doc.id, "?format=png&download=1");
      expect(png.headers.get("content-disposition")).toMatch(/^attachment; filename="aceva-verify-acv-el-2026-0008\.png"/);
    });

    it("falls back to the id when there is no reference number", async () => {
      const doc = await createDoc("program_record");
      expect(doc.referenceNo).toBe("");
      const result = await fetchQr(doc.id, "?download=1");
      expect(result.headers.get("content-disposition")).toMatch(new RegExp(`^attachment; filename="aceva-verify-${doc.id}\\.svg"`));
    });

    it("previews inline unless asked to download", async () => {
      const doc = await verifiable();
      expect((await fetchQr(doc.id, "?download=0")).headers.get("content-disposition")).toMatch(/^inline; /);
    });

    it("keeps a hostile reference number out of the header", async () => {
      const doc = await verifiable();
      await database.db.query("UPDATE documents SET reference_no = $1 WHERE id = $2", ['../"x"\r\nSet-Cookie: a=b', doc.id]);
      const result = await fetchQr(doc.id, "?download=1");
      expect(result.status).toBe(200);
      expect(result.headers.get("set-cookie")).toBeNull();
      expect(result.headers.get("content-disposition") ?? "").toMatch(/^attachment; filename="aceva-verify-[a-z0-9-]+\.svg"/);
    });
  });

  it("encodes the CURRENT code: regenerating it changes the QR", async () => {
    const doc = await verifiable();
    const before = decodePng(await bytesOf(await fetchQr(doc.id, "?format=png&size=400")));

    const regenerated = await actionsRoute.POST(await jsonRequest("POST", `${API}/${doc.id}/actions`, { action: "regenerate_code" }), idContext(doc.id));
    const newCode = ((await regenerated.json()) as { document: DocumentRecord }).document.verificationCode;
    const after = decodePng(await bytesOf(await fetchQr(doc.id, "?format=png&size=400")));

    expect(newCode).not.toBe(doc.verificationCode);
    expect(before.text).toBe(verificationUrl(doc.verificationCode ?? ""));
    expect(after.text).toBe(verificationUrl(newCode ?? ""));
  });

  it("works for a draft, an archived and a revoked record: the admin can always print it", async () => {
    const doc = await verifiable();
    await actionsRoute.POST(await jsonRequest("POST", `${API}/${doc.id}/actions`, { action: "revoke", reason: "x" }), idContext(doc.id));
    await actionsRoute.POST(await jsonRequest("POST", `${API}/${doc.id}/actions`, { action: "archive" }), idContext(doc.id));
    expect((await fetchQr(doc.id)).status).toBe(200);
  });

  it("answers 404 for a record that has no verification code", async () => {
    const doc = await createDoc("financial_report");
    expect(doc.verificationCode).toBeNull();
    for (const query of ["", "?format=png", "?download=1"]) {
      const result = await fetchQr(doc.id, query);
      expect(result.status).toBe(404);
      expect(result.headers.get("content-type")).toMatch(/application\/json/);
      expect((await errorOf(result)).code).toBe("NOT_FOUND");
    }
  });

  it("answers 404 for a record that does not exist", async () => {
    expect((await fetchQr(MISSING_ID)).status).toBe(404);
  });

  it("answers 400 for a format it cannot draw", async () => {
    const doc = await verifiable();
    for (const query of ["?format=gif", "?format=pdf", "?format=svg%20png"]) {
      const result = await fetchQr(doc.id, query);
      expect(result.status, query).toBe(400);
      expect((await errorOf(result)).fieldMessages).toHaveProperty("format");
    }
  });

  it("never reveals the code anywhere but inside the image", async () => {
    const doc = await verifiable();
    const result = await fetchQr(doc.id, "?format=png");
    for (const [name, value] of result.headers) expect(value, name).not.toContain(doc.verificationCode ?? "no-code");
  });
});
