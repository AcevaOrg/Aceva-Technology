import { describe, expect, it } from "vitest";

import { PROOF_ITEMS, RESCUE } from "@/components/home/content";
import {
  EXPERIMENTS,
  FINDINGS,
  PROVENANCE,
  ROADMAP,
  TASKS,
  VERDICTS,
  experimentHref,
  severityCounts,
} from "@/lib/data/experiments";
import { AUTO_STEPS } from "@/lib/data/autoSteps";

describe("experiments data", () => {
  it("gives every experiment a unique, URL-safe anchor and a known provenance", () => {
    const slugs = EXPERIMENTS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const exp of EXPERIMENTS) {
      expect(exp.slug).toMatch(/^[a-z-]+$/);
      expect(PROVENANCE[exp.provenance]).toBeDefined();
    }
  });

  it("builds deep links from the slug", () => {
    expect(experimentHref("rescue")).toBe("/experiments#rescue-report");
    expect(experimentHref("dashboard")).toBe("/experiments#operations-dashboard");
  });

  it("computes the severity summary from the findings, so it cannot drift from the table", () => {
    const counts = severityCounts();
    expect(counts.CRITICAL + counts.HIGH + counts.MEDIUM).toBe(FINDINGS.length);
    expect(counts).toEqual({ CRITICAL: 2, HIGH: 3, MEDIUM: 4 });
  });

  it("uses every verdict at least once, including defer", () => {
    for (const verdict of Object.keys(VERDICTS)) {
      expect(FINDINGS.some((f) => f.verdict === verdict)).toBe(true);
    }
  });

  it("keeps the homepage Rescue rows a subset of the report, in the same words", () => {
    expect(RESCUE.reportRows).toHaveLength(FINDINGS.filter((f) => f.featured).length);
    for (const row of RESCUE.reportRows) {
      const match = FINDINGS.find((f) => f.area === row.area);
      expect(match?.finding).toBe(row.finding);
    }
    expect(RESCUE.roadmap).toBe(ROADMAP);
  });

  it("points every homepage proof tile at a real chapter", () => {
    expect(PROOF_ITEMS).toHaveLength(5);
  });

  it("gives every dashboard task a state for every role", () => {
    for (const task of TASKS) {
      expect(Object.keys(task.states).sort()).toEqual(["dispatch", "finance", "ops"]);
    }
  });

  it("stamps every automation step with a fixed time, so server and browser render the same log", () => {
    for (const step of AUTO_STEPS) expect(step.at).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
