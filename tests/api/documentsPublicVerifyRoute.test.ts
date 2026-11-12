import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "@/app/api/verify/[code]/route";
import { runVerifyLookup } from "@/components/documents/verifyLookup";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { createDocument, getDocument, revokeDocument, setDocumentStatus } from "@/lib/documents/store";
import type { DocumentCategory } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { RATE_LIMIT_RULES, resetRateLimitStore } from "@/lib/rateLimit";
import { createPgliteSql } from "../helpers/pgliteSql";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";
const ORIGIN = "https://aceva.test";
const UNKNOWN_CODE = "ACV-0000-0000-0000";

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
  ipCounter += 1;
  currentIp = `198.51.100.${ipCounter % 250}`;
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
    data: { direction: "held", issuing_body: "BSI", level: "Level 2", skills: ["security"], credential_url: "https://example.com/credential" },
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
      contact_email: "aisha.private@example.com",
      internal_notes: "SECRET-NOTE-FOR-TEAM-ONLY",
      bio: "Builds things.",
    },
  },
  experience_letter: {
    title: "Experience letter",
    holderName: "Bilal Ahmed",
    referenceNo: "ACV/EL/2026/0007",
    issuedOn: "2026-02-01",
    data: {
      designation: "Software Engineer",
      employment_type: "full_time",
      start_date: "2024-01-01",
      currently_employed: true,
      signatory_name: "Head of People",
      responsibilities: "SECRET-RESPONSIBILITIES",
      remarks: "SECRET-REMARKS",
    },
  },
};

function input(category: DocumentCategory, top: Record<string, unknown> = {}): DocumentInput {
  const base = VALID[category];
  const result = validateDocumentInput(
    { status: "published", enableVerification: true, allowDownload: true, ...base, ...top, data: { ...(base.data as object), ...((top.data as object) ?? {}) } },
    { category },
  );
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return result.value;
}

let sequence = 0;
function pdf(): InspectedUpload {
  sequence += 1;
  const body = Buffer.from(Array.from({ length: 1200 }, (_, i) => 0x41 + ((i * 7 + sequence) % 26)));
  const result = inspectUpload({ name: "paper.pdf", bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]) }, "primary");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

async function seed(category: DocumentCategory, top: Record<string, unknown> = {}) {
  return createDocument(input(category, top), { primary: pdf() });
}

function ask(code: string, headers: Record<string, string> = {}): Promise<Response> {
  return GET(new Request(`${ORIGIN}/api/verify/${encodeURIComponent(code)}`, { headers: { "x-forwarded-for": currentIp, ...headers } }), {
    params: Promise.resolve({ code }),
  });
}

type Body = { ok: boolean; state: string; document?: Record<string, unknown>; checkedAt?: string; code?: string; requestId?: string; retryAfter?: number };

async function lookup(code: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Body; response: Response }> {
  const response = await ask(code, headers);
  return { status: response.status, body: (await response.json()) as Body, response };
}

/* ------------------------------------------------------------------ *
 * What a lookup returns                                                *
 * ------------------------------------------------------------------ */

