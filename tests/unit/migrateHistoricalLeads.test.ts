import { describe, expect, it } from "vitest";
import { planMigration, rowChecksum, setChecksum, type LeadRow } from "../../scripts/migrate-historical-leads";

/** Pure planning and reconciliation logic of the prepared (not run) migration. Synthetic rows only. */

const row = (id: string, overrides: Partial<LeadRow> = {}): LeadRow => ({
  pulse_id: id,
  lead: { name: "Synthetic", contact: `${id.toLowerCase()}@example.test`, method: "Email" },
  context: { industry: "Logistics" },
  answers: ["a"],
  recommended_modules: ["m"],
  created_at: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("planMigration", () => {
  it("inserts only references absent from the destination", () => {
    const plan = planMigration([row("PLS-260901-101"), row("PLS-260901-102")], ["PLS-260901-102"], []);
    expect(plan.toInsert.map((r) => r.pulse_id)).toEqual(["PLS-260901-101"]);
    expect(plan.alreadyPresent).toBe(1);
  });

  it("matches references case- and space-insensitively", () => {
    const plan = planMigration([row(" pls-260901-101 ")], ["PLS-260901-101"], []);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.alreadyPresent).toBe(1);
  });

  it("leaves out rows the manager excluded, such as test rows", () => {
    const plan = planMigration([row("PLS-260901-101"), row("PLS-260901-199")], [], ["PLS-260901-199", ""]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.excluded).toBe(1);
  });

  it("counts duplicate source references instead of inserting them twice", () => {
    const plan = planMigration([row("PLS-260901-101"), row("pls-260901-101")], [], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.duplicateSourceIds).toBe(1);
  });
});

describe("checksums", () => {
  it("are stable across key order and timestamp representation", () => {
    const a = row("PLS-260901-101", { lead: { name: "S", contact: "s@example.test", method: "Email" } });
    const b = row("PLS-260901-101", {
      lead: { method: "Email", contact: "s@example.test", name: "S" },
      created_at: new Date("2026-09-01T10:00:00Z"),
    });
    expect(rowChecksum(a)).toBe(rowChecksum(b));
  });

  it("change when any field, including the timestamp, changes", () => {
    const base = row("PLS-260901-101");
    expect(rowChecksum(base)).not.toBe(rowChecksum(row("PLS-260901-101", { answers: ["b"] })));
    expect(rowChecksum(base)).not.toBe(rowChecksum(row("PLS-260901-101", { created_at: "2026-09-02T10:00:00.000Z" })));
  });

  it("for a set do not depend on row order", () => {
    const rows = [row("PLS-260901-101"), row("PLS-260901-102")];
    expect(setChecksum(rows)).toBe(setChecksum([...rows].reverse()));
  });
});
