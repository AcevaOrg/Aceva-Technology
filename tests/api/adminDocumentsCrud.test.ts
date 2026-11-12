import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import * as itemRoute from "@/app/api/admin/documents/[id]/route";
import * as listRoute from "@/app/api/admin/documents/route";
import { hashIp } from "@/lib/admin/auth";
import { CATEGORIES } from "@/lib/documents/categories";
import { DOCUMENT_CATEGORY_KEYS, type DocumentCategory, type DocumentRecord } from "@/lib/documents/types";
import {
  API,
  CLIENT_IP,
  MISSING_ID,
  auditRows,
  clearDatabase,
  countRows,
  deleteRequest,
  documentForm,
  enableAdmin,
  formRequest,
  getRequest,
  idContext,
  jpegBytes,
  jpegFile,
  payloadFor,
  pdfBytes,
  pdfFile,
  pngBytes,
  startDatabase,
  stopDatabase,
  streamedFormRequest,
  type FormParts,
  type TestDatabase,
} from "./adminDocumentsHarness";
import { requirePhoto } from "../helpers/specOverrides";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FILE_META_KEYS = ["createdAt", "documentId", "filename", "id", "mimeType", "role", "sha256", "sizeBytes"];

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

/** A response body must never carry file contents, in any encoding the bytes could take. */
function expectNoFileBytes(text: string): void {
  expect(text).not.toContain("%PDF");
  expect(text).not.toContain("JVBERi"); // base64 of "%PDF-"
  expect(text).not.toContain("255044462d"); // hex of "%PDF-"
  expect(text).not.toContain("/9j/"); // base64 of a JPEG header
  expect(text).not.toContain("iVBORw0KGgo"); // base64 of a PNG header
  expect(text).not.toContain("ffd8ff");
}

async function json(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  expectNoFileBytes(text);
  return JSON.parse(text) as Record<string, unknown>;
}

async function postCreate(payload: unknown, parts: FormParts = {}): Promise<Response> {
  return listRoute.POST(await formRequest("POST", API, documentForm(payload, parts)));
}

async function createDoc(category: DocumentCategory, overrides: Record<string, unknown> = {}, parts: FormParts = {}): Promise<DocumentRecord> {
  const response = await postCreate(payloadFor(category, overrides), parts);
  const body = await json(response);
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.document as DocumentRecord;
}

async function patchDoc(id: string, payload: unknown, parts: FormParts = {}): Promise<Response> {
  return itemRoute.PATCH(await formRequest("PATCH", `${API}/${id}`, documentForm(payload, parts)), idContext(id));
}

async function getDoc(id: string): Promise<Response> {
  return itemRoute.GET(await getRequest(`${API}/${id}`), idContext(id));
}

async function listDocs(query = ""): Promise<Response> {
  return listRoute.GET(await getRequest(`${API}${query}`));
}

function withoutCategory(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "category"));
}

