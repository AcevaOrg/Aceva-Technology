import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "@/app/api/documents/[id]/file/route";
import { getAdminCookieName } from "@/lib/admin/config";
import { createSessionToken } from "@/lib/admin/session";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { FILE_RESPONSE_CSP } from "@/lib/documents/access";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { createDocument, reinstateDocument, revokeDocument, setDocumentStatus } from "@/lib/documents/store";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { RATE_LIMIT_RULES, resetRateLimitStore } from "@/lib/rateLimit";
import { createPgliteSql } from "../helpers/pgliteSql";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const ORIGIN = "https://aceva.test";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

let pg: Awaited<ReturnType<typeof createPgliteSql>>;
let db: PGlite;
let sql: SqlClient;
let ipCounter = 0;
let currentIp = "";

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
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  resetRateLimitStore();
  // Every test is a different visitor, so the shared in-process rate limiter never couples them.
  ipCounter += 1;
  currentIp = `203.0.113.${ipCounter % 250}`;
  await db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

const VALID: Record<string, Record<string, unknown>> = {
  certification: {
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    data: { direction: "held", issuing_body: "BSI" },
  },
  program_record: {
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: {
      hierarchy_level: "trainee",
      role_title: "Frontend Intern",
      record_kind: "intern",
      program_name: "Summer 2026",
      start_date: "2026-06-01",
      record_status: "active",
      consent_to_publish: true,
      show_photo: true,
    },
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
  const result = validateDocumentInput(
    { status: "published", enableVerification: true, allowDownload: true, ...base, ...numbered, ...top, data: { ...(base.data as object), ...data } },
    { category },
  );
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return result.value;
}

let sequence = 0;
function pdfBytes(): Buffer {
  sequence += 1;
  const body = Buffer.from(Array.from({ length: 1500 }, (_, i) => 0x41 + ((i * 7 + sequence) % 26)));
  return Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]);
}

function pdf(): InspectedUpload {
  const result = inspectUpload({ name: "paper.pdf", bytes: pdfBytes() }, "primary");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

function jpeg(): InspectedUpload {
  const result = inspectUpload({ name: "portrait.jpg", bytes: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(800)]) }, "photo");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

async function seed(category: DocumentCategory, top: Record<string, unknown> = {}, data: Record<string, unknown> = {}, withPhoto = false) {
  const primary = pdf();
  const photo = withPhoto ? jpeg() : undefined;
  const record = await createDocument(input(category, top, data), { primary, photo });
  return { record, primary, photo };
}

function ask(id: string, query = "", headers: Record<string, string> = {}): Promise<Response> {
  const url = `${ORIGIN}/api/documents/${id}/file${query ? `?${query}` : ""}`;
  return GET(new Request(url, { headers: { "x-forwarded-for": currentIp, ...headers } }), { params: Promise.resolve({ id }) });
}

/** The JSON body of an error, minus the per-request id that is meant to differ. */
async function errorShape(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
}

async function adminCookie(): Promise<string> {
  return `${getAdminCookieName()}=${await createSessionToken()}`;
}

/* ------------------------------------------------------------------ *
 * Successful responses                                                 *
 * ------------------------------------------------------------------ */

