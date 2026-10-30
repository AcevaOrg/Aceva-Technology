import { describe, expect, it } from "vitest";

import { phaseByKey } from "@/lib/data/process";
import { WEEKLY_LOOP } from "@/components/process/loopSteps";

describe("the weekly loop inside Build", () => {
  const build = phaseByKey("build");
  const copy = [build.lead, ...build.receive].join(" ");

  it("has four stations, each quoting Build's own copy", () => {
    expect(WEEKLY_LOOP).toHaveLength(4);
    for (const step of WEEKLY_LOOP) expect(copy.toLowerCase()).toContain(step.note.toLowerCase());
  });

  it("adds no day, duration or figure", () => {
    const text = JSON.stringify(WEEKLY_LOOP);
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/\b(monday|tuesday|wednesday|thursday|friday)\b/i);
  });
});