function fieldMessages(body: Record<string, unknown>): Record<string, string> {
  return (body.fieldMessages ?? {}) as Record<string, string>;
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const daysFromToday = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * Create                                                               *
 * ------------------------------------------------------------------ */

describe("POST /api/admin/documents", () => {
  describe.each(DOCUMENT_CATEGORY_KEYS)("%s", (category) => {
    const spec = CATEGORIES[category];

    it("creates a draft without files", async () => {
      const response = await postCreate(payloadFor(category));
      const body = await json(response);

      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(body.ok).toBe(true);
      const document = body.document as DocumentRecord;
      expect(document.id).toMatch(UUID);
      expect(response.headers.get("location")).toBe(`/api/admin/documents/${document.id}`);
      expect(document.category).toBe(category);
      expect(document.status).toBe("draft");
      expect(document.files).toEqual([]);
      expect(document.createdAt).toMatch(ISO);
      expect(document.updatedAt).toMatch(ISO);
      expect(document.publishedAt).toBeNull();
      expect(document.revokedAt).toBeNull();
      expect(document.verifyCount).toBe(0);
      // A category that verifies by default gets its code at creation; the others get none.
      if (spec.verifiable) expect(document.verificationCode).toMatch(CODE);
      else expect(document.verificationCode).toBeNull();
      expect(await countRows(database, "documents")).toBe(1);
    });

    it("creates with a document file, and a photo where the category carries one", async () => {
      const primary = pdfFile("scan.pdf", 3000, 3);
      const photo = jpegFile("face.jpg", 700, 4);
      const response = await postCreate(payloadFor(category), spec.hasPhoto ? { primary, photo } : { primary });
      const body = await json(response);
      expect(response.status, JSON.stringify(body)).toBe(201);

      const document = body.document as DocumentRecord;
      const roles = document.files.map((file) => file.role).sort();
      expect(roles).toEqual(spec.hasPhoto ? ["photo", "primary"] : ["primary"]);
      for (const file of document.files) expect(Object.keys(file).sort()).toEqual(FILE_META_KEYS);

      const stored = document.files.find((file) => file.role === "primary");
      expect(stored).toMatchObject({ filename: "scan.pdf", mimeType: "application/pdf", sizeBytes: primary.bytes.length, sha256: sha256(primary.bytes) });
      expect(await countRows(database, "document_files")).toBe(spec.hasPhoto ? 2 : 1);
    });
  });

  it("writes an audit entry that names the title and category but carries no file bytes", async () => {
    const document = await createDoc("certification", {}, { primary: pdfFile() });
    const rows = await auditRows(database);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "document.create", entity_type: "document", entity_id: document.id, actor: `admin:${hashIp(CLIENT_IP)}` });
    expect(rows[0].detail).toMatchObject({ title: "ISO/IEC 27001:2022", category: "certification", status: "draft", files: ["primary"] });
    expect(JSON.stringify(rows[0].detail)).not.toContain(document.verificationCode ?? "no-code-at-all");
    expectNoFileBytes(JSON.stringify(rows[0]));
  });

  it("does not audit a failed create", async () => {
    await postCreate(payloadFor("financial_report", { title: "" }));
    expect(await auditRows(database)).toEqual([]);
  });

  it("publishes on create when the record is complete", async () => {
    const document = await createDoc("financial_report", { status: "published" }, { primary: pdfFile() });
    expect(document.status).toBe("published");
    expect(document.publishedAt).toMatch(ISO);
  });

  it("refuses to save a record as published when it fails the publish rules, and creates nothing", async () => {
    const response = await postCreate(payloadFor("financial_report", { status: "published" }));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(fieldMessages(body).file).toMatch(/upload/i);
    // The upload control is called "primary" in the form, so the same message is sent under that name.
    expect(fieldMessages(body).primary).toBe(fieldMessages(body).file);
    expect(await countRows(database, "documents")).toBe(0);
  });

  it("refuses a published record without its photo where the category requires one", async () => {
    // No shipped category requires a photo, so the requirement is switched on for one category here.
    onTestFinished(requirePhoto("program_record"));
    const response = await postCreate(payloadFor("program_record", { status: "published" }));
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(fieldMessages(body).photo).toMatch(/photo/i);
    expect(await countRows(database, "documents")).toBe(0);
  });

  it("reports every field problem at once, keyed like the validator keys them", async () => {
    const response = await postCreate(
      payloadFor("financial_report", { title: "", issuedOn: "2026-02-30", visibility: "secret", status: "live", summary: "x".repeat(700) }),
    );
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(fieldMessages(body)).sort()).toEqual(["issuedOn", "status", "summary", "title", "visibility"]);
    expect(await countRows(database, "documents")).toBe(0);
  });

  it("reports field problems and upload problems in the same response", async () => {
    const response = await postCreate(payloadFor("financial_report", { title: "" }), {
      primary: { name: "scan.pdf", type: "application/pdf", bytes: pngBytes() },
    });
    const messages = fieldMessages(await json(response));
    expect(Object.keys(messages).sort()).toEqual(["primary", "title"]);
  });

  it.each([[undefined], [null], [""], ["nope"], [7], ["financial-reports"], ["FINANCIAL_REPORT"], [{ key: "financial_report" }]])(
    "refuses the category %j",
    async (category) => {
      const payload = { ...payloadFor("financial_report"), category };
      const response = await postCreate(payload);
      expect(response.status).toBe(400);
      expect(Object.keys(fieldMessages(await json(response)))).toEqual(["category"]);
      expect(await countRows(database, "documents")).toBe(0);
    },
  );

  it("refuses the retired id_card category, however well-formed the rest of the payload is, and creates nothing", async () => {
    const retired = {
      title: "Staff ID",
      holderName: "Sara Malik",
      referenceNo: "ACV-0142",
      issuedOn: "2026-01-01",
      expiresOn: "2027-01-01",
      data: { id_type: "employee" },
    };
    // The key, the old admin slug and the old display name are all unknown categories now.
    for (const category of ["id_card", "ids", "ID card"]) {
      const response = await postCreate({ ...retired, category }, { photo: jpegFile() });
      const body = await json(response);
      expect(response.status, category).toBe(400);
      expect(body.code, category).toBe("VALIDATION_FAILED");
      expect(Object.keys(fieldMessages(body)), category).toEqual(["category"]);
    }
    expect(await countRows(database, "documents")).toBe(0);
    expect(await countRows(database, "document_files")).toBe(0);
    expect(await auditRows(database)).toEqual([]);
  });

  it("refuses a photo for a category that carries none", async () => {
    const response = await postCreate(payloadFor("financial_report"), { photo: jpegFile() });
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(fieldMessages(body).photo).toMatch(/do not carry a photo/i);
    expect(await countRows(database, "documents")).toBe(0);
  });

  it("refuses to list a person publicly without consent", async () => {
    const response = await postCreate(payloadFor("program_record", { visibility: "public" }));
    expect(fieldMessages(await json(response)).visibility).toMatch(/consent/i);
  });

  it("ignores fields a client should not control (id, code, counters, timestamps, unknown data)", async () => {
    const document = await createDoc("financial_report", {
      id: MISSING_ID,
      verificationCode: "ACV-AAAA-AAAA-AAAA",
      verifyCount: 99,
      revokedAt: "2020-01-01T00:00:00.000Z",
      revokedReason: "pre-revoked",
      createdAt: "2000-01-01T00:00:00.000Z",
      publishedAt: "2000-01-01T00:00:00.000Z",
      files: [{ role: "primary", filename: "x.pdf" }],
      data: { ...(payloadFor("financial_report").data as object), unknown_field: "surprise", __proto__: { admin: true } },
    });
    expect(document.id).not.toBe(MISSING_ID);
    expect(document.verificationCode).toBeNull();
    expect(document.verifyCount).toBe(0);
    expect(document.revokedAt).toBeNull();
    expect(document.revokedReason).toBe("");
    expect(document.createdAt.startsWith("2000")).toBe(false);
    expect(document.publishedAt).toBeNull();
    expect(document.files).toEqual([]);
    expect(document.data).not.toHaveProperty("unknown_field");
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("honours enableVerification both ways", async () => {
    expect((await createDoc("certification", { enableVerification: false })).verificationCode).toBeNull();
    expect((await createDoc("financial_report", { enableVerification: true })).verificationCode).toMatch(CODE);
  });

  it("stores text exactly as the validator normalised it and escapes nothing into the response", async () => {
    const document = await createDoc("financial_report", { title: '  <script>alert("x")</script>  &  more  ', summary: "line one\r\n\r\n\r\nline two" });
    expect(document.title).toBe('<script>alert("x")</script> & more');
    expect(document.summary).toBe("line one\n\nline two");
  });
});

