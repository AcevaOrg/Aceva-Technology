import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_FILE_CSP,
  ADMIN_SVG_CSP,
  DOCUMENT_ACTIONS,
  MAX_PAYLOAD_BYTES,
  QR_DEFAULT_SIZE,
  binaryResponse,
  clampQrSize,
  collectReferenceNumbers,
  fileChange,
  isDatabaseUnavailable,
  isDocumentAction,
  parseCategoryParam,
  parseDocumentMultipart,
  parseFileRole,
  parseListFilters,
  parseQrFormat,
  parseRevokeReason,
  photoPlacementErrors,
  planStatusAction,
  publishBlockedMessages,
  qrFilename,
  readBoundedBody,
  resolveDocumentId,
  runStore,
  servableMimeType,
  suggestNextReference,
  toApiError,
  validationFailed,
  wantsDownload,
  withDocumentRoute,
  type StatusAction,
} from "@/lib/admin/documentsApi";
import { ApiError } from "@/lib/api/response";
import { DatabaseNotConfiguredError } from "@/lib/db";
import type { InspectedUpload } from "@/lib/documents/files";
import { DocumentCategoryChangeError, PublishBlockedError, StaleDocumentError } from "@/lib/documents/store";
import type { DocumentStatus } from "@/lib/documents/types";
import { documentForm, jpegBytes, pdfBytes, pdfFile, pngBytes, pngFile, streamedForm } from "./adminDocumentsHarness";

const URL_ = "https://aceva.test/api/admin/documents";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function failure(work: Promise<unknown>): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected an ApiError, but the call succeeded");
}

function formPost(form: FormData, headers: Record<string, string> = {}): Request {
  return new Request(URL_, { method: "POST", body: form, headers });
}

/** A request whose body is an endless stream of 1 MB chunks, with no Content-Length at all. */
function endlessBody(): { request: Request; stats: { pulls: number; cancelled: boolean } } {
  const stats = { pulls: 0, cancelled: false };
  const chunk = new Uint8Array(1_000_000);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      stats.pulls += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      stats.cancelled = true;
    },
  });
  const init: RequestInit & { duplex: "half" } = { method: "POST", body: stream, duplex: "half" };
  return { request: new Request(URL_, init), stats };
}

/* ------------------------------------------------------------------ *
 * readBoundedBody                                                      *
 * ------------------------------------------------------------------ */

describe("readBoundedBody", () => {
  it("returns the bytes of a body within the limit", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array([1, 2, 3, 4]) });
    expect([...(await readBoundedBody(request, 10))]).toEqual([1, 2, 3, 4]);
  });

  it("returns nothing for a request without a body", async () => {
    expect((await readBoundedBody(new Request(URL_), 10)).byteLength).toBe(0);
  });

  it("accepts a body of exactly the limit", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array(10) });
    expect((await readBoundedBody(request, 10)).byteLength).toBe(10);
  });

  it("refuses an honestly declared oversize body before reading it", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array(5), headers: { "content-length": "11" } });
    const error = await failure(readBoundedBody(request, 10));
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(error.message).toMatch(/too large/i);
  });

  it("refuses an oversize body that lies about its Content-Length", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array(50), headers: { "content-length": "3" } });
    expect((await failure(readBoundedBody(request, 10))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("stops reading an endless stream shortly after the limit and cancels it", async () => {
    const { request, stats } = endlessBody();
    expect((await failure(readBoundedBody(request, 3_000_000))).code).toBe("PAYLOAD_TOO_LARGE");
    expect(stats.cancelled).toBe(true);
    // The queue may be filled ahead of the reader, but never without bound.
    expect(stats.pulls).toBeLessThan(10);
  });

  it("ignores a non-numeric Content-Length and still counts the bytes", async () => {
    const request = new Request(URL_, { method: "POST", body: new Uint8Array(50), headers: { "content-length": "lots" } });
    expect((await failure(readBoundedBody(request, 10))).code).toBe("PAYLOAD_TOO_LARGE");
  });
});

/* ------------------------------------------------------------------ *
 * parseDocumentMultipart                                               *
 * ------------------------------------------------------------------ */

