import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  loadDailyLookups,
  loadDashboardData,
  loadLookupLog,
  probeDatabase,
  scanVerificationEvents,
} from "@/components/admin/pages/data";
import { utcDayOffset } from "@/components/admin/pages/format";
import { buildLedgerRow } from "@/components/admin/pages/rowModel";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { EXPIRING_SOON_DAYS, createDocument, getDocument, revokeDocument } from "@/lib/documents/store";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { validateDocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";
import { requirePhoto } from "../helpers/specOverrides";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * The console's data loaders run against a real (in-memory) Postgres: they derive daily totals, result
 * filters and the attention rules from the store's own queries, so the seams between them are where
 * a mistake would hide.
 */

let pg: Awaited<ReturnType<typeof createPgliteSql>>;
let sql: SqlClient;

beforeAll(async () => {
  pg = await createPgliteSql();
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
  await pg.db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

const FIXTURES: Record<"certification" | "financial_report" | "program_record", Record<string, unknown>> = {
  certification: {
    title: "ISO/IEC 27001",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2025-01-10",
    data: { direction: "held", issuing_body: "BSI" },
  },
  financial_report: {
    title: "FY 2025-26 Statements",
    issuedOn: "2026-01-10",
    data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" },
  },
  program_record: {
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", start_date: "2026-06-01", record_status: "active" },
  },
};

async function seed(category: keyof typeof FIXTURES, top: Record<string, unknown> = {}): Promise<DocumentRecord> {
  const result = validateDocumentInput({ ...FIXTURES[category], ...top }, { category: category as DocumentCategory });
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return createDocument(result.value);
}

/** Inserts lookups `daysAgo` days back (at noon UTC so a day boundary never splits them). */
async function lookups(count: number, daysAgo: number, result: string, documentId: string | null = null): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await pg.db.query(
      `INSERT INTO verification_events (at, result, document_id, code_suffix)
       VALUES (date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => $1::int) + interval '12 hours', $2, $3::uuid, 'ABCD')`,
      [daysAgo, result, documentId],
    );
  }
}

describe("scanVerificationEvents", () => {
  it("reads everything when the log is short", async () => {
    await lookups(3, 0, "valid");
    await lookups(2, 5, "not_found");
    const scan = await scanVerificationEvents();
    expect(scan.events).toHaveLength(5);
    expect(scan.total).toBe(5);
    expect(scan.truncated).toBe(false);
  });

  it("is empty and not truncated for an empty log", async () => {
    expect(await scanVerificationEvents()).toEqual({ events: [], total: 0, truncated: false });
  });

  it("stops once a page reaches back past the window", async () => {
    await lookups(150, 1, "valid");
    await lookups(150, 40, "valid");
    const scan = await scanVerificationEvents({ sinceDay: utcDayOffset(new Date(), -13) });
    // The first 200-row page already spans the window edge, so the scan ends there rather than reading all 300.
    expect(scan.events).toHaveLength(200);
    expect(scan.truncated).toBe(false);
    expect(scan.events.filter((event) => event.at.slice(0, 10) >= utcDayOffset(new Date(), -13))).toHaveLength(150);
  });

  it("says so when the cap cut it short", async () => {
    await lookups(260, 0, "valid");
    const scan = await scanVerificationEvents({ maxEvents: 200 });
    expect(scan.events.length).toBeGreaterThanOrEqual(200);
    expect(scan.events.length).toBeLessThan(260);
    expect(scan.total).toBe(260);
    expect(scan.truncated).toBe(true);
  });

  it("can be limited to one record", async () => {
    const a = await seed("certification");
    const b = await seed("financial_report");
    await lookups(3, 0, "valid", a.id);
    await lookups(5, 0, "valid", b.id);
    expect((await scanVerificationEvents({ documentId: a.id })).events).toHaveLength(3);
  });
});

describe("loadDailyLookups", () => {
  it("counts lookups per UTC day over the window, with empty days present", async () => {
    await lookups(4, 0, "valid");
    await lookups(2, 3, "not_found");
    await lookups(9, 30, "valid"); // outside the 14-day window
    const { points, truncated } = await loadDailyLookups(new Date());
    expect(points).toHaveLength(14);
    expect(points.at(-1)?.count).toBe(4);
    expect(points.find((point) => point.date === utcDayOffset(new Date(), -3))?.count).toBe(2);
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(6);
    expect(truncated).toBe(false);
  });
});

describe("loadLookupLog", () => {
  it("pages straight from the database when no result is chosen", async () => {
    await lookups(30, 0, "valid");
    const first = await loadLookupLog({ result: null, doc: null, page: 1 });
    expect(first.events).toHaveLength(25);
    expect(first.pagination).toMatchObject({ total: 30, pages: 2, page: 1 });
    const second = await loadLookupLog({ result: null, doc: null, page: 2 });
    expect(second.events).toHaveLength(5);
    expect(second.truncated).toBe(false);
  });

  it("filters by result and counts only the matches", async () => {
    await lookups(4, 0, "valid");
    await lookups(7, 1, "not_found");
    await lookups(1, 2, "revoked");
    const log = await loadLookupLog({ result: "not_found", doc: null, page: 1 });
    expect(log.events).toHaveLength(7);
    expect(log.events.every((event) => event.result === "not_found")).toBe(true);
    expect(log.pagination.total).toBe(7);
  });

  it("filters by record and by result together", async () => {
    const a = await seed("certification");
    const b = await seed("financial_report");
    await lookups(3, 0, "valid", a.id);
    await lookups(2, 0, "revoked", a.id);
    await lookups(6, 0, "valid", b.id);
    const log = await loadLookupLog({ result: "valid", doc: a.id, page: 1 });
    expect(log.events).toHaveLength(3);
    expect(log.events.every((event) => event.documentId === a.id)).toBe(true);
  });

  it("clamps a page past the end and returns nothing for a record that does not exist", async () => {
    await lookups(3, 0, "valid");
    expect((await loadLookupLog({ result: "valid", doc: null, page: 9 })).pagination.clamped).toBe(true);
    expect(await loadLookupLog({ result: null, doc: "99999999-9999-4999-8999-999999999999", page: 1 })).toMatchObject({ events: [], pagination: { total: 0 } });
  });
});

describe("loadDashboardData", () => {
  it("is quiet for an empty registry", async () => {
    const data = await loadDashboardData(new Date());
    expect(data.stats.totals.total).toBe(0);
    expect(data.attention).toEqual([]);
    expect(data.attentionComplete).toBe(true);
    expect(data.daily?.points).toHaveLength(14);
  });

  it("raises each attention rule from real records", async () => {
    const now = new Date();
    // No shipped category requires a photo, so the requirement is switched on for one category for this test.
    onTestFinished(requirePhoto("program_record"));
    // 1. Published, expired 10 days ago, still public (needs a file to publish: add one by direct insert).
    const stale = await seed("certification", { expiresOn: utcDayOffset(now, -10) });
    // 2. A draft people record with no photo can never be published once its category asks for one.
    const stuck = await seed("program_record");
    // 3. A draft certification expiring in 20 days.
    const expiring = await seed("certification", { title: "Expiring soon cert", expiresOn: utcDayOffset(now, 20), referenceNo: "ACV/CERT/2026/0099" });

    await pg.db.query(
      `INSERT INTO document_files (document_id, role, filename, mime_type, size_bytes, sha256, data)
       VALUES ($1::uuid, 'primary', 'a.pdf', 'application/pdf', 4, $2, decode('25504446', 'hex'))`,
      [stale.id, "0".repeat(64)],
    );
    await pg.db.query("UPDATE documents SET status = 'published', visibility = 'public' WHERE id = $1::uuid", [stale.id]);

    const data = await loadDashboardData(now);
    const kinds = data.attention.map((group) => group.kind);
    expect(kinds).toContain("expiring");
    expect(kinds).toContain("missing_file");
    expect(kinds).toContain("expired_published");

    const missing = data.attention.find((group) => group.kind === "missing_file");
    expect(missing?.items.map((item) => item.id)).toContain(stuck.id);
    expect(missing?.items.find((item) => item.id === stuck.id)?.detail).toBe("Missing a photo");

    const expired = data.attention.find((group) => group.kind === "expired_published");
    expect(expired?.items.map((item) => item.id)).toEqual([stale.id]);

    const soon = data.attention.find((group) => group.kind === "expiring");
    expect(soon?.items.map((item) => item.id)).toEqual(expect.arrayContaining([expiring.id]));
    expect(soon?.items.map((item) => item.id)).not.toContain(stuck.id);
    expect(soon?.items.map((item) => item.id)).not.toContain(stale.id);
  });
});

describe("probeDatabase", () => {
  it("reports a healthy database with its tables and stored files", async () => {
    await seed("certification");
    const probe = await probeDatabase();
    expect(probe.reachable).toBe(true);
    expect(probe.tablesMissing).toEqual([]);
    expect(probe.documents).toBe(1);
    expect(probe.files).toEqual({ count: 0, bytes: 0 });
  });

  it("creates what is missing and says it did", async () => {
    await pg.db.exec("DROP TABLE verification_events");
    resetDocumentTablesCache();
    const probe = await probeDatabase();
    expect(probe.reachable).toBe(true);
    expect(probe.tablesCreated).toContain("verification_events");
    expect(probe.tablesMissing).toEqual([]);
  });

  it("reports an unreachable database as a verdict rather than throwing", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: SqlClient = () => Promise.reject(new Error("connect ECONNREFUSED postgres://user:secret@db.example:5432/app"));
    setSqlClientForTests(broken);
    resetDocumentTablesCache();
    const probe = await probeDatabase();
    expect(probe).toMatchObject({ reachable: false, tablesCreated: null, tablesMissing: null, documents: null, files: null });
    // The log line names the failure class and never the driver's message, which can hold the connection string.
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("postgres://");
  });
});

