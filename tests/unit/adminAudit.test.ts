import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPgliteSql } from "../helpers/pgliteSql";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { listAdminEvents, logAdminEvent, sanitizeAuditDetail } from "@/lib/admin/audit";
import { ensureAdminTables } from "@/lib/admin/tables";

describe("sanitizeAuditDetail", () => {
  it("returns null when there is nothing to store", () => {
    expect(sanitizeAuditDetail(undefined)).toBeNull();
    expect(sanitizeAuditDetail({})).toBeNull();
    expect(sanitizeAuditDetail({ password: "x" })).toBeNull();
  });

  it("drops credential-looking keys at every depth, in any case", () => {
    const clean = sanitizeAuditDetail({
      title: "Annual report",
      passkey: "p",
      PASSWORD: "p",
      userPass: "p",
      sessionToken: "t",
      csrf_token: "t",
      client_secret: "s",
      Cookie: "c",
      authorization: "Bearer abc",
      nested: { ok: 1, token: "t", deeper: { Authorization: "a", fine: true } },
      list: [{ secret: "s", keep: "k" }],
    });
    expect(clean).toEqual({
      title: "Annual report",
      nested: { ok: 1, deeper: { fine: true } },
      list: [{ keep: "k" }],
    });
    expect(JSON.stringify(clean)).not.toMatch(/Bearer|"p"|"t"|"s"|"c"/);
  });

  it("replaces binary data with its size instead of storing it", () => {
    const clean = sanitizeAuditDetail({
      file: new Uint8Array(1234),
      buffer: Buffer.from("pdf bytes"),
      raw: new ArrayBuffer(8),
      nested: { bytes: new Uint8Array(3) },
    });
    expect(clean).toEqual({
      file: "[binary 1234 bytes]",
      buffer: "[binary 9 bytes]",
      raw: "[binary 8 bytes]",
      nested: { bytes: "[binary 3 bytes]" },
    });
  });

  it("keeps JSON-safe primitives and normalises the rest", () => {
    const date = new Date("2026-03-04T05:06:07.000Z");
    const clean = sanitizeAuditDetail({
      n: 1,
      nan: Number.NaN,
      b: false,
      nil: null,
      date,
      big: BigInt(5),
      fn: () => 1,
      undef: undefined,
      sym: Symbol("x"),
    });
    expect(clean).toEqual({ n: 1, nan: null, b: false, nil: null, date: "2026-03-04T05:06:07.000Z", big: "5" });
  });

  it("bounds string length, depth, key count and array length", () => {
    const clean = sanitizeAuditDetail({ long: "a".repeat(600) }) as { long: string };
    expect(clean.long).toHaveLength(501);
    expect(clean.long.endsWith("…")).toBe(true);

    const deep = sanitizeAuditDetail({ a: { b: { c: { d: { e: { f: 1 } } } } } });
    expect(JSON.stringify(deep)).toContain("[truncated]");
    expect(JSON.stringify(deep)).not.toContain('"f"');

    const wide: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) wide[`k${i}`] = i;
    expect(Object.keys(sanitizeAuditDetail(wide) as object)).toHaveLength(50);

    const list = sanitizeAuditDetail({ items: Array.from({ length: 500 }, (_, i) => i) }) as { items: number[] };
    expect(list.items).toHaveLength(50);
  });

  it("collapses an oversized payload to a marker", () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 50; i += 1) big[`key${i}`] = "x".repeat(500);
    expect(sanitizeAuditDetail(big)).toEqual({ truncated: true });
  });

  it("survives a circular structure", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    const clean = sanitizeAuditDetail(loop);
    expect(clean).toBeTruthy();
    expect(() => JSON.stringify(clean)).not.toThrow();
  });
});