describe("GET /api/documents/[id]/file: what a visitor may have", () => {
  it("serves a published public document with its type, hardening headers and a shared-cache lifetime", async () => {
    const { record, primary } = await seed("certification");
    const response = await ask(record.id);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(primary.bytes)).toBe(true);

    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^inline; filename="paper\.pdf"; filename\*=UTF-8''paper\.pdf$/);
    expect(response.headers.get("content-length")).toBe(String(primary.bytes.length));
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(FILE_RESPONSE_CSP);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("answers ?download=1 as an attachment", async () => {
    const { record } = await seed("certification");
    const response = await ask(record.id, "download=1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="paper\.pdf"/);
  });

  it("still serves an expired record, which the verify page shows as expired", async () => {
    const { record } = await seed("certification", { issuedOn: "2019-01-01", expiresOn: "2020-01-01" });
    expect((await ask(record.id)).status).toBe(200);
  });

  it("serves a consenting person's photo, and not their document when download is off", async () => {
    const { record } = await seed("program_record", { allowDownload: false, visibility: "public" }, {}, true);
    const photo = await ask(record.id, "role=photo");
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/jpeg");
    expect(photo.headers.get("cache-control")).toBe("public, max-age=300");
    expect((await ask(record.id, "role=primary")).status).toBe(404);
  });

  it("serves unlisted records only with the right code, and never lets a shared cache keep them", async () => {
    const { record } = await seed("experience_letter", { visibility: "unlisted" });
    const code = record.verificationCode as string;
    for (const spelled of [code, code.toLowerCase(), code.replaceAll("-", "")]) {
      const response = await ask(record.id, `code=${encodeURIComponent(spelled)}`);
      expect(response.status, spelled).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("serves an unlisted person's photo with the code", async () => {
    const { record } = await seed("program_record", { visibility: "unlisted" }, {}, true);
    const code = record.verificationCode as string;
    expect((await ask(record.id, "role=photo")).status).toBe(404);
    expect((await ask(record.id, `role=photo&code=${code}`)).status).toBe(200);
  });

  it("forces anything that is not a known document type to download as opaque bytes", async () => {
    const { record } = await seed("certification");
    await db.exec(`UPDATE document_files SET mime_type = 'text/html' WHERE document_id = '${record.id}'`);
    const response = await ask(record.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
  });
});

/* ------------------------------------------------------------------ *
 * Refusals: every one is the same 404                                  *
 * ------------------------------------------------------------------ */

describe("GET /api/documents/[id]/file: what a visitor may not have", () => {
  it("refuses a draft, an archived record and a private record", async () => {
    const draft = await seed("certification", { status: "draft" });
    const archived = await seed("certification");
    await setDocumentStatus(archived.record.id, "archived");
    const hidden = await seed("certification", { visibility: "private" });
    for (const { record } of [draft, archived, hidden]) {
      const code = record.verificationCode as string;
      expect((await ask(record.id)).status).toBe(404);
      expect((await ask(record.id, `code=${code}`)).status).toBe(404);
    }
  });

  it("refuses an unlisted record without a code, with a wrong code, and with a malformed one", async () => {
    const { record } = await seed("experience_letter", { visibility: "unlisted" });
    expect((await ask(record.id)).status).toBe(404);
    expect((await ask(record.id, "code=ACV-0000-0000-0000")).status).toBe(404);
    expect((await ask(record.id, "code=nonsense")).status).toBe(404);
    expect((await ask(record.id, `code=${"A".repeat(5000)}`)).status).toBe(404);
  });

  it("refuses a revoked record, even to the code holder, and serves it again once reinstated", async () => {
    const { record } = await seed("certification");
    const code = record.verificationCode as string;
    await revokeDocument(record.id, "issued in error");
    expect((await ask(record.id, `code=${code}`)).status).toBe(404);
    expect((await ask(record.id)).status).toBe(404);
    await reinstateDocument(record.id);
    expect((await ask(record.id)).status).toBe(200);
  });

  it("refuses the document when public download is disabled, but the code does not override that", async () => {
    const { record } = await seed("certification", { allowDownload: false });
    expect((await ask(record.id)).status).toBe(404);
    expect((await ask(record.id, `code=${record.verificationCode}`)).status).toBe(404);
  });

  it("refuses a photo without show_photo, and a photo without recorded consent", async () => {
    const hiddenPhoto = await seed("program_record", { visibility: "public" }, { show_photo: false }, true);
    expect((await ask(hiddenPhoto.record.id, "role=photo")).status).toBe(404);

    const noConsent = await seed("program_record", { visibility: "unlisted" }, {}, true);
    // Consent is withdrawn after the fact and the record is (wrongly) left public: the URL alone must not serve it.
    await db.exec(
      `UPDATE documents SET visibility = 'public', data = data - 'consent_to_publish' WHERE id = '${noConsent.record.id}'`,
    );
    expect((await ask(noConsent.record.id, "role=photo")).status).toBe(404);
    // ... while the person's own code still opens the page that names them, and so the photo with it.
    expect((await ask(noConsent.record.id, `role=photo&code=${noConsent.record.verificationCode}`)).status).toBe(200);
  });

  it("refuses ids that are not ids, ids that are unknown, and roles that are not roles", async () => {
    const { record } = await seed("certification");
    for (const id of ["not-a-uuid", "..%2F..%2Fetc%2Fpasswd", "1", "", "undefined", `${record.id}x`, MISSING_ID, record.id.toUpperCase().slice(0, -1)]) {
      expect((await ask(id)).status, id).toBe(404);
    }
    for (const role of ["thumbnail", "Primary", "primary,photo", "../photo"]) {
      expect((await ask(record.id, `role=${encodeURIComponent(role)}`)).status, role).toBe(404);
    }
  });

  it("gives missing, hidden and forbidden records the very same response, so existence cannot be probed", async () => {
    const draft = await seed("certification", { status: "draft" });
    const privateRecord = await seed("certification", { visibility: "private" });
    const unlisted = await seed("experience_letter", { visibility: "unlisted" });
    const noDownload = await seed("certification", { allowDownload: false });
    const revoked = await seed("certification");
    await revokeDocument(revoked.record.id, "x");

    const attempts: Array<Promise<Response>> = [
      ask(MISSING_ID),
      ask("not-a-uuid"),
      ask(draft.record.id),
      ask(privateRecord.record.id),
      ask(unlisted.record.id),
      ask(unlisted.record.id, "code=ACV-0000-0000-0000"),
      ask(noDownload.record.id),
      ask(revoked.record.id),
      ask(draft.record.id, "role=photo"),
    ];
    const responses = await Promise.all(attempts);
    const shapes = await Promise.all(responses.map(errorShape));

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    for (const shape of shapes) expect(shape).toEqual(shapes[0]);
    expect(shapes[0]).toMatchObject({ ok: false, code: "NOT_FOUND" });
    // nothing in the body names the record, its state or the reason
    expect(JSON.stringify(shapes[0])).not.toMatch(/draft|private|unlisted|revoked|download|consent|archived/i);
  });

  it("returns 404, not 500, when the stored bytes fail their integrity check", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { record } = await seed("certification");
    await db.exec(`UPDATE document_files SET sha256 = '${"0".repeat(64)}' WHERE document_id = '${record.id}'`);
    expect((await ask(record.id)).status).toBe(404);
  });
});

/* ------------------------------------------------------------------ *
 * Admin sessions                                                       *
 * ------------------------------------------------------------------ */

describe("GET /api/documents/[id]/file: with an admin session", () => {
  it("serves a draft, but never lets a shared cache keep it", async () => {
    const { record, primary } = await seed("certification", { status: "draft" });
    const response = await ask(record.id, "", { cookie: await adminCookie() });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(primary.bytes)).toBe(true);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not cache a public record publicly when the admin sees what visitors may not", async () => {
    const { record } = await seed("certification", { allowDownload: false });
    expect((await ask(record.id)).status).toBe(404);
    const response = await ask(record.id, "", { cookie: await adminCookie() });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("caches a public record the same way for an admin as for anyone, since the bytes are the same", async () => {
    const { record } = await seed("certification");
    const response = await ask(record.id, "", { cookie: await adminCookie() });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("treats a bad or expired cookie as an ordinary visitor, never as an error", async () => {
    const { record } = await seed("certification", { status: "draft" });
    const expired = await createSessionToken({ now: Date.now() - 3_600_000, ttlSeconds: 60 });
    for (const cookie of [`${getAdminCookieName()}=garbage`, `${getAdminCookieName()}=${expired}`, "other=1"]) {
      expect((await ask(record.id, "", { cookie })).status, cookie).toBe(404);
    }
  });

  it("works for visitors, and ignores a session cookie, when the console is disabled", async () => {
    const cookie = await adminCookie();
    const open = await seed("certification");
    const draft = await seed("certification", { status: "draft" });
    vi.stubEnv("ADMIN_PASSKEY", "");
    expect((await ask(open.record.id, "", { cookie })).status).toBe(200);
    expect((await ask(draft.record.id, "", { cookie })).status).toBe(404);
  });
});

/* ------------------------------------------------------------------ *
 * Abuse and failure                                                    *
 * ------------------------------------------------------------------ */

describe("GET /api/documents/[id]/file: limits and failures", () => {
  it("rate-limits one address after its budget, leaving other visitors alone", async () => {
    const budget = RATE_LIMIT_RULES["documents-file"];
    for (let i = 0; i < budget; i += 1) {
      expect((await ask("not-a-uuid")).status).toBe(404);
    }
    const limited = await ask("not-a-uuid");
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as { code: string; retryAfter: number };
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(limited.headers.get("retry-after")).toBe(String(body.retryAfter));

    const other = await ask("not-a-uuid", "", { "x-forwarded-for": "198.51.100.77" });
    expect(other.status).toBe(404);
  });

  it("answers 503 with generic copy, and leaks no detail, when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { record } = await seed("certification");
    resetDocumentTablesCache();
    setSqlClientForTests(async () => {
      throw new Error("connection to postgres://user:secret@db.internal failed");
    });
    const response = await ask(record.id);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("SERVICE_UNAVAILABLE");
    expect(text).not.toMatch(/secret|postgres|db\.internal/);
    resetDocumentTablesCache();
  });

  it("answers other methods with a JSON 405 and OPTIONS with 204", async () => {
    for (const handler of [POST, PUT, PATCH, DELETE]) {
      const response = await handler(new Request(`${ORIGIN}/api/documents/${MISSING_ID}/file`, { method: "POST" }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toContain("GET");
    }
    const options = await OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("stored records stay what the privacy rules assume", () => {
  it("a seeded certification really is public, published and downloadable", async () => {
    const { record } = await seed("certification");
    const fresh: DocumentRecord = record;
    expect([fresh.status, fresh.visibility, fresh.allowDownload]).toEqual(["published", "public", true]);
  });
});
