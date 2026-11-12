import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import * as actionsRoute from "@/app/api/admin/documents/[id]/actions/route";
import * as listRoute from "@/app/api/admin/documents/route";
import * as referenceRoute from "@/app/api/admin/documents/next-reference/route";
import { hashIp } from "@/lib/admin/auth";
import { DOCUMENT_ACTIONS, type DocumentAction } from "@/lib/admin/documentsApi";
import { CATEGORIES } from "@/lib/documents/categories";
import { getDocument, getDocumentByCode } from "@/lib/documents/store";
import { DOCUMENT_CATEGORY_KEYS, type DocumentCategory, type DocumentRecord } from "@/lib/documents/types";
import {
  API,
  CLIENT_IP,
  MISSING_ID,
  auditRows,
  clearDatabase,
  countRows,
  documentForm,
  enableAdmin,
  formRequest,
  getRequest,
  idContext,
  jsonRequest,
  payloadFor,
  pdfFile,
  startDatabase,
  stopDatabase,
  type FormParts,
  type TestDatabase,
} from "./adminDocumentsHarness";
import { requirePhoto } from "../helpers/specOverrides";

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

const CODE = /^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

async function createDoc(category: DocumentCategory, overrides: Record<string, unknown> = {}, parts: FormParts = {}): Promise<DocumentRecord> {
  const response = await listRoute.POST(await formRequest("POST", API, documentForm(payloadFor(category, overrides), parts)));
  const body = (await response.json()) as { document: DocumentRecord };
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.document;
}

/** A complete certification (it needs a document file to be publishable). */
const certificate = (overrides: Record<string, unknown> = {}) => createDoc("certification", overrides, { primary: pdfFile() });

async function act(id: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return actionsRoute.POST(await jsonRequest("POST", `${API}/${id}/actions`, body, { headers }), idContext(id));
}

async function actOk(id: string, action: DocumentAction, extra: Record<string, unknown> = {}): Promise<DocumentRecord> {
  const response = await act(id, { action, ...extra });
  const body = (await response.json()) as { ok: boolean; document: DocumentRecord };
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(body.ok).toBe(true);
  return body.document;
}

async function fresh(id: string): Promise<DocumentRecord> {
  const record = await getDocument(id);
  if (!record) throw new Error("record vanished");
  return record;
}

async function actionAudit(action: string) {
  return (await auditRows(database)).filter((row) => row.action === action);
}

async function problems(response: Response): Promise<{ status: number; code: string; messages: Record<string, string>; message: string }> {
  const body = (await response.json()) as { code: string; error: string; fieldMessages?: Record<string, string> };
  return { status: response.status, code: body.code, messages: body.fieldMessages ?? {}, message: body.error };
}

/* ------------------------------------------------------------------ *
 * publish / unpublish / archive / restore                              *
 * ------------------------------------------------------------------ */