describe("GET /api/verify/[code]: a record that can be shown", () => {
  it("returns the public projection, a timestamp, and no-store with no CORS", async () => {
    const record = await seed("certification");
    const { status, body, response } = await lookup(record.verificationCode as string);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.state).toBe("valid");
    expect(body.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(body.document).toMatchObject({
      id: record.id,
      category: "certification",
      title: "ISO/IEC 27001:2022",
      holderName: "ACEVA Technology",
      referenceNo: "ACV/CERT/2026/0042",
      state: "valid",
      verificationCode: record.verificationCode,
      hasFile: true,
      hasPhoto: false,
    });
    expect((body.document?.file as { sha256: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("accepts the code in any spelling", async () => {
    const record = await seed("certification");
    const code = record.verificationCode as string;
    for (const spelled of [code, code.toLowerCase(), code.replaceAll("-", ""), code.replaceAll("-", " ")]) {
      const { body } = await lookup(spelled);
      expect(body.state, spelled).toBe("valid");
    }
  });

  it("answers an unlisted record by its code", async () => {
    const record = await seed("experience_letter", { visibility: "unlisted" });
    const { body } = await lookup(record.verificationCode as string);
    expect(body.state).toBe("valid");
    expect(body.document).toMatchObject({ category: "experience_letter", holderName: "Bilal Ahmed" });
  });

  it("never carries admin-only data", async () => {
    const person = await seed("program_record");
    const letter = await seed("experience_letter", { visibility: "unlisted" });
    for (const record of [person, letter]) {
      const response = await ask(record.verificationCode as string);
      const text = await response.text();
      for (const secret of [
        "aisha.private@example.com",
        "SECRET-NOTE-FOR-TEAM-ONLY",
        "SECRET-RESPONSIBILITIES",
        "SECRET-REMARKS",
        "contact_email",
        "internal_notes",
        "consent_to_publish",
        "responsibilities",
        "revokedReason",
      ]) {
        expect(text, secret).not.toContain(secret);
      }
    }
  });

  it("reports an expired record as expired, still with its details", async () => {
    const record = await seed("certification", { issuedOn: "2019-01-01", expiresOn: "2020-01-01" });
    const { body } = await lookup(record.verificationCode as string);
    expect(body.state).toBe("expired");
    expect(body.document).toMatchObject({ state: "expired", title: "ISO/IEC 27001:2022", expiresOn: "2020-01-01" });
  });

  it("reports a revoked record with only the minimal view", async () => {
    const record = await seed("certification");
    await revokeDocument(record.id, "SECRET-REASON");
    const { body, response } = await lookup(record.verificationCode as string);
    expect(body.state).toBe("revoked");
    expect(body.document).toMatchObject({
      title: "ISO/IEC 27001:2022",
      referenceNo: "ACV/CERT/2026/0042",
      state: "revoked",
      holderName: "",
      summary: "",
      hasFile: false,
      file: null,
      verificationCode: null,
      fields: {},
    });
    expect(body.document?.revokedAt).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("SECRET-REASON");
    expect(response.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ *
 * What a lookup refuses to confirm                                     *
 * ------------------------------------------------------------------ */

describe("GET /api/verify/[code]: not found, and no way to tell why", () => {
  it("answers an unknown, a malformed and a hidden code with exactly the same response", async () => {
    const draft = await seed("certification", { status: "draft" });
    const archived = await seed("certification");
    await setDocumentStatus(archived.id, "archived");
    const hidden = await seed("certification", { visibility: "private" });

    const codes = [
      UNKNOWN_CODE,
      "nonsense",
      "ACV",
      "",
      "ACV-UUUU-UUUU-UUUU",
      "x".repeat(300),
      draft.verificationCode as string,
      archived.verificationCode as string,
      hidden.verificationCode as string,
    ];
    const results = await Promise.all(codes.map((code) => lookup(code)));

    for (const { status, body, response } of results) {
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.state).toBe("not_found");
      expect("document" in body).toBe(false);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const normalised = results.map(({ body }) => ({ ...body, checkedAt: undefined }));
    for (const shape of normalised) expect(shape).toEqual(normalised[0]);
  });
});

/* ------------------------------------------------------------------ *
 * Logging, privacy of the lookup itself                                *
 * ------------------------------------------------------------------ */

describe("GET /api/verify/[code]: what is recorded", () => {
  it("counts a visible lookup, stores the address only as a keyed hash, and keeps just the code's last four characters", async () => {
    const record = await seed("certification");
    const code = record.verificationCode as string;
    await lookup(code);

    const stored = await getDocument(record.id);
    expect(stored?.verifyCount).toBe(1);

    const events = await db.query<{ result: string; ip_hash: string; code_suffix: string }>("SELECT result, ip_hash, code_suffix FROM verification_events");
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].result).toBe("valid");
    expect(events.rows[0].code_suffix).toBe(code.slice(-4));
    expect(events.rows[0].ip_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(events.rows[0].ip_hash).not.toContain(currentIp);
    expect(JSON.stringify(events.rows)).not.toContain(code);
  });

  it("does not count a lookup of a hidden record, and does not write anything for a malformed code", async () => {
    const draft = await seed("certification", { status: "draft" });
    await lookup(draft.verificationCode as string);
    await lookup("nonsense");
    const stored = await getDocument(draft.id);
    expect(stored?.verifyCount).toBe(0);

    const events = await db.query<{ result: string }>("SELECT result FROM verification_events");
    // the hidden lookup is logged as not_found (for the team); the malformed one never reaches the database
    expect(events.rows.map((row) => row.result)).toEqual(["not_found"]);
  });
});

/* ------------------------------------------------------------------ *
 * Limits and failures                                                  *
 * ------------------------------------------------------------------ */

describe("GET /api/verify/[code]: limits and failures", () => {
  it("rate-limits one address after its budget, charging malformed codes too", async () => {
    const budget = RATE_LIMIT_RULES["verify-lookup"];
    for (let i = 0; i < budget; i += 1) {
      expect((await ask("nonsense")).status).toBe(200);
    }
    const limited = await lookup(UNKNOWN_CODE);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.body.retryAfter).toBeGreaterThan(0);
    expect(limited.response.headers.get("retry-after")).toBe(String(limited.body.retryAfter));
    expect("state" in limited.body).toBe(false);

    const other = await lookup(UNKNOWN_CODE, { "x-forwarded-for": "192.0.2.200" });
    expect(other.status).toBe(200);
  });

  it("answers 503 with generic copy, never a verdict, when the registry is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const record = await seed("certification");
    resetDocumentTablesCache();
    setSqlClientForTests(async () => {
      throw new Error("password authentication failed for user secretuser at db.internal");
    });
    const { status, body, response } = await lookup(record.verificationCode as string);
    expect(status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect("state" in body).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/secretuser|db\.internal|password/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    resetDocumentTablesCache();
  });

  it("still answers when the lookup log cannot be written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const record = await seed("certification");
    await db.exec("ALTER TABLE verification_events RENAME TO verification_events_gone");
    try {
      const { body } = await lookup(record.verificationCode as string);
      expect(body.state).toBe("valid");
    } finally {
      await db.exec("ALTER TABLE verification_events_gone RENAME TO verification_events");
    }
  });

  it("answers other methods with a JSON 405, and OPTIONS with a bare 204 that grants no cross-origin access", async () => {
    for (const handler of [POST, PUT, PATCH, DELETE]) {
      const response = await handler(new Request(`${ORIGIN}/api/verify/${UNKNOWN_CODE}`, { method: "POST" }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toContain("GET");
    }
    const options = OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBeNull();
    expect(options.headers.get("access-control-allow-methods")).toBeNull();
  });
});

describe("runVerifyLookup", () => {
  it("reports a spent budget as rate_limited with a positive wait, before touching the database", async () => {
    const budget = RATE_LIMIT_RULES["verify-lookup"];
    const spy = vi.fn(async () => []);
    setSqlClientForTests(spy);
    for (let i = 0; i < budget; i += 1) await runVerifyLookup("nonsense", "203.0.113.250");
    const outcome = await runVerifyLookup("nonsense", "203.0.113.250");
    expect(outcome.kind).toBe("rate_limited");
    if (outcome.kind === "rate_limited") expect(outcome.retryAfter).toBeGreaterThan(0);
    // malformed codes never reach SQL at all
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns a result with a fresh timestamp for a found record", async () => {
    const record = await seed("certification");
    const before = Date.now();
    const outcome = await runVerifyLookup(record.verificationCode as string, "203.0.113.251");
    expect(outcome.kind).toBe("result");
    if (outcome.kind === "result") {
      expect(outcome.state).toBe("valid");
      expect(Date.parse(outcome.checkedAt)).toBeGreaterThanOrEqual(before - 1000);
    }
  });
});
