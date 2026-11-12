import { describe, expect, it } from "vitest";
import {
  baseDomId,
  classifyFailure,
  controlDomId,
  errorKeyOrder,
  fieldDomId,
  interpretActionResponse,
  interpretSaveResponse,
  labelForKey,
  mapFieldMessages,
  parseJsonSafely,
  readDocument,
  readSuggestion,
  settingDomId,
  summariseErrors,
  type ErrorContext,
} from "@/components/admin/editor/editorErrors";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/errorCodes";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";

const ID = "0b9d3a52-6f5e-4c1a-9a53-1f2f7d0a4b11";

const create: ErrorContext = { mode: "create", verificationSwitch: true };
const edit: ErrorContext = { mode: "edit", verificationSwitch: false };

function record(category: DocumentCategory = "certification", overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    category,
    title: "T",
    summary: "",
    status: "draft",
    visibility: "public",
    allowDownload: false,
    featured: false,
    sortOrder: 0,
    holderName: "",
    referenceNo: "",
    issuedOn: null,
    expiresOn: null,
    verificationCode: null,
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function envelope(code: ApiErrorCode, extra: Partial<ApiErrorBody> = {}): ApiErrorBody {
  return { ok: false, error: `message for ${code}`, code, retryable: false, requestId: "req_test", ...extra };
}

describe("errorKeyOrder", () => {
  it("lists controls in the order they appear on the page", () => {
    const order = errorKeyOrder("certification", create);
    expect(order.indexOf("title")).toBeLessThan(order.indexOf("holderName"));
    expect(order.indexOf("holderName")).toBeLessThan(order.indexOf("direction"));
    expect(order.indexOf("direction")).toBeLessThan(order.indexOf("primary"));
    expect(order.indexOf("primary")).toBeLessThan(order.indexOf("visibility"));
    expect(order).not.toContain("photo");
    expect(order).not.toContain("status");
    expect(order).toContain("enableVerification");
  });

  it("only includes the controls that exist for this mode and category", () => {
    expect(errorKeyOrder("certification", edit)).toContain("status");
    expect(errorKeyOrder("certification", edit)).not.toContain("enableVerification");
    expect(errorKeyOrder("financial_report", edit)).not.toContain("holderName");
    expect(errorKeyOrder("program_record", create)).toContain("photo");
    expect(errorKeyOrder("certification", create)).not.toContain("photo");
    expect(errorKeyOrder("program_record", create)).toContain("consent_to_publish");
    expect(errorKeyOrder("program_record", create).indexOf("photo")).toBeLessThan(errorKeyOrder("program_record", create).indexOf("consent_to_publish"));
  });

  it("has no duplicates in any category", () => {
    for (const spec of CATEGORY_LIST) {
      const order = errorKeyOrder(spec.key, create);
      expect(new Set(order).size, spec.key).toBe(order.length);
    }
  });
});

describe("control ids", () => {
  it("never collide between a base column, a category field and a setting", () => {
    for (const spec of CATEGORY_LIST) {
      const ids = errorKeyOrder(spec.key, { mode: "edit", verificationSwitch: true }).map((key) => controlDomId(spec.key, key));
      expect(new Set(ids).size, spec.key).toBe(ids.length);
    }
  });

  it("prefixes by kind", () => {
    expect(controlDomId("certification", "title")).toBe(baseDomId("title"));
    expect(controlDomId("certification", "direction")).toBe(fieldDomId("direction"));
    expect(controlDomId("certification", "visibility")).toBe(settingDomId("visibility"));
    expect(controlDomId("certification", "primary")).toBe("ed-primary");
  });
});

describe("labelForKey", () => {
  it("uses the category's own wording", () => {
    expect(labelForKey("experience_letter", "holderName")).toBe("Employee / intern name");
    expect(labelForKey("certification", "issuing_body")).toBe("Issuing body");
    expect(labelForKey("certification", "primary")).toBe("Document file");
    expect(labelForKey("certification", "mystery")).toBeNull();
  });
});

describe("mapFieldMessages", () => {
  it("puts a message next to the control it belongs to", () => {
    const mapped = mapFieldMessages("certification", { title: "Certification title is required.", direction: "Choose one of the listed options." }, create);
    expect(mapped.fields).toEqual({ title: "Certification title is required.", direction: "Choose one of the listed options." });
    expect(mapped.general).toEqual([]);
    expect(mapped.order).toEqual(["title", "direction"]);
  });

  it("orders by page position, whatever order the server sent", () => {
    const mapped = mapFieldMessages("certification", { visibility: "v", direction: "d", title: "t", file: "f" }, create);
    expect(mapped.order).toEqual(["title", "direction", "primary", "visibility"]);
  });

  it("treats the publish gate's `file` as the document drop zone, and keeps the first of two", () => {
    expect(mapFieldMessages("certification", { file: "Upload the document file before publishing." }, create).fields.primary).toBe(
      "Upload the document file before publishing.",
    );
    expect(mapFieldMessages("certification", { primary: "That file is empty.", file: "other" }, create).fields.primary).toBe("That file is empty.");
  });

  it("sends messages with no control to the general list, naming the field when it can", () => {
    const mapped = mapFieldMessages(
      "financial_report",
      { holderName: "Entity is required.", form: "The request body must be an object.", status: "Choose Draft, Published or Archived.", mystery: "Odd." },
      create,
    );
    expect(mapped.fields).toEqual({});
    expect(mapped.general).toEqual([
      "Entity: Entity is required.",
      "The request body must be an object.",
      "Publication status: Choose Draft, Published or Archived.",
      "Odd.",
    ]);
  });

  it("shows a status error inline in edit mode only", () => {
    expect(mapFieldMessages("certification", { status: "x" }, edit).fields.status).toBe("x");
    expect(mapFieldMessages("certification", { status: "x" }, create).fields.status).toBeUndefined();
  });

  it("shows a photo error only for categories with a photo", () => {
    expect(mapFieldMessages("program_record", { photo: "Upload a photo before publishing." }, create).fields.photo).toBeTruthy();
    expect(mapFieldMessages("certification", { photo: "nope" }, create).fields.photo).toBeUndefined();
  });

  it("drops empty and non-string messages", () => {
    const mapped = mapFieldMessages("certification", { title: "  ", level: 5 as unknown as string }, create);
    expect(mapped.fields).toEqual({});
    expect(mapped.general).toEqual([]);
  });

  it("maps the consent switch inline for categories that have one", () => {
    expect(mapFieldMessages("program_record", { consent_to_publish: "needed" }, create).fields.consent_to_publish).toBe("needed");
  });
});

describe("summariseErrors", () => {
  it("lists each problem with the label a person knows it by", () => {
    const mapped = mapFieldMessages("certification", { referenceNo: "Certificate no. is required.", title: "Certification title is required." }, create);
    expect(summariseErrors("certification", mapped)).toEqual([
      { key: "title", label: "Certification title", message: "Certification title is required." },
      { key: "referenceNo", label: "Certificate no.", message: "Certificate no. is required." },
    ]);
  });
});

describe("parseJsonSafely", () => {
  it("parses JSON and returns null for everything else", () => {
    expect(parseJsonSafely('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonSafely("")).toBeNull();
    expect(parseJsonSafely("<html>502</html>")).toBeNull();
  });
});

describe("readDocument", () => {
  it("accepts a record-shaped value", () => {
    expect(readDocument(record())?.id).toBe(ID);
  });

  it("rejects anything it would have to guess about", () => {
    expect(readDocument(null)).toBeNull();
    expect(readDocument("x")).toBeNull();
    expect(readDocument([])).toBeNull();
    expect(readDocument(record("certification", { id: "123" }))).toBeNull();
    expect(readDocument(record("certification", { category: "invoice" }))).toBeNull();
    expect(readDocument(record("certification", { status: "live" }))).toBeNull();
    expect(readDocument(record("certification", { visibility: "secret" }))).toBeNull();
    expect(readDocument(record("certification", { data: null }))).toBeNull();
    expect(readDocument(record("certification", { files: {} }))).toBeNull();
    expect(readDocument(record("certification", { updatedAt: 5 }))).toBeNull();
  });
});

describe("classifyFailure", () => {
  it("reads the canonical envelope", () => {
    const invalid = classifyFailure(400, envelope("VALIDATION_FAILED", { fieldMessages: { title: "Required." } }));
    expect(invalid).toMatchObject({ type: "invalid", fieldMessages: { title: "Required." } });

    expect(classifyFailure(409, envelope("CONFLICT")).type).toBe("conflict");
    expect(classifyFailure(401, envelope("UNAUTHENTICATED")).type).toBe("signed_out");
    expect(classifyFailure(404, envelope("NOT_FOUND")).type).toBe("not_found");
    expect(classifyFailure(413, envelope("PAYLOAD_TOO_LARGE")).type).toBe("too_large");
  });

  it("carries the retry delay on a rate limit", () => {
    const limited = classifyFailure(429, envelope("RATE_LIMITED", { retryAfter: 12 }));
    expect(limited).toMatchObject({ type: "rate_limited", retryAfter: 12 });
    expect(limited.message).toMatch(/12/);
  });

  it("marks retryable server failures", () => {
    expect(classifyFailure(500, envelope("INTERNAL_ERROR", { retryable: true }))).toMatchObject({ type: "failed", retryable: true });
    expect(classifyFailure(403, envelope("FORBIDDEN_ORIGIN"))).toMatchObject({ type: "failed", retryable: false });
  });

  it("falls back to the status when there is no envelope", () => {
    expect(classifyFailure(401, null).type).toBe("signed_out");
    expect(classifyFailure(404, "<html>").type).toBe("not_found");
    expect(classifyFailure(409, undefined).type).toBe("conflict");
    expect(classifyFailure(413, null).type).toBe("too_large");
    expect(classifyFailure(429, null).type).toBe("rate_limited");
    expect(classifyFailure(502, null)).toMatchObject({ type: "failed", retryable: true });
    expect(classifyFailure(400, null)).toMatchObject({ type: "failed", retryable: false });
  });

  it("never exposes raw detail for a sign-out", () => {
    const signedOut = classifyFailure(401, { ...envelope("UNAUTHENTICATED"), error: "secret internal reason" });
    expect(signedOut.message).not.toContain("secret");
  });
});

describe("interpretSaveResponse", () => {
  it("returns the saved record", () => {
    const outcome = interpretSaveResponse(201, { ok: true, document: record() });
    expect(outcome.type).toBe("saved");
    if (outcome.type === "saved") expect((outcome.document as DocumentRecord).id).toBe(ID);
  });

  it("does not trust a success that carries no usable record", () => {
    expect(interpretSaveResponse(200, { ok: true }).type).toBe("failed");
    expect(interpretSaveResponse(200, { ok: true, document: { id: "x" } }).type).toBe("failed");
  });

  it("turns a validation failure into field messages", () => {
    const outcome = interpretSaveResponse(400, envelope("VALIDATION_FAILED", { fieldMessages: { primary: "That file is empty." } }));
    expect(outcome).toMatchObject({ type: "invalid", fieldMessages: { primary: "That file is empty." } });
  });

  it("recognises an edit conflict", () => {
    expect(interpretSaveResponse(409, envelope("CONFLICT")).type).toBe("conflict");
  });

  it("does not treat a 200 with ok:false as a save", () => {
    expect(interpretSaveResponse(200, { ok: false }).type).not.toBe("saved");
  });
});

describe("interpretActionResponse", () => {
  it("returns the record an action produced, or null for a delete", () => {
    const withDocument = interpretActionResponse(200, { ok: true, document: record() });
    expect(withDocument.type).toBe("done");
    if (withDocument.type === "done") expect(withDocument.document?.id).toBe(ID);

    const deleted = interpretActionResponse(200, { ok: true });
    expect(deleted).toEqual({ type: "done", document: null });
  });

  it("surfaces failures", () => {
    expect(interpretActionResponse(409, envelope("CONFLICT")).type).toBe("conflict");
    expect(interpretActionResponse(400, envelope("VALIDATION_FAILED", { fieldMessages: { reason: "Too long." } }))).toMatchObject({
      type: "invalid",
      fieldMessages: { reason: "Too long." },
    });
  });
});

describe("readSuggestion", () => {
  it("accepts a usable suggestion", () => {
    expect(readSuggestion(200, { ok: true, suggestion: " ACV/EL/2026/0008 " })).toBe("ACV/EL/2026/0008");
  });

  it("rejects everything else", () => {
    expect(readSuggestion(500, { ok: true, suggestion: "x" })).toBeNull();
    expect(readSuggestion(200, { ok: false })).toBeNull();
    expect(readSuggestion(200, { ok: true, suggestion: "" })).toBeNull();
    expect(readSuggestion(200, { ok: true, suggestion: "x".repeat(81) })).toBeNull();
    expect(readSuggestion(200, { ok: true, suggestion: 5 })).toBeNull();
    expect(readSuggestion(200, null)).toBeNull();
  });
});

describe("the specs themselves", () => {
  it("every category field has a label the summary can use", () => {
    for (const spec of CATEGORY_LIST) {
      for (const field of spec.fields) expect(labelForKey(spec.key, field.key), `${spec.key}.${field.key}`).toBe(field.label);
      expect(CATEGORIES[spec.key]).toBe(spec);
    }
  });
});
