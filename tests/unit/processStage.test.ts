import { describe, expect, it } from "vitest";

import { DELIVERABLES, PROCESS_PHASES } from "@/lib/data/process";
import { PILE, STAMPS } from "@/components/process/stamps";

describe("paper trail stage", () => {
  it("stamps every phase once, without numbers or new promises", () => {
    expect(Object.keys(STAMPS)).toEqual(PROCESS_PHASES.map((p) => p.key));
    for (const stamp of Object.values(STAMPS)) {
      expect(stamp).not.toMatch(/\d|guarantee|warrant/i);
    }
  });

  it("builds each stamp from its own phase's copy", () => {
    for (const phase of PROCESS_PHASES) {
      const copy = [phase.lead, ...phase.receive].join(" ").toLowerCase();
      // the stamp's key word (its longest) must come from that phase's own text
      const key = STAMPS[phase.key].split(" ").sort((a, b) => b.length - a.length)[0].toLowerCase();
      expect(copy).toContain(key.slice(0, 6));
    }
  });

  it("has a fixed pile position for every deliverable", () => {
    expect(PILE).toHaveLength(DELIVERABLES.length);
  });
});