describe("parseDocumentMultipart", () => {
  const payload = { category: "financial_report", title: "A report" };

  it("parses the payload and an uploaded document", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: pdfFile("report.pdf") })));
    expect(parsed.payload).toEqual(payload);
    expect(parsed.primary?.mimeType).toBe("application/pdf");
    expect(parsed.primary?.filename).toBe("report.pdf");
    expect(parsed.primary?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.photo).toBeNull();
    expect(parsed.fileErrors).toEqual({});
    expect(parsed.removePrimary).toBe(false);
    expect(parsed.expectedUpdatedAt).toBeNull();
  });

  it("parses a photo and the removal flags", async () => {
    const parsed = await parseDocumentMultipart(
      formPost(
        documentForm(payload, {
          photo: { name: "me.jpg", type: "image/jpeg", bytes: jpegBytes() },
          fields: { removePrimary: "1", removePhoto: "true", expectedUpdatedAt: "2026-03-01T10:00:00.123Z" },
        }),
      ),
    );
    expect(parsed.photo?.mimeType).toBe("image/jpeg");
    expect(parsed.removePrimary).toBe(true);
    expect(parsed.removePhoto).toBe(true);
    expect(parsed.expectedUpdatedAt).toBe("2026-03-01T10:00:00.123Z");
  });

  it("does not treat other values of the removal flags as true", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { fields: { removePrimary: "0", removePhoto: "maybe" } })));
    expect(parsed.removePrimary).toBe(false);
    expect(parsed.removePhoto).toBe(false);
  });

  it("answers 415 when the body is not multipart", async () => {
    const request = new Request(URL_, { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } });
    expect((await failure(parseDocumentMultipart(request))).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect((await failure(parseDocumentMultipart(new Request(URL_, { method: "POST", body: "x" })))).code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("does not read the body of a request with the wrong content type", async () => {
    const { request, stats } = endlessBody();
    const wrong = new Request(request, { headers: { "content-type": "text/plain" }, duplex: "half" } as RequestInit);
    expect((await failure(parseDocumentMultipart(wrong))).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(stats.pulls).toBeLessThan(3);
  });

  it("accepts the content type in any letter case", async () => {
    const form = documentForm(payload);
    const request = formPost(form);
    const bytes = new Uint8Array(await request.arrayBuffer());
    const type = request.headers.get("content-type") ?? "";
    const shouted = new Request(URL_, { method: "POST", body: bytes, headers: { "content-type": type.replace("multipart/form-data", "Multipart/Form-Data") } });
    expect((await parseDocumentMultipart(shouted)).payload).toEqual(payload);
  });

  it("answers a calm validation error when the multipart framing is broken", async () => {
    const request = new Request(URL_, {
      method: "POST",
      body: "this is not multipart",
      headers: { "content-type": "multipart/form-data; boundary=nope" },
    });
    const error = await failure(parseDocumentMultipart(request));
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.options.fieldMessages).toHaveProperty("form");
  });

  it("answers a validation error when the boundary is missing", async () => {
    const request = new Request(URL_, { method: "POST", body: "x", headers: { "content-type": "multipart/form-data" } });
    expect((await failure(parseDocumentMultipart(request))).code).toBe("VALIDATION_FAILED");
  });

  it("requires a payload part", async () => {
    const form = new FormData();
    form.append("primary", new File([new Uint8Array(pdfBytes())], "a.pdf", { type: "application/pdf" }));
    const error = await failure(parseDocumentMultipart(formPost(form)));
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.options.fieldMessages).toHaveProperty("payload");
  });

  it("rejects a payload sent as a file", async () => {
    const form = new FormData();
    form.append("payload", new File(["{}"], "payload.json", { type: "application/json" }));
    const error = await failure(parseDocumentMultipart(formPost(form)));
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.options.fieldMessages).toHaveProperty("payload");
  });

  it("rejects a payload that is not JSON", async () => {
    const error = await failure(parseDocumentMultipart(formPost(documentForm("{not json"))));
    expect(error.code).toBe("INVALID_JSON");
    expect(error.message).not.toMatch(/Unexpected|position|token/i);
  });

  it.each([["null"], ["[1,2]"], ['"text"'], ["42"], ["true"]])("rejects a payload that is %s, not an object", async (raw) => {
    expect((await failure(parseDocumentMultipart(formPost(documentForm(raw))))).code).toBe("INVALID_JSON");
  });

  it("rejects a payload over 64 KB", async () => {
    const huge = JSON.stringify({ category: "financial_report", title: "x".repeat(MAX_PAYLOAD_BYTES) });
    expect((await failure(parseDocumentMultipart(formPost(documentForm(huge))))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("measures the payload limit in bytes, not characters", async () => {
    // 30,000 characters of three bytes each is 90 KB.
    const wide = JSON.stringify({ title: "€".repeat(30_000) });
    expect((await failure(parseDocumentMultipart(formPost(documentForm(wide))))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("keeps a prototype-polluting payload as plain data", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm('{"__proto__":{"polluted":true},"title":"x"}')));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parsed.payload.title).toBe("x");
  });

  it("refuses a request over the overall limit by its declared length", async () => {
    const request = formPost(documentForm(payload), { "content-length": "99999999" });
    expect((await failure(parseDocumentMultipart(request))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("refuses a request over the overall limit with no Content-Length at all", async () => {
    const form = documentForm(payload, { primary: { name: "big.pdf", type: "application/pdf", bytes: pdfBytes(300_000) } });
    const { body, contentType } = await streamedForm(form);
    const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half", headers: { "content-type": contentType } };
    const request = new Request(URL_, init);
    expect(request.headers.get("content-length")).toBeNull();
    expect((await failure(parseDocumentMultipart(request, { maxRequestBytes: 100_000 }))).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("ignores a text field that shares a file part's name", async () => {
    const form = documentForm(payload);
    form.append("primary", "just some text");
    form.append("photo", "more text");
    const parsed = await parseDocumentMultipart(formPost(form));
    expect(parsed.primary).toBeNull();
    expect(parsed.photo).toBeNull();
    expect(parsed.fileErrors).toEqual({});
  });

  it("ignores unknown parts", async () => {
    const form = documentForm(payload);
    form.append("evil", new File([new Uint8Array(pdfBytes())], "evil.pdf"));
    form.append("status", "published");
    const parsed = await parseDocumentMultipart(formPost(form));
    expect(parsed.payload).toEqual(payload);
    expect(Object.keys(parsed.fileErrors)).toEqual([]);
  });

  it("treats the empty, nameless file a browser sends for an untouched input as no file", async () => {
    const form = documentForm(payload);
    form.append("primary", new File([], ""));
    const parsed = await parseDocumentMultipart(formPost(form));
    expect(parsed.primary).toBeNull();
    expect(parsed.fileErrors).toEqual({});
  });

  it("reports an empty named file", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: { name: "empty.pdf", type: "application/pdf", bytes: new Uint8Array(0) } })));
    expect(parsed.primary).toBeNull();
    expect(parsed.fileErrors.primary).toMatch(/empty/i);
  });

  it("refuses a file whose declared type contradicts its bytes", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: { name: "scan.png", type: "application/pdf", bytes: pngBytes() } })));
    expect(parsed.primary).toBeNull();
    expect(parsed.fileErrors.primary).toMatch(/browser reported/i);
  });

  it("refuses a file whose name contradicts its bytes", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: { name: "invoice.exe", type: "application/pdf", bytes: pdfBytes() } })));
    expect(parsed.fileErrors.primary).toMatch(/named \.exe/i);
  });

  it("refuses HTML dressed up as an image", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: { name: "logo.png", type: "image/png", bytes: html } })));
    expect(parsed.primary).toBeNull();
    expect(parsed.fileErrors.primary).toMatch(/PDF, PNG, JPEG or WEBP/);
  });

  it("refuses a file that is two formats at once", async () => {
    const polyglot = Buffer.concat([pngBytes(0), Buffer.from("%PDF-1.7 "), Buffer.alloc(100, 0x20)]);
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: { name: "x.png", type: "image/png", bytes: polyglot } })));
    expect(parsed.fileErrors.primary).toMatch(/more than one format/i);
  });

  it("refuses a PDF as a photo", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { photo: pdfFile("me.pdf") })));
    expect(parsed.photo).toBeNull();
    expect(parsed.fileErrors.photo).toMatch(/PNG, JPEG or WEBP/);
  });

  it("takes the document file limit from ADMIN_MAX_UPLOAD_MB", async () => {
    vi.stubEnv("ADMIN_MAX_UPLOAD_MB", "1");
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { primary: pdfFile("big.pdf", 1_200_000) })));
    expect(parsed.primary).toBeNull();
    expect(parsed.fileErrors.primary).toMatch(/limit is 1 MB/);

    const fits = await parseDocumentMultipart(formPost(documentForm(payload, { primary: pdfFile("ok.pdf", 900_000) })));
    expect(fits.primary).not.toBeNull();
  });

  it("holds a photo to the smaller photo limit", async () => {
    const parsed = await parseDocumentMultipart(
      formPost(documentForm(payload, { photo: { name: "me.jpg", type: "image/jpeg", bytes: jpegBytes(1_300_000) } })),
    );
    expect(parsed.photo).toBeNull();
    expect(parsed.fileErrors.photo).toMatch(/limit is 1\.2 MB/);
  });

  it("reports both an upload problem and a good upload independently", async () => {
    const parsed = await parseDocumentMultipart(
      formPost(documentForm(payload, { primary: pdfFile(), photo: { name: "me.jpg", type: "application/pdf", bytes: jpegBytes() } })),
    );
    expect(parsed.primary).not.toBeNull();
    expect(Object.keys(parsed.fileErrors)).toEqual(["photo"]);
  });

  it.each([["yesterday"], ["2026-13-45T00:00:00Z"], ["2026-03-01"], ["x".repeat(60)], ["2026-03-01T10:00:00.000Z; DROP TABLE documents"]])(
    "rejects the malformed expectedUpdatedAt %s",
    async (value) => {
      const error = await failure(parseDocumentMultipart(formPost(documentForm(payload, { fields: { expectedUpdatedAt: value } }))));
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.options.fieldMessages).toHaveProperty("expectedUpdatedAt");
    },
  );

  it("treats a blank expectedUpdatedAt as absent", async () => {
    const parsed = await parseDocumentMultipart(formPost(documentForm(payload, { fields: { expectedUpdatedAt: "  " } })));
    expect(parsed.expectedUpdatedAt).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Small request helpers                                                *
 * ------------------------------------------------------------------ */

describe("fileChange", () => {
  const upload = { filename: "a.pdf" } as InspectedUpload;

  it("keeps, removes or replaces", () => {
    expect(fileChange(null, false)).toBeUndefined();
    expect(fileChange(null, true)).toBeNull();
    expect(fileChange(upload, false)).toBe(upload);
  });

  it("lets a new upload win over a removal flag", () => {
    expect(fileChange(upload, true)).toBe(upload);
  });
});

describe("photoPlacementErrors", () => {
  it("allows a photo on a category that carries one", () => {
    expect(photoPlacementErrors("program_record", true)).toEqual({});
  });

  it("refuses a photo on a category that has none", () => {
    expect(photoPlacementErrors("financial_report", true)).toHaveProperty("photo");
    expect(photoPlacementErrors("certification", true)).toHaveProperty("photo");
  });

  it("has nothing to say when there is no photo", () => {
    expect(photoPlacementErrors("financial_report", false)).toEqual({});
  });
});

describe("resolveDocumentId and withDocumentRoute", () => {
  const id = "11111111-2222-4333-8444-555555555555";

  it("returns a well-formed id", async () => {
    expect(await resolveDocumentId({ params: Promise.resolve({ id }) })).toBe(id);
  });

  it.each([
    ["not-a-uuid"],
    [""],
    ["../../etc/passwd"],
    [`${id}x`],
    [`${id}'; DROP TABLE documents;--`],
    ["11111111-2222-4333-8444-55555555555g"],
    ["%00"],
  ])("answers NOT_FOUND for the malformed id %j", async (bad) => {
    const error = await failure(resolveDocumentId({ params: Promise.resolve({ id: bad }) }));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("threads the route context through the error envelope", async () => {
    const route = withDocumentRoute("test-scope", async (_request, requestId, context) => {
      const resolved = await resolveDocumentId(context);
      return Response.json({ resolved, requestId });
    });
    const ok = await route(new Request(URL_), { params: Promise.resolve({ id }) });
    expect((await ok.json()).resolved).toBe(id);

    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const missing = await route(new Request(URL_), { params: Promise.resolve({ id: "nope" }) });
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("NOT_FOUND");
  });
});

describe("validationFailed", () => {
  it("carries field messages and an optional summary", () => {
    const error = validationFailed({ title: "Required." }, "Fix it.");
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Fix it.");
    expect(error.options.fieldMessages).toEqual({ title: "Required." });
  });
});

/* ------------------------------------------------------------------ *
 * Store errors                                                         *
 * ------------------------------------------------------------------ */

describe("isDatabaseUnavailable", () => {
  it.each([
    ["DatabaseNotConfiguredError", new DatabaseNotConfiguredError()],
    ["a fetch failure", new TypeError("fetch failed")],
    ["a refused connection", Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" })],
    ["a DNS failure", Object.assign(new Error("x"), { code: "ENOTFOUND" })],
    ["a connection exception SQLSTATE", Object.assign(new Error("x"), { code: "08006" })],
    ["too many connections", Object.assign(new Error("x"), { code: "53300" })],
    ["a database shutting down", Object.assign(new Error("x"), { code: "57P01" })],
    ["a driver timeout", new Error("TimeoutError")],
    ["a terminated connection", new Error("Connection terminated unexpectedly")],
    ["a wrapped network error", new Error("query failed", { cause: Object.assign(new Error("x"), { code: "ETIMEDOUT" }) })],
    ["a doubly wrapped fetch failure", new Error("a", { cause: new Error("b", { cause: new TypeError("fetch failed") }) })],
  ])("recognises %s", (_name, error) => {
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it.each([
    ["a unique violation", Object.assign(new Error("duplicate key"), { code: "23505" })],
    ["a syntax error", Object.assign(new Error("syntax error at or near"), { code: "42601" })],
    ["a programming error", new TypeError("Cannot read properties of undefined")],
    ["a string", "fetch failed"],
    ["null", null],
    ["a plain object without a cause", { message: "ordinary failure" }],
  ])("does not mistake %s for an outage", (_name, error) => {
    expect(isDatabaseUnavailable(error)).toBe(false);
  });

  it("gives up on a cause chain that loops", () => {
    const loop: { cause?: unknown; message: string } = { message: "ordinary" };
    loop.cause = loop;
    expect(isDatabaseUnavailable(loop)).toBe(false);
  });
});

describe("toApiError", () => {
  it("passes an ApiError through untouched", () => {
    const original = new ApiError("NOT_FOUND");
    expect(toApiError(original)).toBe(original);
  });

  it("maps a stale write to CONFLICT", () => {
    const error = toApiError(new StaleDocumentError());
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toMatch(/changed by someone else/i);
  });

  it("maps a blocked publish to field messages, with the file reported under both names", () => {
    const error = toApiError(new PublishBlockedError({ title: "Title is required.", file: "Upload the document file before publishing." }));
    expect(error?.code).toBe("VALIDATION_FAILED");
    expect(error?.options.fieldMessages).toEqual({
      title: "Title is required.",
      file: "Upload the document file before publishing.",
      primary: "Upload the document file before publishing.",
    });
  });

  it("maps a category change to a category field message", () => {
    const error = toApiError(new DocumentCategoryChangeError());
    expect(error?.code).toBe("VALIDATION_FAILED");
    expect(error?.options.fieldMessages).toHaveProperty("category");
  });

  it("maps an outage to SERVICE_UNAVAILABLE without echoing the driver's words", () => {
    const secret = "postgres://admin:hunter2@db.internal:5432/app";
    const error = toApiError(new Error(`connect ECONNREFUSED ${secret}`));
    expect(error?.code).toBe("SERVICE_UNAVAILABLE");
    expect(error?.message).not.toContain("hunter2");
    expect(error?.message).not.toContain("postgres");
    expect(JSON.stringify(error?.logContext)).not.toContain("hunter2");
  });

  it("leaves an unknown failure for the generic handler", () => {
    expect(toApiError(new Error("boom"))).toBeNull();
  });
});

describe("runStore", () => {
  it("returns the result of a good call", async () => {
    expect(await runStore(async () => 7)).toBe(7);
  });

  it("converts known failures and rethrows the rest unchanged", async () => {
    expect((await failure(runStore(async () => { throw new StaleDocumentError(); }))).code).toBe("CONFLICT");
    const unknown = new Error("boom");
    await expect(runStore(async () => { throw unknown; })).rejects.toBe(unknown);
  });
});

describe("publishBlockedMessages", () => {
  it("does not overwrite an existing primary message", () => {
    expect(publishBlockedMessages({ file: "a", primary: "b" })).toEqual({ file: "a", primary: "b" });
  });

  it("leaves other errors alone", () => {
    expect(publishBlockedMessages({ title: "t" })).toEqual({ title: "t" });
  });
});

/* ------------------------------------------------------------------ *
 * List query string                                                    *
 * ------------------------------------------------------------------ */

describe("parseCategoryParam", () => {
  it("accepts a key or a slug", () => {
    expect(parseCategoryParam("experience_letter")).toBe("experience_letter");
    expect(parseCategoryParam("experience-letters")).toBe("experience_letter");
    expect(parseCategoryParam("financial-reports")).toBe("financial_report");
    expect(parseCategoryParam(" certification ")).toBe("certification");
  });

  it("rejects anything else", () => {
    for (const bad of ["", null, undefined, "nope", "CERTIFICATION", "certification;--"]) expect(parseCategoryParam(bad)).toBeNull();
  });
});

describe("parseListFilters", () => {
  const parse = (query: string) => parseListFilters(new URLSearchParams(query));

  it("returns no filters for an empty query", () => {
    expect(parse("")).toEqual({});
  });

  it("treats blank values as absent, as an untouched form field is", () => {
    expect(parse("category=&status=&visibility=&q=&verifiable=&limit=&offset=&sort=&expiringWithinDays=")).toEqual({});
  });

  it("reads every filter", () => {
    expect(
      parse("category=experience-letters&status=published&visibility=unlisted&q=%20bilal%20&verifiable=true&expiringWithinDays=30&limit=25&offset=50&sort=title"),
    ).toEqual({
      category: "experience_letter",
      status: "published",
      visibility: "unlisted",
      q: "bilal",
      verifiable: true,
      expiringWithinDays: 30,
      limit: 25,
      offset: 50,
      sort: "title",
    });
  });

  it("clamps the page size", () => {
    expect(parse("limit=100000").limit).toBe(200);
    expect(parse("limit=0").limit).toBe(1);
  });

  it("caps the search text and the expiry window", () => {
    expect(parse(`q=${"a".repeat(500)}`).q).toHaveLength(100);
    expect(parse("expiringWithinDays=999999999").expiringWithinDays).toBe(36_500);
  });

  it("reads verifiable=false as false, not as absent", () => {
    expect(parse("verifiable=false")).toEqual({ verifiable: false });
    expect(parse("verifiable=0")).toEqual({ verifiable: false });
  });

  it("answers 400 with a message per bad value, and never ignores a bad filter", async () => {
    try {
      parse("category=nope&status=live&visibility=secret&verifiable=perhaps&expiringWithinDays=soon&limit=ten&offset=-1&sort=random");
      throw new Error("expected a failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const { code, options } = error as ApiError;
      expect(code).toBe("VALIDATION_FAILED");
      expect(Object.keys(options.fieldMessages ?? {}).sort()).toEqual(
        ["category", "expiringWithinDays", "limit", "offset", "sort", "status", "verifiable", "visibility"].sort(),
      );
    }
  });
});

/* ------------------------------------------------------------------ *
 * Reference suggestions                                                *
 * ------------------------------------------------------------------ */

describe("suggestNextReference", () => {
  it("starts at 0001", () => {
    expect(suggestNextReference("ACV/EL", 2026, [])).toBe("ACV/EL/2026/0001");
  });

  it("goes one past the highest sequence, leaving gaps alone", () => {
    expect(suggestNextReference("ACV/EL", 2026, ["ACV/EL/2026/0003", "ACV/EL/2026/0007", "ACV/EL/2026/0001"])).toBe("ACV/EL/2026/0008");
  });

  it("ignores other years, other prefixes and other shapes", () => {
    const existing = ["ACV/EL/2025/0099", "ACV/CERT/2026/0050", "ACV-0142", "ACV/EL/2026/abc", "ACV/EL/2026/0004/x", "xACV/EL/2026/0090", "", "ACV/EL/2026/"];
    expect(suggestNextReference("ACV/EL", 2026, existing)).toBe("ACV/EL/2026/0001");
  });

  it("tolerates surrounding spaces and short sequence numbers", () => {
    expect(suggestNextReference("ACV/EL", 2026, [" ACV/EL/2026/12 "])).toBe("ACV/EL/2026/0013");
  });

  it("keeps counting past 9999", () => {
    expect(suggestNextReference("ACV/EL", 2026, ["ACV/EL/2026/9999"])).toBe("ACV/EL/2026/10000");
  });

  it("treats regular-expression characters in a prefix literally", () => {
    expect(suggestNextReference("A.B", 2026, ["AxB/2026/0005"])).toBe("A.B/2026/0001");
    expect(suggestNextReference("A.B", 2026, ["A.B/2026/0005"])).toBe("A.B/2026/0006");
  });
});

describe("collectReferenceNumbers", () => {
  it("is exported for the route and takes the prefix and year", () => {
    expect(typeof collectReferenceNumbers).toBe("function");
  });
});

/* ------------------------------------------------------------------ *
 * Workflow actions                                                     *
 * ------------------------------------------------------------------ */

describe("isDocumentAction", () => {
  it("accepts exactly the eight actions", () => {
    expect([...DOCUMENT_ACTIONS].sort()).toEqual(
      ["archive", "duplicate", "publish", "regenerate_code", "reinstate", "restore", "revoke", "unpublish"].sort(),
    );
    for (const action of DOCUMENT_ACTIONS) expect(isDocumentAction(action)).toBe(true);
  });

  it("rejects everything else", () => {
    for (const bad of ["", "delete", "PUBLISH", "publish ", null, undefined, 1, {}, ["publish"]]) expect(isDocumentAction(bad)).toBe(false);
  });
});

describe("planStatusAction", () => {
  const table: Array<[StatusAction, DocumentStatus, "set" | "noop" | "conflict", DocumentStatus?]> = [
    ["publish", "draft", "set", "published"],
    ["publish", "published", "noop"],
    ["publish", "archived", "conflict"],
    ["unpublish", "published", "set", "draft"],
    ["unpublish", "draft", "noop"],
    ["unpublish", "archived", "conflict"],
    ["archive", "draft", "set", "archived"],
    ["archive", "published", "set", "archived"],
    ["archive", "archived", "noop"],
    ["restore", "archived", "set", "draft"],
    ["restore", "draft", "noop"],
    ["restore", "published", "conflict"],
  ];

  it.each(table)("%s on a %s record is a %s", (action, current, kind, status) => {
    const plan = planStatusAction(action, current);
    expect(plan.kind).toBe(kind);
    if (plan.kind === "set") expect(plan.status).toBe(status);
    if (plan.kind === "conflict") expect(plan.message.length).toBeGreaterThan(10);
  });
});

describe("parseRevokeReason", () => {
  it("returns an empty reason when none is given", () => {
    expect(parseRevokeReason(undefined)).toBe("");
    expect(parseRevokeReason(null)).toBe("");
  });

  it("trims a text reason", () => {
    expect(parseRevokeReason("  Issued in error ")).toBe("Issued in error");
  });

  it("rejects a reason that is not text", () => {
    for (const bad of [5, true, {}, ["x"]]) {
      expect(() => parseRevokeReason(bad)).toThrow(ApiError);
    }
  });

  it("accepts 500 characters and rejects 501, counting characters not UTF-16 units", () => {
    expect(parseRevokeReason("a".repeat(500))).toHaveLength(500);
    expect(() => parseRevokeReason("a".repeat(501))).toThrow(ApiError);
    expect(Array.from(parseRevokeReason("😀".repeat(500)))).toHaveLength(500);
  });
});

/* ------------------------------------------------------------------ *
 * Responses that carry bytes                                           *
 * ------------------------------------------------------------------ */

describe("servableMimeType", () => {
  it("passes the accepted types through", () => {
    expect(servableMimeType("application/pdf", "primary")).toEqual({ contentType: "application/pdf", forceDownload: false });
    expect(servableMimeType("image/webp", "photo")).toEqual({ contentType: "image/webp", forceDownload: false });
  });

  it("downgrades anything else to an opaque download", () => {
    for (const bad of ["text/html", "image/svg+xml", "application/javascript", "", "application/pdf; charset=x"]) {
      expect(servableMimeType(bad, "primary")).toEqual({ contentType: "application/octet-stream", forceDownload: true });
    }
  });

  it("does not let a PDF pass as a photo", () => {
    expect(servableMimeType("application/pdf", "photo").forceDownload).toBe(true);
  });
});

describe("parseFileRole, wantsDownload and parseQrFormat", () => {
  it("defaults the role to primary and rejects unknown roles", () => {
    expect(parseFileRole(null)).toBe("primary");
    expect(parseFileRole("")).toBe("primary");
    expect(parseFileRole("photo")).toBe("photo");
    expect(() => parseFileRole("avatar")).toThrow(ApiError);
    expect(() => parseFileRole("PHOTO")).toThrow(ApiError);
  });

  it("reads download=1 and download=true only", () => {
    const flag = (query: string) => wantsDownload(new URLSearchParams(query));
    expect(flag("download=1")).toBe(true);
    expect(flag("download=true")).toBe(true);
    expect(flag("download=0")).toBe(false);
    expect(flag("download=")).toBe(false);
    expect(flag("")).toBe(false);
    expect(flag("download=maybe")).toBe(false);
  });

  it("defaults the QR format to svg and rejects unknown formats", () => {
    expect(parseQrFormat(null)).toBe("svg");
    expect(parseQrFormat("")).toBe("svg");
    expect(parseQrFormat("SVG")).toBe("svg");
    expect(parseQrFormat("png")).toBe("png");
    expect(() => parseQrFormat("gif")).toThrow(ApiError);
  });
});

describe("clampQrSize", () => {
  it("clamps to 128..1024", () => {
    expect(clampQrSize("1")).toBe(128);
    expect(clampQrSize("127")).toBe(128);
    expect(clampQrSize("128")).toBe(128);
    expect(clampQrSize("700")).toBe(700);
    expect(clampQrSize("1024")).toBe(1024);
    expect(clampQrSize("1025")).toBe(1024);
    expect(clampQrSize("999999")).toBe(1024);
    expect(clampQrSize("-50")).toBe(128);
  });

  it("rounds fractions", () => {
    expect(clampQrSize("256.6")).toBe(257);
  });

  it("falls back to the default for anything unreadable", () => {
    for (const bad of [null, undefined, "", "  ", "big", "NaN", "Infinity"]) expect(clampQrSize(bad)).toBe(QR_DEFAULT_SIZE);
  });
});

describe("qrFilename", () => {
  const id = "11111111-2222-4333-8444-555555555555";

  it("uses the reference number when there is one", () => {
    expect(qrFilename({ id, referenceNo: "ACV/EL/2026/0008" }, "svg")).toBe("aceva-verify-acv-el-2026-0008.svg");
    expect(qrFilename({ id, referenceNo: "ACV/EL/2026/0008" }, "png")).toBe("aceva-verify-acv-el-2026-0008.png");
  });

  it("falls back to the id", () => {
    expect(qrFilename({ id, referenceNo: "" }, "svg")).toBe(`aceva-verify-${id}.svg`);
  });

  it("reduces hostile input to safe characters", () => {
    const name = qrFilename({ id, referenceNo: '../../Étoile "x"\r\nSet-Cookie: a=b ##' }, "svg");
    expect(name).toMatch(/^aceva-verify-[a-z0-9-]+\.svg$/);
    expect(name).not.toContain("..");
  });

  it("bounds the length and never produces an empty name", () => {
    expect(qrFilename({ id, referenceNo: "A".repeat(500) }, "svg").length).toBeLessThanOrEqual("aceva-verify-".length + 60 + ".svg".length);
    expect(qrFilename({ id, referenceNo: "###" }, "svg")).toBe("aceva-verify-document.svg");
  });
});

describe("binaryResponse", () => {
  it("serves the bytes with the hardened header set", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const response = binaryResponse(bytes, { contentType: "image/png", disposition: 'inline; filename="a.png"', csp: ADMIN_FILE_CSP });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="a.png"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toBe(ADMIN_FILE_CSP);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4, 5]);
  });

  it("copies the bytes, so a pooled Buffer's neighbours are never served", async () => {
    const pool = Buffer.from("secret-neighbour-and-the-real-payload");
    const view = pool.subarray(21);
    const response = binaryResponse(view, { contentType: "image/png", disposition: "inline", csp: ADMIN_FILE_CSP });
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("the-real-payload");
  });

  it("defines the two policies the routes rely on", () => {
    expect(ADMIN_FILE_CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'",
    );
    expect(ADMIN_SVG_CSP).toBe("default-src 'none'; style-src 'unsafe-inline'");
  });
});

describe("test fixtures", () => {
  it("really are the formats they claim to be", () => {
    expect(pngFile().bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(pdfBytes().subarray(0, 5).toString()).toBe("%PDF-");
  });
});