describe("buildLedgerRow", () => {
  const now = new Date();

  it("summarises a record for the list", async () => {
    const created = await seed("certification", { expiresOn: utcDayOffset(now, 20) });
    const row = buildLedgerRow(created, now, EXPIRING_SOON_DAYS);
    expect(row.title).toBe("ISO/IEC 27001");
    expect(row.subtitle).toBe("ACEVA Technology · ACV/CERT/2026/0042");
    expect(row.categoryLabel).toBe("Certification");
    expect(row.validity).toBe("valid");
    expect(row.expiry.tone).toBe("soon");
    expect(row.missing).toEqual(["No file"]);
    expect(row.files).toEqual([]);
    expect(row.target.verifyUrl).toMatch(/\/verify\/ACV-/);
    expect(row.target.revoked).toBe(false);
  });

  it("shows a record without a QR code as such, and carries no verify link", async () => {
    const created = await seed("financial_report");
    const row = buildLedgerRow(created, now, EXPIRING_SOON_DAYS);
    expect(row.validity).toBe("off");
    expect(row.target.verifyUrl).toBeNull();
    expect(row.expires).toBeNull();
  });

  it("reports revocation and expiry over validity", async () => {
    const created = await seed("certification", { expiresOn: utcDayOffset(now, -3) });
    expect(buildLedgerRow(created, now, EXPIRING_SOON_DAYS).validity).toBe("expired");
    await revokeDocument(created.id, "Issued in error");
    const revoked = await getDocument(created.id);
    if (!revoked) throw new Error("record vanished");
    const row = buildLedgerRow(revoked, now, EXPIRING_SOON_DAYS);
    expect(row.validity).toBe("revoked");
    expect(row.target.revoked).toBe(true);
  });
});
