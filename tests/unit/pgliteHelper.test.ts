import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPgliteSql } from "../helpers/pgliteSql";
import { getSql, setSqlClientForTests } from "@/lib/db";

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe("pglite test helper", () => {
  let close: () => Promise<void>;

  beforeAll(async () => {
    const pg = await createPgliteSql();
    close = pg.close;
    setSqlClientForTests(pg.sql);
  });

  afterAll(async () => {
    setSqlClientForTests(null);
    await close();
  });

  it("runs tagged-template queries through getSql()", async () => {
    const sql = getSql();
    await sql`CREATE TABLE probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), body bytea, meta jsonb, on_day date)`;
    const hex = Buffer.from("aceva").toString("hex");
    await sql`INSERT INTO probe (body, meta, on_day) VALUES (decode(${hex}, 'hex'), ${JSON.stringify({ a: 1 })}::jsonb, ${"2026-03-04"}::date)`;
    const rows = await sql`SELECT encode(body, 'hex') AS body_hex, meta, to_char(on_day, 'YYYY-MM-DD') AS on_day FROM probe`;
    expect(rows).toHaveLength(1);
    expect(Buffer.from(String(rows[0].body_hex), "hex").toString()).toBe("aceva");
    expect(rows[0].meta).toEqual({ a: 1 });
    expect(rows[0].on_day).toBe("2026-03-04");
  });
});