describe("status actions", () => {
  it("publishes a complete draft", async () => {
    const draft = await certificate();
    const published = await actOk(draft.id, "publish");

    expect(published.status).toBe("published");
    expect(published.publishedAt).toMatch(ISO);
    expect(published.updatedAt > draft.updatedAt).toBe(true);
    expect((await fresh(draft.id)).status).toBe("published");

    const [entry] = await actionAudit("document.publish");
    expect(entry).toMatchObject({ entity_type: "document", entity_id: draft.id, actor: `admin:${hashIp(CLIENT_IP)}` });
    expect(entry.detail).toMatchObject({ title: draft.title, category: "certification", statusFrom: "draft", statusTo: "published" });
  });

  it("refuses to publish a record that has no document file, with field messages, and changes nothing", async () => {
    const draft = await createDoc("financial_report");
    const response = await act(draft.id, { action: "publish" });
    const { status, code, messages } = await problems(response);

    expect(status).toBe(400);
    expect(code).toBe("VALIDATION_FAILED");
    expect(messages.file).toMatch(/upload/i);
    expect(messages.primary).toBe(messages.file);
    expect((await fresh(draft.id)).status).toBe("draft");
    expect(await actionAudit("document.publish")).toEqual([]);
  });

  it("refuses to publish a record without a photo where its category requires one", async () => {
    // No shipped category requires a photo, so the requirement is switched on for one category here.
    onTestFinished(requirePhoto("program_record"));
    const draft = await createDoc("program_record");
    const { status, messages } = await problems(await act(draft.id, { action: "publish" }));
    expect(status).toBe(400);
    expect(messages.photo).toMatch(/photo/i);
    expect((await fresh(draft.id)).status).toBe("draft");
  });

  it("publishes a people record without a photo, because its category does not require one", async () => {
    const draft = await createDoc("program_record");
    expect((await actOk(draft.id, "publish")).status).toBe("published");
  });

  it("re-checks the publish rules against what is stored, not what was once valid", async () => {
    const draft = await certificate();
    await database.db.query("UPDATE documents SET title = '' WHERE id = $1", [draft.id]);
    const { status, messages } = await problems(await act(draft.id, { action: "publish" }));
    expect(status).toBe(400);
    expect(messages.title).toMatch(/required/i);
    expect((await fresh(draft.id)).status).toBe("draft");
  });

  it("unpublishes to draft", async () => {
    const draft = await certificate({ status: "published" });
    const back = await actOk(draft.id, "unpublish");
    expect(back.status).toBe("draft");
    expect((await actionAudit("document.unpublish"))[0].detail).toMatchObject({ statusFrom: "published", statusTo: "draft" });
  });

  it("archives from draft and from published", async () => {
    const draft = await certificate();
    expect((await actOk(draft.id, "archive")).status).toBe("archived");

    // Two certificates cannot share a number, so the second names its own.
    const published = await certificate({ status: "published", title: "Live one", referenceNo: "ACV/CERT/2026/0099" });
    expect((await actOk(published.id, "archive")).status).toBe("archived");
    expect(await actionAudit("document.archive")).toHaveLength(2);
  });

  it("restores an archived record to draft, not to published", async () => {
    const published = await certificate({ status: "published" });
    await actOk(published.id, "archive");
    const restored = await actOk(published.id, "restore");
    expect(restored.status).toBe("draft");
    expect((await actionAudit("document.restore"))[0].detail).toMatchObject({ statusFrom: "archived", statusTo: "draft" });
  });

  it("walks the whole lifecycle", async () => {
    const draft = await certificate();
    const steps: Array<[DocumentAction, string]> = [
      ["publish", "published"],
      ["archive", "archived"],
      ["restore", "draft"],
      ["publish", "published"],
      ["unpublish", "draft"],
    ];
    for (const [action, expected] of steps) expect((await actOk(draft.id, action)).status).toBe(expected);
  });

  describe("repeating an action", () => {
    it.each([
      ["publish", "published"],
      ["unpublish", "draft"],
      ["archive", "archived"],
      ["restore", "draft"],
    ] as const)("%s on a record that is already %s changes nothing and writes no audit entry", async (action, status) => {
      const draft = await certificate({ status: status === "published" ? "published" : "draft" });
      if (status === "archived") await actOk(draft.id, "archive");
      const before = await fresh(draft.id);
      const auditBefore = (await auditRows(database)).length;

      const again = await actOk(draft.id, action);

      expect(again.status).toBe(status);
      expect(again.updatedAt).toBe(before.updatedAt);
      expect((await auditRows(database)).length).toBe(auditBefore);
    });
  });

  describe("transitions the lifecycle does not allow", () => {
    it("will not publish an archived record", async () => {
      const draft = await certificate();
      await actOk(draft.id, "archive");
      const { status, code, message } = await problems(await act(draft.id, { action: "publish" }));
      expect(status).toBe(409);
      expect(code).toBe("CONFLICT");
      expect(message).toMatch(/restore/i);
      expect((await fresh(draft.id)).status).toBe("archived");
    });

    it("will not restore a published record (that would silently take it offline)", async () => {
      const published = await certificate({ status: "published" });
      const { status, code } = await problems(await act(published.id, { action: "restore" }));
      expect(status).toBe(409);
      expect(code).toBe("CONFLICT");
      expect((await fresh(published.id)).status).toBe("published");
    });

    it("will not unpublish an archived record", async () => {
      const draft = await certificate();
      await actOk(draft.id, "archive");
      expect((await act(draft.id, { action: "unpublish" })).status).toBe(409);
    });
  });
});

/* ------------------------------------------------------------------ *
 * revoke / reinstate                                                   *
 * ------------------------------------------------------------------ */