describe("audit log (Postgres)", () => {
  let db: PGlite;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const pg = await createPgliteSql();
    db = pg.db;
    close = pg.close;
    setSqlClientForTests(pg.sql);
    await ensureAdminTables();
  }, 30_000);

  afterAll(async () => {
    setSqlClientForTests(null);
    await close();
  });

  beforeEach(async () => {
    await db.query("DELETE FROM admin_audit_log");
  });

  it("records an event and reads it back", async () => {
    await logAdminEvent({
      action: "document.create",
      entityType: "document",
      entityId: "doc-1",
      actor: "admin:abcdef0123456789",
      detail: { category: "certification", title: "ISO 9001" },
    });
    const { events, total } = await listAdminEvents();
    expect(total).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: expect.stringMatching(/^\d+$/),
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      action: "document.create",
      entityType: "document",
      entityId: "doc-1",
      actor: "admin:abcdef0123456789",
      detail: { category: "certification", title: "ISO 9001" },
    });
    expect(Math.abs(new Date(events[0].at).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("stores nulls and an empty actor when the optional fields are omitted", async () => {
    await logAdminEvent({ action: "logout" });
    const { events } = await listAdminEvents();
    expect(events[0]).toMatchObject({ action: "logout", entityType: null, entityId: null, actor: "", detail: null });
  });

  it("never stores credential keys or file bytes", async () => {
    await logAdminEvent({
      action: "login.failure",
      detail: { passkey: "hunter2-hunter2", attempt: 3, token: "abc", upload: new Uint8Array(10) },
    });
    const raw = await db.query<{ detail: unknown }>("SELECT detail FROM admin_audit_log");
    const text = JSON.stringify(raw.rows);
    expect(text).not.toMatch(/hunter2|passkey|"abc"|token/);
    expect(raw.rows[0].detail).toEqual({ attempt: 3, upload: "[binary 10 bytes]" });
  });

  it("truncates over-long identifiers", async () => {
    await logAdminEvent({ action: "a".repeat(200), entityType: "t".repeat(500), entityId: "i".repeat(500), actor: "x".repeat(500) });
    const { events } = await listAdminEvents();
    expect(events[0].action).toHaveLength(64);
    expect(events[0].entityType).toHaveLength(128);
    expect(events[0].entityId).toHaveLength(128);
    expect(events[0].actor).toHaveLength(128);
  });

  it("is safe against SQL injection in every text field", async () => {
    const evil = "x'); DROP TABLE admin_audit_log; --";
    await logAdminEvent({ action: evil, entityType: evil, entityId: evil, actor: evil, detail: { note: evil } });
    const { events, total } = await listAdminEvents({ action: evil.slice(0, 64) });
    expect(total).toBe(1);
    expect(events[0].detail).toEqual({ note: evil });
  });

  it("lists newest first, with id as the tiebreak", async () => {
    await db.query(
      `INSERT INTO admin_audit_log (at, action) VALUES
        ('2026-01-01T00:00:00Z', 'oldest'),
        ('2026-03-01T00:00:00Z', 'newest-a'),
        ('2026-03-01T00:00:00Z', 'newest-b'),
        ('2026-02-01T00:00:00Z', 'middle')`,
    );
    const { events } = await listAdminEvents();
    expect(events.map((e) => e.action)).toEqual(["newest-b", "newest-a", "middle", "oldest"]);
    expect(events[0].at).toBe("2026-03-01T00:00:00.000Z");
  });

  it("orders ids numerically, not as text", async () => {
    await db.query(`SELECT setval(pg_get_serial_sequence('admin_audit_log', 'id'), 8)`);
    for (let i = 0; i < 4; i += 1) {
      await db.query("INSERT INTO admin_audit_log (at, action) VALUES ('2026-03-01T00:00:00Z', $1)", [`e${i}`]);
    }
    const { events } = await listAdminEvents();
    expect(events.map((e) => e.action)).toEqual(["e3", "e2", "e1", "e0"]);
  });

  it("paginates and reports the unfiltered total", async () => {
    for (let i = 0; i < 12; i += 1) {
      await db.query("INSERT INTO admin_audit_log (at, action) VALUES (now() - ($1 || ' minutes')::interval, $2)", [String(i), `e${i}`]);
    }
    const first = await listAdminEvents({ limit: 5 });
    expect(first.total).toBe(12);
    expect(first.events.map((e) => e.action)).toEqual(["e0", "e1", "e2", "e3", "e4"]);
    const last = await listAdminEvents({ limit: 5, offset: 10 });
    expect(last.total).toBe(12);
    expect(last.events.map((e) => e.action)).toEqual(["e10", "e11"]);
    const beyond = await listAdminEvents({ limit: 5, offset: 100 });
    expect(beyond).toEqual({ events: [], total: 12 });
  });

  it("clamps the limit to 1..200 and the offset to 0", async () => {
    for (let i = 0; i < 3; i += 1) await logAdminEvent({ action: `e${i}` });
    expect((await listAdminEvents({ limit: 0 })).events).toHaveLength(1);
    expect((await listAdminEvents({ limit: -50 })).events).toHaveLength(1);
    expect((await listAdminEvents({ limit: 1000 })).events).toHaveLength(3);
    expect((await listAdminEvents({ limit: Number.NaN })).events).toHaveLength(3);
    expect((await listAdminEvents({ offset: -10 })).events).toHaveLength(3);
    expect((await listAdminEvents({ limit: 2.9 })).events).toHaveLength(2);

    for (let i = 0; i < 250; i += 1) await db.query("INSERT INTO admin_audit_log (action) VALUES ('bulk')");
    expect((await listAdminEvents({ limit: 100_000 })).events).toHaveLength(200);
  });

  it("filters by action and by entity id, and combines them", async () => {
    await logAdminEvent({ action: "document.update", entityId: "doc-1" });
    await logAdminEvent({ action: "document.update", entityId: "doc-2" });
    await logAdminEvent({ action: "document.delete", entityId: "doc-1" });
    await logAdminEvent({ action: "login.success" });

    expect((await listAdminEvents({ action: "document.update" })).total).toBe(2);
    expect((await listAdminEvents({ entityId: "doc-1" })).total).toBe(2);
    const both = await listAdminEvents({ action: "document.update", entityId: "doc-1" });
    expect(both.total).toBe(1);
    expect(both.events[0]).toMatchObject({ action: "document.update", entityId: "doc-1" });
    expect((await listAdminEvents({ action: "nope" }))).toEqual({ events: [], total: 0 });
    // Blank filters are ignored rather than matching nothing.
    expect((await listAdminEvents({ action: "  ", entityId: "" })).total).toBe(4);
  });
});

describe("logAdminEvent when the database is broken", () => {
  afterAll(() => {
    setSqlClientForTests(null);
  });

  it("never throws and does not leak the connection string", async () => {
    const broken: SqlClient = async () => {
      throw new Error("connect ECONNREFUSED postgresql://user:hunter2@ep-secret.neon.tech/db");
    };
    setSqlClientForTests(broken);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(logAdminEvent({ action: "login.success", detail: { a: 1 } })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0].join(" "))).not.toMatch(/hunter2|postgresql:|neon\.tech/);
  });

  it("never throws for a malformed event", async () => {
    setSqlClientForTests(async () => {
      throw new Error("down");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(logAdminEvent(undefined as never)).resolves.toBeUndefined();
    await expect(logAdminEvent({ action: undefined as never })).resolves.toBeUndefined();
  });

  it("gives up on a hung database instead of holding up the caller", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      setSqlClientForTests(() => new Promise(() => undefined));
      let settled = false;
      const pending = logAdminEvent({ action: "login.success" }).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(3_900);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      await pending;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("listAdminEvents rejects instead of pretending the log is empty", async () => {
    setSqlClientForTests(async () => {
      throw new Error("down");
    });
    await expect(listAdminEvents()).rejects.toThrow();
  });
});
