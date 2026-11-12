import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DatabaseNotConfiguredError,
  LOCAL_DB_DIRECTORY,
  createLocalSqlClient,
  getSql,
  isDatabaseConfigured,
  setSqlClientForTests,
  type LocalSqlClient,
} from "@/lib/db";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { createDocument, getDocument } from "@/lib/documents/store";
import { validateDocumentInput } from "@/lib/documents/validate";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const GLOBAL_KEY = "__acevaLocalSqlClient";
const FAKE_NEON_URL = "postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require";
const globals = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  setSqlClientForTests(null);
  vi.stubEnv("ACEVA_LOCAL_DB", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("NODE_ENV", "test");
  delete globals[GLOBAL_KEY];
});

afterEach(() => {
  setSqlClientForTests(null);
  vi.unstubAllEnvs();
  delete globals[GLOBAL_KEY];
});

describe("database selection", () => {
  it("is unconfigured with no URL, no local flag and no injected client", () => {
    expect(isDatabaseConfigured()).toBe(false);
    expect(() => getSql()).toThrow(DatabaseNotConfiguredError);
  });

  it("uses Neon when DATABASE_URL is set, and keeps one client", () => {
    vi.stubEnv("DATABASE_URL", FAKE_NEON_URL);
    expect(isDatabaseConfigured()).toBe(true);
    const first = getSql();
    expect(typeof first).toBe("function");
    expect(getSql()).toBe(first);
  });

  it("prefers an injected client over everything", () => {
    vi.stubEnv("DATABASE_URL", FAKE_NEON_URL);
    vi.stubEnv("ACEVA_LOCAL_DB", "1");
    const injected = vi.fn(async () => []);
    setSqlClientForTests(injected);
    expect(isDatabaseConfigured()).toBe(true);
    expect(getSql()).toBe(injected);
    setSqlClientForTests(null);
    expect(getSql()).not.toBe(injected);
  });

  describe("ACEVA_LOCAL_DB=1", () => {
    it("is configured without a DATABASE_URL, and opening is lazy", () => {
      const folder = path.join(process.cwd(), LOCAL_DB_DIRECTORY);
      const existedBefore = fs.existsSync(folder);
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      expect(isDatabaseConfigured()).toBe(true);
      expect(typeof getSql()).toBe("function");
      // merely asking for the client must not create the database folder
      expect(fs.existsSync(folder)).toBe(existedBefore);
    });

    it("wins over DATABASE_URL, so a developer never writes to the real database by accident", () => {
      vi.stubEnv("DATABASE_URL", FAKE_NEON_URL);
      const remote = getSql();
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      expect(getSql()).not.toBe(remote);
    });

    it("is one client per process, shared through globalThis", () => {
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      const first = getSql();
      expect(getSql()).toBe(first);
      expect(globals[GLOBAL_KEY]).toBe(first);
    });

    it("survives a module reload (Next's hot reload) without opening a second database", async () => {
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      const before = getSql();
      vi.resetModules();
      const reloaded = await import("@/lib/db");
      expect(reloaded.getSql()).toBe(before);
    });

    it("only a literal 1 enables it", () => {
      for (const value of ["0", "true", "yes", "on", " 1", "1 "]) {
        vi.stubEnv("ACEVA_LOCAL_DB", value);
        expect(isDatabaseConfigured()).toBe(false);
      }
    });
  });

  describe("in production", () => {
    it("ignores ACEVA_LOCAL_DB and warns exactly once", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      vi.resetModules();
      const fresh = await import("@/lib/db");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      expect(fresh.isDatabaseConfigured()).toBe(false);
      expect(() => fresh.getSql()).toThrow(fresh.DatabaseNotConfiguredError);
      expect(fresh.isDatabaseConfigured()).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/ACEVA_LOCAL_DB/);
      expect(globals[GLOBAL_KEY]).toBeUndefined();
    });

    it("uses DATABASE_URL instead", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ACEVA_LOCAL_DB", "1");
      vi.stubEnv("DATABASE_URL", FAKE_NEON_URL);
      vi.resetModules();
      const fresh = await import("@/lib/db");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(fresh.isDatabaseConfigured()).toBe(true);
      expect(typeof fresh.getSql()).toBe("function");
      expect(globals[GLOBAL_KEY]).toBeUndefined();
    });

    it("does not warn when the flag is not set", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
      const fresh = await import("@/lib/db");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fresh.isDatabaseConfigured();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe("createLocalSqlClient", () => {
  const clients: LocalSqlClient[] = [];
  const open = (dataDir = "memory://") => {
    const client = createLocalSqlClient({ dataDir });
    clients.push(client);
    return client;
  };

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it("speaks the same tagged-template contract as the Neon client", async () => {
    const sql = open();
    await sql`CREATE TABLE probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), body bytea, meta jsonb, on_day date, note text)`;
    const hex = Buffer.from("aceva").toString("hex");
    await sql`INSERT INTO probe (body, meta, on_day, note) VALUES (decode(${hex}, 'hex'), ${JSON.stringify({ a: 1 })}::jsonb, ${"2026-03-04"}::date, ${"it's"})`;
    const rows = await sql`SELECT encode(body, 'hex') AS body_hex, meta, to_char(on_day, 'YYYY-MM-DD') AS on_day, note FROM probe`;
    expect(rows).toHaveLength(1);
    expect(Buffer.from(String(rows[0].body_hex), "hex").toString()).toBe("aceva");
    expect(rows[0].meta).toEqual({ a: 1 });
    expect(rows[0].on_day).toBe("2026-03-04");
    expect(rows[0].note).toBe("it's");
  });

  it("passes values as parameters, never as SQL text", async () => {
    const sql = open();
    await sql`CREATE TABLE t (v text)`;
    const hostile = "x'); DROP TABLE t;--";
    await sql`INSERT INTO t (v) VALUES (${hostile})`;
    const rows = await sql`SELECT v FROM t`;
    expect(rows).toEqual([{ v: hostile }]);
  });

  it("opens lazily: creating a client touches nothing, and a failed open surfaces on the query", async () => {
    // A plain file stands in the way of the data directory, so opening cannot succeed.
    const blocker = path.join(os.tmpdir(), `aceva-open-blocker-${process.pid}`);
    fs.writeFileSync(blocker, "not a directory");
    try {
      const sql = open(path.join(blocker, "db"));
      await expect(sql`SELECT 1`).rejects.toThrow();
      // and the failure does not wedge the chain: the next query tries (and fails) afresh
      await expect(sql`SELECT 2`).rejects.toThrow();
    } finally {
      fs.unlinkSync(blocker);
    }
  });

  it("serialises concurrent queries", async () => {
    const sql = open();
    await sql`CREATE TABLE counter (n int)`;
    await sql`INSERT INTO counter VALUES (0)`;
    await Promise.all(Array.from({ length: 25 }, () => sql`UPDATE counter SET n = n + 1`));
    expect(await sql`SELECT n FROM counter`).toEqual([{ n: 25 }]);
  });

  it("keeps queries in the order they were issued", async () => {
    const sql = open();
    await sql`CREATE TABLE log (i int)`;
    await Promise.all(Array.from({ length: 10 }, (_, i) => sql`INSERT INTO log VALUES (${i})`));
    const rows = await sql`SELECT i FROM log ORDER BY ctid`;
    expect(rows.map((row) => row.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("a failing query rejects only itself", async () => {
    const sql = open();
    const failing = sql`SELECT * FROM table_that_does_not_exist`;
    const following = sql`SELECT 42 AS answer`;
    await expect(failing).rejects.toThrow(/table_that_does_not_exist/);
    expect(await following).toEqual([{ answer: 42 }]);
    expect(await sql`SELECT 7 AS seven`).toEqual([{ seven: 7 }]);
  });

  it("reports unique violations with Postgres's code and constraint, as the store expects", async () => {
    const sql = open();
    await sql`CREATE TABLE u (code text)`;
    await sql`CREATE UNIQUE INDEX documents_verification_code_uidx ON u (code)`;
    await sql`INSERT INTO u VALUES ('a')`;
    const error = await sql`INSERT INTO u VALUES ('a')`.catch((e: unknown) => e as { code?: string; message?: string });
    expect((error as { code?: string }).code).toBe("23505");
    expect(String((error as Error).message)).toMatch(/verification_code/);
  });

  it("persists to disk and survives a restart", async () => {
    // A fresh folder every run, removed afterwards. It used to be one fixed folder reused across runs, so a
    // run killed mid-write (an out-of-memory crash, a Ctrl-C) left a half-written database behind that made
    // every later run fail with "PGlite failed to initialize properly".
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aceva-local-db-persistence-"));
    const token = `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const first = createLocalSqlClient({ dataDir: dir });
      await first`CREATE TABLE IF NOT EXISTS persisted (token text)`;
      await first`INSERT INTO persisted VALUES (${token})`;
      await first.close();

      const second = createLocalSqlClient({ dataDir: dir });
      clients.push(second);
      const rows = await second`SELECT count(*)::int AS n FROM persisted WHERE token = ${token}`;
      expect(rows).toEqual([{ n: 1 }]);
      // Release the files before the folder is removed (Windows will not delete an open database).
      await second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 60_000);

  it("can be closed twice, and reopens on demand", async () => {
    const sql = open();
    await sql`SELECT 1`;
    await sql.close();
    await sql.close();
    expect(await sql`SELECT 2 AS two`).toEqual([{ two: 2 }]);
  });

  it("closing a client that never opened is a no-op", async () => {
    await expect(open().close()).resolves.toBeUndefined();
  });

  it("runs the whole document store on the embedded database", async () => {
    const sql = open();
    setSqlClientForTests(sql);
    resetDocumentTablesCache();
    await ensureDocumentTables();
    const parsed = validateDocumentInput(
      { title: "Local cert", holderName: "ACEVA", referenceNo: "L1", issuedOn: "2026-01-01", data: { direction: "held", issuing_body: "BSI" } },
      { category: "certification" },
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const created = await createDocument(parsed.value);
    expect(created.verificationCode).toMatch(/^ACV-/);
    expect((await getDocument(created.id))?.title).toBe("Local cert");
    resetDocumentTablesCache();
  });
});
