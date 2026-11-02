import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The direction store against a mocked Neon driver.
 *
 * Every other suite mocks `@/lib/pulse/directionStore` as a whole, so nothing
 * proved what SQL the store actually issues, how it maps a row back, or how
 * it behaves when the database is missing or refuses the DDL. The driver is
 * mocked at the package boundary, so no assertion here can reach a database.
 */

type SqlCall = { text: string; values: unknown[] };

const driver = vi.hoisted(() => ({
  calls: [] as SqlCall[],
  /** What the next SELECT returns. */
  rows: [] as unknown[],
  /** Rejects the next call with this error, then clears itself. */
  failNext: null as Error | null,
  clients: 0,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    driver.clients += 1;
    return async (strings: TemplateStringsArray, ...values: unknown[]) => {
      driver.calls.push({ text: strings.join("?"), values });
      if (driver.failNext) {
        const error = driver.failNext;
        driver.failNext = null;
        throw error;
      }
      return driver.rows;
    };
  },
}));

type Store = typeof import("@/lib/pulse/directionStore");

/** A fresh module per test: the store caches its client and its DDL promise. */
async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("@/lib/pulse/directionStore");
}

const direction = {
  pulseId: " pls-260826-883 ",
  lead: { name: "Synthetic Lead", contact: "synthetic@example.test", method: "Email" },
  context: { intent: "Start something new", industry: "Hospitality & Restaurant", goals: ["Direct ordering"] },
  answers: ["We run a café", "Orders by phone"],
  recommendedModules: ["Module A"],
  createdAt: "2026-10-01T10:00:00.000Z",
};