describe("revoke and reinstate", () => {
  it("revokes with a reason, leaving the status alone", async () => {
    const published = await certificate({ status: "published" });
    const revoked = await actOk(published.id, "revoke", { reason: "  Issued to the wrong person  " });

    expect(revoked.revokedAt).toMatch(ISO);
    expect(revoked.revokedReason).toBe("Issued to the wrong person");
    expect(revoked.status).toBe("published");
    expect(revoked.verificationCode).toBe(published.verificationCode);

    const [entry] = await actionAudit("document.revoke");
    expect(entry).toMatchObject({ entity_id: published.id });
    expect(entry.detail).toMatchObject({ title: published.title, category: "certification", reason: "Issued to the wrong person" });
  });

  it("revokes without a reason", async () => {
    const doc = await certificate();
    const revoked = await actOk(doc.id, "revoke");
    expect(revoked.revokedAt).toMatch(ISO);
    expect(revoked.revokedReason).toBe("");
  });

  it("keeps the first revocation time when revoked again, and takes the new reason", async () => {
    const doc = await certificate();
    const first = await actOk(doc.id, "revoke", { reason: "First" });
    const second = await actOk(doc.id, "revoke", { reason: "Second" });
    expect(second.revokedAt).toBe(first.revokedAt);
    expect(second.revokedReason).toBe("Second");
  });

  it("rejects a reason that is too long or not text, before touching the record", async () => {
    const doc = await certificate();
    const tooLong = await problems(await act(doc.id, { action: "revoke", reason: "x".repeat(501) }));
    expect(tooLong.status).toBe(400);
    expect(tooLong.messages).toHaveProperty("reason");
    for (const reason of [42, true, { text: "x" }, ["x"]]) {
      const response = await act(doc.id, { action: "revoke", reason });
      expect(response.status).toBe(400);
    }
    expect((await fresh(doc.id)).revokedAt).toBeNull();
    expect(await actionAudit("document.revoke")).toEqual([]);
  });

  it("ignores a reason sent with some other action", async () => {
    const doc = await certificate();
    expect((await actOk(doc.id, "archive", { reason: 12345 })).status).toBe("archived");
  });

  it("reinstates a revoked record", async () => {
    const doc = await certificate();
    await actOk(doc.id, "revoke", { reason: "Mistake" });
    const reinstated = await actOk(doc.id, "reinstate");

    expect(reinstated.revokedAt).toBeNull();
    expect(reinstated.revokedReason).toBe("");
    expect(await actionAudit("document.reinstate")).toHaveLength(1);
  });

  it("treats reinstating a record that is not revoked as a no-op", async () => {
    const doc = await certificate();
    const again = await actOk(doc.id, "reinstate");
    expect(again.updatedAt).toBe(doc.updatedAt);
    expect(await actionAudit("document.reinstate")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * regenerate_code                                                      *
 * ------------------------------------------------------------------ */

describe("regenerate_code", () => {
  it("replaces the code, and the old one stops resolving at once", async () => {
    const doc = await certificate({ status: "published" });
    const oldCode = doc.verificationCode;
    expect(oldCode).toMatch(CODE);

    const updated = await actOk(doc.id, "regenerate_code");

    expect(updated.verificationCode).toMatch(CODE);
    expect(updated.verificationCode).not.toBe(oldCode);
    expect(await getDocumentByCode(oldCode ?? "")).toBeNull();
    expect((await getDocumentByCode(updated.verificationCode ?? ""))?.id).toBe(doc.id);
  });

  it("issues a code to a record that had none", async () => {
    const doc = await createDoc("financial_report");
    expect(doc.verificationCode).toBeNull();
    const updated = await actOk(doc.id, "regenerate_code");
    expect(updated.verificationCode).toMatch(CODE);
    expect((await actionAudit("document.regenerate_code"))[0].detail).toMatchObject({ hadCode: false });
  });

  it("leaves the revocation alone", async () => {
    const doc = await certificate();
    await actOk(doc.id, "revoke", { reason: "Mistake" });
    const updated = await actOk(doc.id, "regenerate_code");
    expect(updated.revokedAt).toMatch(ISO);
  });

  it("does not write either code into the audit log", async () => {
    const doc = await certificate();
    const updated = await actOk(doc.id, "regenerate_code");
    const [entry] = await actionAudit("document.regenerate_code");
    const text = JSON.stringify(entry);
    expect(text).not.toContain(doc.verificationCode ?? "no-code");
    expect(text).not.toContain(updated.verificationCode ?? "no-code");
    expect(entry.detail).toMatchObject({ title: doc.title, category: "certification", hadCode: true });
  });
});

/* ------------------------------------------------------------------ *
 * duplicate                                                            *
 * ------------------------------------------------------------------ */

describe("duplicate", () => {
  it("answers with the NEW record: a draft copy with its own id, code and file copies", async () => {
    const source = await certificate({ status: "published", featured: true });
    const copy = await actOk(source.id, "duplicate");

    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe(`${source.title} (copy)`);
    expect(copy.status).toBe("draft");
    expect(copy.featured).toBe(false);
    expect(copy.referenceNo).toBe("");
    expect(copy.category).toBe("certification");
    expect(copy.verificationCode).toMatch(CODE);
    expect(copy.verificationCode).not.toBe(source.verificationCode);
    expect(copy.files).toHaveLength(1);
    expect(copy.files[0].id).not.toBe(source.files[0].id);
    expect(copy.files[0].sha256).toBe(source.files[0].sha256);

    expect(await countRows(database, "documents")).toBe(2);
    expect(await countRows(database, "document_files")).toBe(2);
    const original = await fresh(source.id);
    expect(original.status).toBe("published");
    expect(original.title).toBe(source.title);
  });

  it("does not invent a code for a record that has none", async () => {
    const source = await createDoc("financial_report", {}, { primary: pdfFile() });
    expect((await actOk(source.id, "duplicate")).verificationCode).toBeNull();
  });

  it("does not carry a person's consent to the copy", async () => {
    const source = await createDoc("program_record", { visibility: "public", data: { ...(payloadFor("program_record").data as object), consent_to_publish: true } });
    const copy = await actOk(source.id, "duplicate");
    expect(copy.visibility).toBe("unlisted");
    expect(copy.data.consent_to_publish).toBeUndefined();
  });

  it("is logged against the copy, with a pointer back to its source", async () => {
    const source = await certificate();
    const copy = await actOk(source.id, "duplicate");
    const [entry] = await actionAudit("document.duplicate");
    expect(entry).toMatchObject({ entity_type: "document", entity_id: copy.id });
    expect(entry.detail).toMatchObject({ title: copy.title, category: "certification", sourceId: source.id, sourceTitle: source.title });
  });
});

/* ------------------------------------------------------------------ *
 * The request itself                                                   *
 * ------------------------------------------------------------------ */

describe("POST /api/admin/documents/[id]/actions: the request", () => {
  it("knows exactly the nine actions of the contract", () => {
    expect([...DOCUMENT_ACTIONS].sort()).toEqual(
      ["archive", "duplicate", "publish", "regenerate_code", "reinstate", "restore", "revoke", "stamp_file", "unpublish"],
    );
  });

  it.each(DOCUMENT_ACTIONS)("%s answers 404 for a record that does not exist", async (action) => {
    const { status, code } = await problems(await act(MISSING_ID, { action }));
    expect(status).toBe(404);
    expect(code).toBe("NOT_FOUND");
    expect(await auditRows(database)).toEqual([]);
  });

  it.each([
    [{}],
    [{ action: "" }],
    [{ action: "delete" }],
    [{ action: "PUBLISH" }],
    [{ action: " publish" }],
    [{ action: 7 }],
    [{ action: null }],
    [{ action: ["publish"] }],
    [{ action: { name: "publish" } }],
  ])("rejects the body %j with a message against `action`", async (body) => {
    const doc = await certificate();
    const { status, code, messages } = await problems(await act(doc.id, body));
    expect(status).toBe(400);
    expect(code).toBe("VALIDATION_FAILED");
    expect(Object.keys(messages)).toEqual(["action"]);
    expect((await fresh(doc.id)).status).toBe("draft");
  });

  it("rejects bodies that are not a JSON object", async () => {
    const doc = await certificate();
    for (const raw of ["[]", "null", '"publish"', "42", "{broken"]) {
      const response = await act(doc.id, raw);
      expect(response.status, raw).toBe(400);
      expect(((await response.json()) as { code: string }).code).toBe("INVALID_JSON");
    }
  });

  it("rejects a body that is not JSON by content type", async () => {
    const doc = await certificate();
    const authed = await jsonRequest("POST", `${API}/${doc.id}/actions`, {});
    const request = new Request(`${API}/${doc.id}/actions`, {
      method: "POST",
      headers: { "content-type": "text/plain", cookie: authed.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action: "archive" }),
    });
    const response = await actionsRoute.POST(request, idContext(doc.id));
    expect(response.status).toBe(415);
    expect((await fresh(doc.id)).status).toBe("draft");
  });

  it("rejects an oversize body", async () => {
    const doc = await certificate();
    const response = await act(doc.id, { action: "revoke", reason: "x".repeat(10_000) });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { code: string }).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("ignores extra fields", async () => {
    const doc = await certificate();
    const archived = await actOk(doc.id, "archive", { status: "published", id: MISSING_ID, verificationCode: "ACV-AAAA-AAAA-AAAA" });
    expect(archived.id).toBe(doc.id);
    expect(archived.status).toBe("archived");
    expect(archived.verificationCode).toBe(doc.verificationCode);
  });

  it("returns record JSON without file contents", async () => {
    const doc = await certificate();
    const response = await act(doc.id, { action: "duplicate" });
    const text = await response.text();
    expect(text).not.toContain("%PDF");
    expect(text).not.toContain("JVBERi");
  });
});

/* ------------------------------------------------------------------ *
 * next-reference                                                       *
 * ------------------------------------------------------------------ */

describe("GET /api/admin/documents/next-reference", () => {
  const year = new Date().getUTCFullYear();

  async function suggestion(query: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await referenceRoute.GET(await getRequest(`${API}/next-reference${query}`));
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it("starts at 0001 for every category's own prefix", async () => {
    for (const category of DOCUMENT_CATEGORY_KEYS) {
      const { status, body } = await suggestion(`?category=${category}`);
      expect(status).toBe(200);
      expect(body).toEqual({ ok: true, suggestion: `${CATEGORIES[category].referencePrefix}/${year}/0001` });
    }
  });

  it("goes one past the highest sequence used this year", async () => {
    await createDoc("experience_letter", { referenceNo: `ACV/EL/${year}/0003` }, { primary: pdfFile() });
    await createDoc("experience_letter", { referenceNo: `ACV/EL/${year}/0007`, holderName: "Another Person" }, { primary: pdfFile() });
    await createDoc("experience_letter", { referenceNo: `ACV/EL/${year - 1}/0099`, holderName: "Last Year" }, { primary: pdfFile() });
    await createDoc("experience_letter", { referenceNo: "HAND-TYPED-12", holderName: "Odd Format" }, { primary: pdfFile() });

    const { body } = await suggestion("?category=experience_letter");
    expect(body.suggestion).toBe(`ACV/EL/${year}/0008`);
  });

  it("accepts the category's admin URL slug too", async () => {
    await createDoc("experience_letter", { referenceNo: `ACV/EL/${year}/0001` }, { primary: pdfFile() });
    expect((await suggestion("?category=experience-letters")).body.suggestion).toBe(`ACV/EL/${year}/0002`);
  });

  it("counts every record that shares the prefix, whatever its category", async () => {
    // A certification that carries a letter-style reference still counts towards the letters' sequence.
    await createDoc("certification", { referenceNo: `ACV/EL/${year}/0004` }, { primary: pdfFile() });
    expect((await suggestion("?category=experience_letter")).body.suggestion).toBe(`ACV/EL/${year}/0005`);
    expect((await suggestion("?category=certification")).body.suggestion).toBe(`ACV/CERT/${year}/0001`);
  });

  it("is not thrown off by a title that merely mentions a reference", async () => {
    await createDoc("financial_report", { title: `Notes on ACV/FIN/${year}/0500`, referenceNo: "" }, { primary: pdfFile() });
    expect((await suggestion("?category=financial_report")).body.suggestion).toBe(`ACV/FIN/${year}/0001`);
  });

  it("looks past the first page of records", async () => {
    // 205 references in one year, newest first: the highest sequence is the OLDEST row, so it sits on the second page of 200.
    const values: string[] = [];
    for (let n = 1; n <= 205; n += 1) values.push(`('financial_report', 'Report ${n}', 'private', 'ACV/FIN/${year}/${String(n).padStart(4, "0")}', now() - interval '${n} seconds')`);
    await database.db.query(`INSERT INTO documents (category, title, visibility, reference_no, created_at) VALUES ${values.join(",")}`);
    expect((await suggestion("?category=financial_report")).body.suggestion).toBe(`ACV/FIN/${year}/0206`);
  });

  it.each([[""], ["?category="], ["?category=nope"], ["?category=CERTIFICATION"], ["?category=certification%27%3B--"]])("answers 400 for %j", async (query) => {
    const { status, body } = await suggestion(query);
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldMessages).toHaveProperty("category");
  });
});