/* ------------------------------------------------------------------ *
 * Multipart edge cases                                                 *
 * ------------------------------------------------------------------ */

describe("POST /api/admin/documents: multipart edge cases", () => {
  async function expectRejected(response: Response, status: number, code: string): Promise<Record<string, unknown>> {
    const body = await json(response);
    expect(response.status, JSON.stringify(body)).toBe(status);
    expect(body.ok).toBe(false);
    expect(body.code).toBe(code);
    expect(await countRows(database, "documents")).toBe(0);
    expect(await countRows(database, "document_files")).toBe(0);
    return body;
  }

  it("rejects a request without a payload part", async () => {
    const form = new FormData();
    form.append("primary", new File([new Uint8Array(pdfBytes())], "a.pdf", { type: "application/pdf" }));
    const body = await expectRejected(await listRoute.POST(await formRequest("POST", API, form)), 400, "VALIDATION_FAILED");
    expect(fieldMessages(body)).toHaveProperty("payload");
  });

  it("rejects a malformed JSON payload without echoing the parser's words", async () => {
    const body = await expectRejected(await postCreate("{\"category\": \"financial_report\", "), 400, "INVALID_JSON");
    expect(String(body.error)).not.toMatch(/Unexpected|position|token|JSON\.parse/i);
  });

  it.each([["[]"], ["null"], ['"string"'], ["123"]])("rejects a payload of %s", async (raw) => {
    await expectRejected(await postCreate(raw), 400, "INVALID_JSON");
  });

  it("rejects a JSON body (wrong content type)", async () => {
    const request = new Request(API, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: (await formRequest("POST", API, new FormData())).headers.get("cookie") ?? "" },
      body: JSON.stringify(payloadFor("financial_report")),
    });
    await expectRejected(await listRoute.POST(request), 415, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects a url-encoded form", async () => {
    const authed = await formRequest("POST", API, new FormData());
    const request = new Request(API, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: authed.headers.get("cookie") ?? "" },
      body: "payload=%7B%7D",
    });
    await expectRejected(await listRoute.POST(request), 415, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects a body over the limit when Content-Length says so", async () => {
    const request = await formRequest("POST", API, documentForm(payloadFor("financial_report")), { headers: { "content-length": "5000000" } });
    await expectRejected(await listRoute.POST(request), 413, "PAYLOAD_TOO_LARGE");
  });

  it("rejects a body over the limit when Content-Length lies about it", async () => {
    const form = documentForm(payloadFor("financial_report"), { primary: pdfFile("big.pdf", 4_600_000) });
    const request = await streamedFormRequest("POST", API, form, { headers: { "content-length": "1000" } });
    await expectRejected(await listRoute.POST(request), 413, "PAYLOAD_TOO_LARGE");
  });

  it("rejects a streamed body over the limit when there is no Content-Length at all", async () => {
    const form = documentForm(payloadFor("financial_report"), { primary: pdfFile("big.pdf", 4_600_000) });
    const request = await streamedFormRequest("POST", API, form);
    expect(request.headers.get("content-length")).toBeNull();
    await expectRejected(await listRoute.POST(request), 413, "PAYLOAD_TOO_LARGE");
  });

  it("accepts a large file that fits", async () => {
    const document = await createDoc("financial_report", {}, { primary: pdfFile("large.pdf", 3_500_000) });
    expect(document.files[0].sizeBytes).toBe(pdfBytes(3_500_000).length);
  });

  it("rejects a document over ADMIN_MAX_UPLOAD_MB and a photo over the photo limit", async () => {
    vi.stubEnv("ADMIN_MAX_UPLOAD_MB", "1");
    const body = await expectRejected(
      await postCreate(payloadFor("program_record"), {
        primary: pdfFile("big.pdf", 1_200_000),
        photo: { name: "big.jpg", type: "image/jpeg", bytes: jpegBytes(1_300_000) },
      }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(body).primary).toMatch(/limit is 1 MB/);
    expect(fieldMessages(body).photo).toMatch(/limit is 1\.2 MB/);
  });

  it("rejects a PNG that claims to be a PDF", async () => {
    const body = await expectRejected(
      await postCreate(payloadFor("financial_report"), { primary: { name: "scan.pdf", type: "application/pdf", bytes: pngBytes() } }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(body).primary).toMatch(/PNG|looks like/i);
  });

  it("rejects a PDF with a misleading extension and a spoofed declared type", async () => {
    const wrongName = await expectRejected(
      await postCreate(payloadFor("financial_report"), { primary: { name: "report.exe", type: "application/pdf", bytes: pdfBytes() } }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(wrongName).primary).toMatch(/\.exe/);
    const wrongType = await expectRejected(
      await postCreate(payloadFor("financial_report"), { primary: { name: "report.pdf", type: "text/html", bytes: pdfBytes() } }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(wrongType).primary).toMatch(/browser reported/i);
  });

  it("rejects HTML, an SVG and a script dressed up as images", async () => {
    const samples: Array<[string, string, string]> = [
      ["logo.png", "image/png", "<html><script>alert(1)</script></html>"],
      ["logo.svg", "image/svg+xml", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
      ["run.png", "image/png", "#!/bin/sh\nrm -rf /\n"],
    ];
    for (const [name, type, content] of samples) {
      const body = await expectRejected(
        await postCreate(payloadFor("financial_report"), { primary: { name, type, bytes: new TextEncoder().encode(content) } }),
        400,
        "VALIDATION_FAILED",
      );
      expect(fieldMessages(body).primary).toMatch(/PDF, PNG, JPEG or WEBP/);
    }
  });

  it("rejects a PDF that carries a script", async () => {
    const active = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n%%EOF\n");
    const body = await expectRejected(
      await postCreate(payloadFor("financial_report"), { primary: { name: "report.pdf", type: "application/pdf", bytes: active } }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(body).primary).toMatch(/scripts/i);
  });

  it("rejects an empty file and a PDF used as a photo", async () => {
    const empty = await expectRejected(
      await postCreate(payloadFor("financial_report"), { primary: { name: "empty.pdf", type: "application/pdf", bytes: new Uint8Array(0) } }),
      400,
      "VALIDATION_FAILED",
    );
    expect(fieldMessages(empty).primary).toMatch(/empty/i);

    const pdfPhoto = await expectRejected(await postCreate(payloadFor("program_record"), { photo: pdfFile("me.pdf") }), 400, "VALIDATION_FAILED");
    expect(fieldMessages(pdfPhoto).photo).toMatch(/PNG, JPEG or WEBP/);
  });

  it("ignores text fields and stray parts that only look like uploads", async () => {
    const form = documentForm(payloadFor("financial_report"));
    form.append("primary", "not a file");
    form.append("photo", "also not a file");
    form.append("attachment", new File([new Uint8Array(pdfBytes())], "extra.pdf", { type: "application/pdf" }));
    form.append("status", "published");
    form.append("verificationCode", "ACV-AAAA-AAAA-AAAA");
    const response = await listRoute.POST(await formRequest("POST", API, form));
    const body = await json(response);
    expect(response.status).toBe(201);
    const document = body.document as DocumentRecord;
    expect(document.files).toEqual([]);
    expect(document.status).toBe("draft");
    expect(document.verificationCode).toBeNull();
  });

  it("treats the nameless empty file of an untouched input as no file", async () => {
    const form = documentForm(payloadFor("financial_report"));
    form.append("primary", new File([], ""));
    const response = await listRoute.POST(await formRequest("POST", API, form));
    expect(response.status).toBe(201);
  });
});

/* ------------------------------------------------------------------ *
 * List                                                                 *
 * ------------------------------------------------------------------ */

describe("GET /api/admin/documents", () => {
  let seeded: Record<"alpha" | "beta" | "gamma" | "delta" | "epsilon", DocumentRecord>;

  beforeEach(async () => {
    seeded = {
      alpha: await createDoc("financial_report", { title: "Alpha annual report" }),
      beta: await createDoc("certification", { title: "Beta ISO certificate", status: "published", visibility: "public" }, { primary: pdfFile() }),
      gamma: await createDoc("experience_letter", { title: "Gamma letter" }),
      delta: await createDoc("company_identity", { title: "Delta registration", visibility: "unlisted", expiresOn: daysFromToday(10) }),
      epsilon: await createDoc("program_record", { title: "Epsilon intern", visibility: "unlisted" }),
    };
  });

  async function listed(query: string): Promise<{ titles: string[]; total: number; body: Record<string, unknown> }> {
    const response = await listDocs(query);
    const body = await json(response);
    expect(response.status, JSON.stringify(body)).toBe(200);
    const items = body.items as DocumentRecord[];
    return { titles: items.map((item) => item.title), total: body.total as number, body };
  }

  it("lists everything, newest change first, with the total", async () => {
    const { titles, total, body } = await listed("");
    expect(body.ok).toBe(true);
    expect(total).toBe(5);
    expect(titles).toEqual(["Epsilon intern", "Delta registration", "Gamma letter", "Beta ISO certificate", "Alpha annual report"]);
  });

  it("returns file metadata but never file contents", async () => {
    const response = await listDocs("?category=certification");
    const body = await json(response);
    const [item] = body.items as DocumentRecord[];
    expect(item.files).toHaveLength(1);
    expect(Object.keys(item.files[0]).sort()).toEqual(FILE_META_KEYS);
  });

  it("filters by category key or slug", async () => {
    expect((await listed("?category=experience_letter")).titles).toEqual(["Gamma letter"]);
    expect((await listed("?category=experience-letters")).titles).toEqual(["Gamma letter"]);
    expect((await listed("?category=team")).titles).toEqual(["Epsilon intern"]);
  });

  it("filters by status and visibility", async () => {
    expect((await listed("?status=published")).titles).toEqual(["Beta ISO certificate"]);
    expect((await listed("?status=draft")).total).toBe(4);
    expect((await listed("?status=archived")).total).toBe(0);
    expect((await listed("?visibility=public")).titles).toEqual(["Beta ISO certificate"]);
    const unlisted = Object.values(seeded).filter((document) => document.visibility === "unlisted").map((document) => document.title);
    expect(unlisted).toContain("Epsilon intern");
    expect((await listed("?visibility=unlisted")).titles.sort()).toEqual(unlisted.sort());
    expect((await listed("?visibility=private")).titles).toEqual(["Alpha annual report"]);
  });

  it("searches title, holder, reference number and code", async () => {
    expect((await listed("?q=beta")).titles).toEqual(["Beta ISO certificate"]);
    expect((await listed("?q=bilal")).titles).toEqual(["Gamma letter"]);
    expect((await listed("?q=ACV%2FEL%2F2026%2F0007")).titles).toEqual(["Gamma letter"]);
    expect((await listed(`?q=${encodeURIComponent(seeded.beta.verificationCode ?? "")}`)).titles).toEqual(["Beta ISO certificate"]);
    expect((await listed("?q=zzz-nothing")).total).toBe(0);
  });

  it("treats search text literally, not as a pattern or as SQL", async () => {
    expect((await listed("?q=%25")).total).toBe(0);
    expect((await listed("?q=_")).total).toBe(0);
    expect((await listed(`?q=${encodeURIComponent("'; DROP TABLE documents; --")}`)).total).toBe(0);
    expect((await listed("")).total).toBe(5);
  });

  it("filters by whether a verification code exists", async () => {
    const withCode = Object.values(seeded).filter((document) => document.verificationCode !== null).map((document) => document.title);
    const withoutCode = Object.values(seeded).filter((document) => document.verificationCode === null).map((document) => document.title);
    expect(withCode.length).toBeGreaterThan(0);
    expect(withoutCode.length).toBeGreaterThan(0);
    expect((await listed("?verifiable=true")).titles.sort()).toEqual(withCode.sort());
    expect((await listed("?verifiable=false")).titles.sort()).toEqual(withoutCode.sort());
  });

  it("finds what expires within a number of days", async () => {
    expect((await listed("?expiringWithinDays=30")).titles).toEqual(["Delta registration"]);
    expect((await listed("?expiringWithinDays=5")).total).toBe(0);
  });

  it("sorts and paginates", async () => {
    expect((await listed("?sort=title")).titles).toEqual(["Alpha annual report", "Beta ISO certificate", "Delta registration", "Epsilon intern", "Gamma letter"]);
    const page = await listed("?sort=title&limit=2&offset=2");
    expect(page.titles).toEqual(["Delta registration", "Epsilon intern"]);
    expect(page.total).toBe(5);
    const past = await listed("?sort=title&limit=2&offset=50");
    expect(past.titles).toEqual([]);
    expect(past.total).toBe(5);
  });

  it("combines filters", async () => {
    expect((await listed("?status=draft&category=company_identity")).titles).toEqual(["Delta registration"]);
    expect((await listed("?status=published&category=company_identity")).total).toBe(0);
  });

  it("answers 400 for a filter value that is not an option, rather than listing everything", async () => {
    // "id_card" and "ids" are the retired category: unknown now, so a stale link is refused rather than listing everything.
    for (const query of ["?status=live", "?category=nope", "?category=id_card", "?category=ids", "?visibility=secret", "?limit=ten", "?offset=-1", "?sort=random", "?verifiable=perhaps", "?expiringWithinDays=soon"]) {
      const response = await listDocs(query);
      const body = await json(response);
      expect(response.status, query).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(fieldMessages(body))).toHaveLength(1);
    }
  });

  it("returns an empty list, not an error, for an empty registry", async () => {
    await clearDatabase(database);
    const response = await listDocs();
    expect(await json(response)).toEqual({ ok: true, items: [], total: 0 });
  });
});

/* ------------------------------------------------------------------ *
 * Get one                                                              *
 * ------------------------------------------------------------------ */

describe("GET /api/admin/documents/[id]", () => {
  it("returns the record", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile() });
    const response = await getDoc(created.id);
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, document: created });
  });

  it("answers 404 for a record that does not exist", async () => {
    const response = await getDoc(MISSING_ID);
    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("NOT_FOUND");
  });
});