describe("directionStore against a mocked Neon driver", () => {
  beforeEach(() => {
    driver.calls.length = 0;
    driver.rows = [];
    driver.failNext = null;
    driver.clients = 0;
    // A placeholder, never dialled: the driver above is a mock.
    vi.stubEnv("DATABASE_URL", "postgresql://mock:mock@mock.invalid/mock");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("saveDirection", () => {
    it("upserts on pulse_id and leaves created_at out of the update list", async () => {
      const store = await freshStore();
      await store.saveDirection(direction);

      const insert = driver.calls.find((c) => /INSERT INTO directions/i.test(c.text));
      expect(insert, "no INSERT was issued").toBeDefined();
      expect(insert!.text).toMatch(/ON CONFLICT \(pulse_id\) DO UPDATE/i);

      // Re-saving must refresh the record without rewriting its submission time.
      const updateList = insert!.text.split(/DO UPDATE SET/i)[1];
      expect(updateList).toMatch(/lead\s*=\s*EXCLUDED\.lead/);
      expect(updateList).not.toMatch(/created_at/);
    });

    it("normalises the reference and serialises the JSON columns", async () => {
      const store = await freshStore();
      await store.saveDirection(direction);

      const insert = driver.calls.find((c) => /INSERT INTO directions/i.test(c.text))!;
      const [pulseId, lead, context, answers, modules, createdAt] = insert.values;

      expect(pulseId).toBe("PLS-260826-883");
      expect(JSON.parse(lead as string)).toEqual(direction.lead);
      expect(JSON.parse(context as string)).toEqual(direction.context);
      expect(JSON.parse(answers as string)).toEqual(direction.answers);
      expect(JSON.parse(modules as string)).toEqual(direction.recommendedModules);
      expect(createdAt).toBe(direction.createdAt);
    });

    it("writes NULL for the optional columns when they are absent", async () => {
      const store = await freshStore();
      await store.saveDirection({ ...direction, context: undefined, answers: undefined, recommendedModules: undefined });

      const insert = driver.calls.find((c) => /INSERT INTO directions/i.test(c.text))!;
      expect(insert.values.slice(2, 5)).toEqual([null, null, null]);
    });
  });

  describe("getDirection", () => {
    it("looks the reference up in upper case and maps the row back", async () => {
      const store = await freshStore();
      driver.rows = [
        {
          pulse_id: "PLS-260826-883",
          lead: direction.lead,
          context: direction.context,
          answers: direction.answers,
          recommended_modules: null,
          created_at: new Date("2026-10-01T10:00:00.000Z"),
        },
      ];

      const found = await store.getDirection("pls-260826-883 ");

      const select = driver.calls.find((c) => /SELECT [^]* FROM directions/i.test(c.text))!;
      expect(select.values).toEqual(["PLS-260826-883"]);

      expect(found).toEqual({
        pulseId: "PLS-260826-883",
        lead: direction.lead,
        context: direction.context,
        answers: direction.answers,
        recommendedModules: undefined,
        createdAt: "2026-10-01T10:00:00.000Z",
      });
    });

    it("accepts created_at as a string, which is what the HTTP driver returns", async () => {
      const store = await freshStore();
      driver.rows = [
        { pulse_id: "PLS-260826-883", lead: direction.lead, context: null, answers: null, recommended_modules: null, created_at: "2026-10-01T10:00:00.000Z" },
      ];

      const found = await store.getDirection("PLS-260826-883");
      expect(found?.createdAt).toBe("2026-10-01T10:00:00.000Z");
      expect(found?.context).toBeUndefined();
    });

    it("returns null for an unknown reference", async () => {
      const store = await freshStore();
      expect(await store.getDirection("PLS-260826-999")).toBeNull();
    });
  });

  describe("schema provisioning", () => {
    it("runs the DDL once per process, not once per query", async () => {
      const store = await freshStore();
      await store.saveDirection(direction);
      await store.getDirection("PLS-260826-883");
      await store.saveDirection(direction);

      const ddl = driver.calls.filter((c) => /CREATE TABLE IF NOT EXISTS directions/i.test(c.text));
      expect(ddl).toHaveLength(1);
      expect(driver.clients, "a new client was built per call").toBe(1);
    });

    it("retries the DDL after a failure instead of caching the rejection", async () => {
      const store = await freshStore();
      driver.failNext = new Error("neon: connection terminated unexpectedly");

      await expect(store.saveDirection(direction)).rejects.toThrow(/connection terminated/);

      // The database is back: the next call must provision and then write.
      await store.saveDirection(direction);
      const ddl = driver.calls.filter((c) => /CREATE TABLE IF NOT EXISTS directions/i.test(c.text));
      expect(ddl).toHaveLength(2);
      expect(driver.calls.filter((c) => /INSERT INTO directions/i.test(c.text))).toHaveLength(1);
    });

    it("surfaces a write failure to the caller rather than swallowing it", async () => {
      // The save-direction route turns this into a 503 and skips the lead
      // email, so the visitor is never handed a reference that resolves to nothing.
      const store = await freshStore();
      await store.getDirection("PLS-260826-883"); // DDL done
      driver.failNext = new Error("neon: statement timeout");

      await expect(store.saveDirection(direction)).rejects.toThrow(/statement timeout/);
    });
  });

  describe("without a database", () => {
    it("fails fast with a clear message and never builds a client", async () => {
      vi.stubEnv("DATABASE_URL", "");
      const store = await freshStore();

      await expect(store.getDirection("PLS-260826-883")).rejects.toThrow(/DATABASE_URL is not set/);
      await expect(store.saveDirection(direction)).rejects.toThrow(/DATABASE_URL is not set/);
      expect(driver.clients).toBe(0);
      expect(driver.calls).toHaveLength(0);
    });

    it("tags a refused database target with the operation and reason, before any query", async () => {
      // A real-looking host: the target guard refuses it under the test runner,
      // exactly as it refuses an unapproved endpoint in a dev server.
      vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-real-host-123456.us-east-1.aws.neon.tech/db");
      const store = await freshStore();
      const db = await import("@/lib/pulse/db");

      const failure = await store.createDirection({ ...direction, pulseId: "PLS-261102-001" }).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(db.DatabaseOperationError);
      expect(db.describeDatabaseError(failure)).toEqual({
        operation: "prepare-table",
        category: "target-refused:test-runner",
        errorName: "DatabaseUnavailableError",
      });
      expect(driver.clients).toBe(0);
      expect(driver.calls).toHaveLength(0);
    });
  });

  describe("createDirection failure tagging", () => {
    it("tags a rejected insert with its SQLSTATE and never the driver message", async () => {
      const store = await freshStore();
      const db = await import("@/lib/pulse/db");
      await store.getDirection("PLS-260826-883"); // DDL done
      driver.failNext = Object.assign(new Error('permission denied for table directions "synthetic@example.test"'), {
        name: "NeonDbError",
        code: "42501",
      });

      const failure = await store.createDirection({ ...direction, pulseId: "PLS-261102-002" }).catch((e: unknown) => e);
      const described = db.describeDatabaseError(failure);
      expect(described).toEqual({ operation: "insert", category: "query-rejected", code: "42501", errorName: "NeonDbError" });
      expect(JSON.stringify(described)).not.toContain("synthetic@example.test");
    });

    it("issues exactly one INSERT per successful createDirection", async () => {
      const store = await freshStore();
      driver.rows = [{ pulse_id: "PLS-261102-003" }];

      await expect(store.createDirection({ ...direction, pulseId: "PLS-261102-003" })).resolves.toBe(true);
      expect(driver.calls.filter((c) => /INSERT INTO directions/i.test(c.text))).toHaveLength(1);
    });
  });
});
