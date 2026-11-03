import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Neon driver's query object is lazy: like the real NeonQueryPromise
 * (`then(e,t){return this.execute(...)}` in @neondatabase/serverless 1.1.0),
 * each `then` sends the query again. The other suites mock the driver with
 * plain async functions, which run once however often they are awaited, so
 * they could not see that `withTimeout` ran every query twice.
 *
 * Found against a real schema-only Neon branch on 31 October 2026: every save
 * stored three leads and answered 503.
 */

const db = vi.hoisted(() => ({ executions: 0, pulseIds: new Set<string>() }));

/** A minimal stand-in for NeonQueryPromise: runs `execute` on every `then`. */
class LazyQuery<T> implements PromiseLike<T> {
  constructor(private readonly execute: () => Promise<T>) {}
  then<A = T, B = never>(onFulfilled?: ((value: T) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return this.execute().then(onFulfilled, onRejected);
  }
  catch<B = never>(onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return this.then(undefined, onRejected);
  }
}

vi.mock("@neondatabase/serverless", () => ({
  neon: () => (strings: TemplateStringsArray, ...values: unknown[]) =>
    new LazyQuery(async () => {
      db.executions += 1;
      const text = strings.join("?");
      if (!text.includes("INSERT INTO directions")) return [];
      // ON CONFLICT (pulse_id) DO NOTHING RETURNING pulse_id
      const id = String(values[0]);
      if (db.pulseIds.has(id)) return [];
      db.pulseIds.add(id);
      return [{ pulse_id: id }];
    }),
}));

beforeEach(() => {
  vi.resetModules();
  db.executions = 0;
  db.pulseIds.clear();
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@ep-test-123.invalid/neondb");
});

describe("withTimeout runs a lazy driver query exactly once", () => {
  it("executes once and returns that execution's result", async () => {
    const { withTimeout } = await import("@/lib/pulse/db");
    let runs = 0;
    const result = await withTimeout(new LazyQuery(async () => ++runs), "probe");
    expect(runs).toBe(1);
    expect(result).toBe(1);
  });

  it("a new direction is reported as inserted, and inserted once", async () => {
    const { createDirection } = await import("@/lib/pulse/directionStore");
    const inserted = await createDirection({
      pulseId: "PLS-261031-AB12-CD34",
      lead: { name: "Synthetic", contact: "synthetic@example.test", method: "Email" },
      createdAt: "2026-10-31T00:00:00.000Z",
    });
    expect(inserted).toBe(true);
    expect([...db.pulseIds]).toEqual(["PLS-261031-AB12-CD34"]);
    // One DDL and one INSERT, nothing doubled.
    expect(db.executions).toBe(2);
  });
});