/* ------------------------------------------------------------------ *
 * Update                                                               *
 * ------------------------------------------------------------------ */

describe("PATCH /api/admin/documents/[id]", () => {
  it("changes the fields and keeps the stored files when no file parts are sent", async () => {
    const created = await createDoc("program_record", {}, { primary: pdfFile("record.pdf", 1500, 1), photo: jpegFile("face.jpg", 400, 2) });

    const response = await patchDoc(created.id, payloadFor("program_record", { title: "Software Engineering Intern (renewed)" }));
    const body = await json(response);

    expect(response.status, JSON.stringify(body)).toBe(200);
    const updated = body.document as DocumentRecord;
    expect(updated.title).toBe("Software Engineering Intern (renewed)");
    expect(updated.files.map((file) => [file.role, file.id, file.sha256])).toEqual(created.files.map((file) => [file.role, file.id, file.sha256]));
    expect(updated.updatedAt > created.updatedAt).toBe(true);
    expect(updated.verificationCode).toBe(created.verificationCode);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it("replaces a file", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile("old.pdf", 1000, 1) });
    const replacement = pdfFile("new.pdf", 1800, 9);

    const response = await patchDoc(created.id, payloadFor("certification"), { primary: replacement });
    const updated = (await json(response)).document as DocumentRecord;

    expect(response.status).toBe(200);
    expect(updated.files).toHaveLength(1);
    expect(updated.files[0]).toMatchObject({ role: "primary", filename: "new.pdf", sizeBytes: replacement.bytes.length, sha256: sha256(replacement.bytes) });
    expect(updated.files[0].sha256).not.toBe(created.files[0].sha256);
    expect(await countRows(database, "document_files")).toBe(1);
  });

  it("removes a file when asked to", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile() });
    const response = await patchDoc(created.id, payloadFor("certification"), { fields: { removePrimary: "1" } });
    const updated = (await json(response)).document as DocumentRecord;

    expect(response.status).toBe(200);
    expect(updated.files).toEqual([]);
    expect(await countRows(database, "document_files")).toBe(0);
  });

  it("lets an upload win over a removal flag for the same file", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile("old.pdf", 900, 1) });
    const replacement = pdfFile("new.pdf", 900, 5);
    const response = await patchDoc(created.id, payloadFor("certification"), { primary: replacement, fields: { removePrimary: "1" } });
    const updated = (await json(response)).document as DocumentRecord;
    expect(updated.files).toHaveLength(1);
    expect(updated.files[0].sha256).toBe(sha256(replacement.bytes));
  });

  it("handles the document file and the photo independently", async () => {
    const created = await createDoc("program_record", {}, { primary: pdfFile("record.pdf", 800, 1), photo: jpegFile("face.jpg", 300, 1) });
    const newPhoto = jpegFile("face2.jpg", 350, 7);

    const replacedPhoto = (await json(await patchDoc(created.id, payloadFor("program_record"), { photo: newPhoto }))).document as DocumentRecord;
    expect(replacedPhoto.files.find((file) => file.role === "primary")?.sha256).toBe(created.files.find((file) => file.role === "primary")?.sha256);
    expect(replacedPhoto.files.find((file) => file.role === "photo")?.sha256).toBe(sha256(newPhoto.bytes));

    const removedPhoto = (await json(await patchDoc(created.id, payloadFor("program_record"), { fields: { removePhoto: "1" } }))).document as DocumentRecord;
    expect(removedPhoto.files.map((file) => file.role)).toEqual(["primary"]);
  });

  it("refuses a bad replacement file and leaves the stored one alone", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile("keep.pdf", 700, 2) });
    const response = await patchDoc(created.id, payloadFor("certification", { title: "Changed" }), {
      primary: { name: "bad.pdf", type: "application/pdf", bytes: pngBytes() },
    });
    expect(response.status).toBe(400);
    expect(fieldMessages(await json(response))).toHaveProperty("primary");

    const current = (await json(await getDoc(created.id))).document as DocumentRecord;
    expect(current.title).toBe(created.title);
    expect(current.files[0].sha256).toBe(created.files[0].sha256);
  });

  it("keeps workflow settings the form did not send", async () => {
    const created = await createDoc("certification", { visibility: "unlisted", featured: true, allowDownload: true, sortOrder: 7 }, { primary: pdfFile() });
    const sent = payloadFor("certification", { title: "Retitled" });
    for (const key of ["visibility", "featured", "allowDownload", "sortOrder", "status"]) delete sent[key];

    const updated = (await json(await patchDoc(created.id, sent))).document as DocumentRecord;
    expect(updated.title).toBe("Retitled");
    expect(updated).toMatchObject({ visibility: "unlisted", featured: true, allowDownload: true, sortOrder: 7, status: "draft" });
  });

  it("accepts a payload without a category: the record's own is used", async () => {
    const created = await createDoc("financial_report");
    const response = await patchDoc(created.id, withoutCategory(payloadFor("financial_report", { title: "No category sent" })));
    expect(response.status).toBe(200);
    expect(((await json(response)).document as DocumentRecord).category).toBe("financial_report");
  });

  it("will not change a record's category, and says so against the category field", async () => {
    const created = await createDoc("financial_report");
    const response = await patchDoc(created.id, payloadFor("certification", { title: "Smuggled" }));
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(fieldMessages(body).category).toMatch(/category/i);
    const current = (await json(await getDoc(created.id))).document as DocumentRecord;
    expect(current.category).toBe("financial_report");
    expect(current.title).toBe(created.title);
  });

  it("refuses a photo on a category that carries none", async () => {
    const created = await createDoc("financial_report");
    const response = await patchDoc(created.id, payloadFor("financial_report"), { photo: jpegFile() });
    expect(fieldMessages(await json(response))).toHaveProperty("photo");
  });

  describe("optimistic concurrency", () => {
    it("accepts the updatedAt the editor loaded and answers 409 once it is out of date", async () => {
      const loaded = await createDoc("financial_report");

      const first = await patchDoc(loaded.id, payloadFor("financial_report", { title: "First edit" }), { fields: { expectedUpdatedAt: loaded.updatedAt } });
      expect(first.status).toBe(200);
      const afterFirst = (await json(first)).document as DocumentRecord;
      expect(afterFirst.updatedAt).not.toBe(loaded.updatedAt);

      // A second editor still holding the first version's timestamp.
      const stale = await patchDoc(loaded.id, payloadFor("financial_report", { title: "Second edit" }), { fields: { expectedUpdatedAt: loaded.updatedAt } });
      const body = await json(stale);
      expect(stale.status).toBe(409);
      expect(body.code).toBe("CONFLICT");
      expect(String(body.error)).toMatch(/changed by someone else/i);
      expect(body.retryable).toBe(false);

      const current = (await json(await getDoc(loaded.id))).document as DocumentRecord;
      expect(current.title).toBe("First edit");
      expect(current.updatedAt).toBe(afterFirst.updatedAt);

      // Reloading and saving again works.
      const retry = await patchDoc(loaded.id, payloadFor("financial_report", { title: "Second edit" }), { fields: { expectedUpdatedAt: afterFirst.updatedAt } });
      expect(retry.status).toBe(200);
    });

    it("does not change files when the save is stale", async () => {
      const loaded = await createDoc("certification", {}, { primary: pdfFile("keep.pdf", 600, 1) });
      await patchDoc(loaded.id, payloadFor("certification", { title: "Other edit" }));

      const stale = await patchDoc(loaded.id, payloadFor("certification"), { primary: pdfFile("lost.pdf", 600, 8), fields: { expectedUpdatedAt: loaded.updatedAt } });
      expect(stale.status).toBe(409);
      const current = (await json(await getDoc(loaded.id))).document as DocumentRecord;
      expect(current.files[0].filename).toBe("keep.pdf");
    });

    it("saves without checking when expectedUpdatedAt is not sent", async () => {
      const loaded = await createDoc("financial_report");
      await patchDoc(loaded.id, payloadFor("financial_report", { title: "Interleaved" }));
      const response = await patchDoc(loaded.id, payloadFor("financial_report", { title: "Last write wins" }));
      expect(response.status).toBe(200);
    });

    it("rejects a malformed expectedUpdatedAt as a field problem, not a conflict", async () => {
      const loaded = await createDoc("financial_report");
      const response = await patchDoc(loaded.id, payloadFor("financial_report"), { fields: { expectedUpdatedAt: "yesterday" } });
      expect(response.status).toBe(400);
      expect(fieldMessages(await json(response))).toHaveProperty("expectedUpdatedAt");
    });
  });

  describe("publishing through a save", () => {
    it("publishes when the record is complete", async () => {
      const created = await createDoc("financial_report", {}, { primary: pdfFile() });
      const response = await patchDoc(created.id, payloadFor("financial_report", { status: "published" }));
      const updated = (await json(response)).document as DocumentRecord;
      expect(response.status).toBe(200);
      expect(updated.status).toBe("published");
      expect(updated.publishedAt).toMatch(ISO);
    });

    it("refuses to publish a record without its required file, and changes nothing", async () => {
      const created = await createDoc("financial_report");
      const response = await patchDoc(created.id, payloadFor("financial_report", { status: "published", title: "Should not stick" }));
      const body = await json(response);

      expect(response.status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(fieldMessages(body).file).toBeDefined();
      expect(fieldMessages(body).primary).toBeDefined();
      const current = (await json(await getDoc(created.id))).document as DocumentRecord;
      expect(current.status).toBe("draft");
      expect(current.title).toBe(created.title);
    });

    it("judges publishing by the files the save leaves behind, not the ones it removes", async () => {
      const created = await createDoc("financial_report", {}, { primary: pdfFile() });
      const response = await patchDoc(created.id, payloadFor("financial_report", { status: "published" }), { fields: { removePrimary: "1" } });
      expect(response.status).toBe(400);
      expect(fieldMessages(await json(response)).file).toBeDefined();

      const current = (await json(await getDoc(created.id))).document as DocumentRecord;
      expect(current.status).toBe("draft");
      expect(current.files).toHaveLength(1);
    });

    it("accepts a publish that supplies the missing file in the same save", async () => {
      const created = await createDoc("financial_report");
      const response = await patchDoc(created.id, payloadFor("financial_report", { status: "published" }), { primary: pdfFile() });
      expect(response.status).toBe(200);
      expect(((await json(response)).document as DocumentRecord).status).toBe("published");
    });
  });

  it("reports field problems and changes nothing", async () => {
    const created = await createDoc("financial_report");
    const response = await patchDoc(created.id, payloadFor("financial_report", { title: "", issuedOn: "not-a-date" }));
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(Object.keys(fieldMessages(body)).sort()).toEqual(["issuedOn", "title"]);
    expect(((await json(await getDoc(created.id))).document as DocumentRecord).title).toBe(created.title);
  });

  it("answers 404 for a record that does not exist", async () => {
    const response = await patchDoc(MISSING_ID, payloadFor("financial_report"));
    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("NOT_FOUND");
  });

  it("answers 415 for a JSON body", async () => {
    const created = await createDoc("financial_report");
    const authed = await formRequest("PATCH", `${API}/${created.id}`, new FormData());
    const request = new Request(`${API}/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: authed.headers.get("cookie") ?? "" },
      body: JSON.stringify(payloadFor("financial_report")),
    });
    expect((await itemRoute.PATCH(request, idContext(created.id))).status).toBe(415);
  });

  it("audits the update with what changed", async () => {
    const created = await createDoc("certification", {}, { primary: pdfFile("a.pdf", 500, 1) });
    await patchDoc(created.id, payloadFor("certification", { status: "published" }), { primary: pdfFile("b.pdf", 500, 2) });
    await patchDoc(created.id, payloadFor("certification", { status: "published" }), { fields: { removePrimary: "1" } });

    const updates = (await auditRows(database)).filter((row) => row.action === "document.update");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ entity_type: "document", entity_id: created.id });
    expect(updates[0].detail).toMatchObject({ title: created.title, category: "certification", status: "published", statusFrom: "draft", primaryFile: "replaced" });
    expectNoFileBytes(JSON.stringify(updates[0]));
  });
});

/* ------------------------------------------------------------------ *
 * Delete                                                               *
 * ------------------------------------------------------------------ */

describe("DELETE /api/admin/documents/[id]", () => {
  it("removes the record and its files, and audits what was deleted", async () => {
    const created = await createDoc("program_record", {}, { primary: pdfFile(), photo: jpegFile() });
    expect(await countRows(database, "document_files")).toBe(2);

    const response = await itemRoute.DELETE(await deleteRequest(`${API}/${created.id}`), idContext(created.id));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });

    expect(await countRows(database, "documents")).toBe(0);
    expect(await countRows(database, "document_files")).toBe(0);
    expect((await getDoc(created.id)).status).toBe(404);

    const deletes = (await auditRows(database)).filter((row) => row.action === "document.delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({ entity_type: "document", entity_id: created.id, actor: `admin:${hashIp(CLIENT_IP)}` });
    expect(deletes[0].detail).toMatchObject({ title: created.title, category: "program_record", fileCount: 2 });
  });

  it("leaves other records and their files alone", async () => {
    const keep = await createDoc("certification", {}, { primary: pdfFile("keep.pdf", 400, 1) });
    const remove = await createDoc("certification", { title: "Remove me" }, { primary: pdfFile("remove.pdf", 400, 2) });
    await itemRoute.DELETE(await deleteRequest(`${API}/${remove.id}`), idContext(remove.id));

    expect(await countRows(database, "documents")).toBe(1);
    expect(await countRows(database, "document_files")).toBe(1);
    expect(((await json(await getDoc(keep.id))).document as DocumentRecord).files[0].filename).toBe("keep.pdf");
  });

  it("answers 404 the second time, and writes no second audit entry", async () => {
    const created = await createDoc("financial_report");
    await itemRoute.DELETE(await deleteRequest(`${API}/${created.id}`), idContext(created.id));
    const again = await itemRoute.DELETE(await deleteRequest(`${API}/${created.id}`), idContext(created.id));

    expect(again.status).toBe(404);
    expect((await json(again)).code).toBe("NOT_FOUND");
    expect((await auditRows(database)).filter((row) => row.action === "document.delete")).toHaveLength(1);
  });

  it("answers 404 for a record that never existed", async () => {
    const response = await itemRoute.DELETE(await deleteRequest(`${API}/${MISSING_ID}`), idContext(MISSING_ID));
    expect(response.status).toBe(404);
  });
});
