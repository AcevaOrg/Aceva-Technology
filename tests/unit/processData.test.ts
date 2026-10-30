import { describe, expect, it } from "vitest";

import { COMMITMENTS, PROCESS_STEPS } from "@/components/home/content";
import { CAPS } from "@/lib/data/caps";
import { FAQS } from "@/lib/data/faqs";
import {
  DELIVERABLES,
  OWNERSHIP_ROWS,
  PROCESS_COMMITMENTS,
  PROCESS_FAQS,
  PROCESS_FAQ_QUESTIONS,
  PROCESS_INTRO,
  PROCESS_PHASES,
  SAMPLE_UPDATE,
  WONT_PROMISE,
} from "@/lib/data/process";

/** Everything the page is allowed to restate: the phases, the commitments, the FAQs and the capability limits. */
const CONFIRMED = [
  ...PROCESS_PHASES.flatMap((p) => [p.lead, ...p.receive]),
  ...PROCESS_COMMITMENTS.map((c) => c.body),
  ...FAQS.map((f) => f.a),
  ...CAPS.map((c) => c.limit),
].join("\n");

describe("process data", () => {
  it("has five phases with three written deliverables each", () => {
    expect(PROCESS_PHASES.map((p) => p.title)).toEqual(["Understand", "Design", "Build", "Launch", "Improve"]);
    for (const phase of PROCESS_PHASES) {
      expect(phase.key).toMatch(/^[a-z]+$/);
      expect(phase.receive).toHaveLength(3);
    }
    expect(DELIVERABLES).toHaveLength(15);
  });

  it("keeps the homepage's delivery loop and commitments word for word", () => {
    expect(PROCESS_STEPS).toEqual([
      { n: "01", title: "Understand", body: "Requirements, goals, constraints and feasibility before any code." },
      { n: "02", title: "Design", body: "UX, interface and architecture planning with acceptance criteria." },
      { n: "03", title: "Build", body: "Senior-reviewed sprints with weekly working demos." },
      { n: "04", title: "Launch", body: "QA, security basics, deployment and analytics under your accounts." },
      { n: "05", title: "Improve", body: "Monitoring, iteration and a modernization roadmap you can act on." },
    ]);
    expect(COMMITMENTS.map((c) => c.title)).toEqual(["Senior review, always", "You own everything", "Weekly proof"]);
  });

  it("quotes the FAQs it shows, in full and in order", () => {
    expect(PROCESS_FAQS.map((f) => f.q)).toEqual([...PROCESS_FAQ_QUESTIONS]);
    for (const faq of PROCESS_FAQS) expect(FAQS).toContainEqual(faq);
  });

  it("only restates confirmed copy in the ownership table and the limits", () => {
    for (const row of OWNERSHIP_ROWS) expect(CONFIRMED).toContain(row.source);
    for (const line of WONT_PROMISE) expect(CONFIRMED).toContain(line.text);
    expect(WONT_PROMISE.length).toBe(2 + CAPS.length);
  });

  it("never invents a duration, a day, a figure or a guarantee", () => {
    const shown = [
      PROCESS_INTRO,
      ...OWNERSHIP_ROWS.flatMap((r) => [r.item, r.owner, r.when]),
      ...WONT_PROMISE.map((l) => l.label),
      JSON.stringify(SAMPLE_UPDATE),
    ].join("\n");
    expect(shown).not.toMatch(/\d+\s*(hours?|days?|weeks?|months?)\b/i);
    expect(shown).not.toMatch(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    expect(shown).not.toMatch(/%|\bSLA\b|warrant/i);
    expect(JSON.stringify(SAMPLE_UPDATE)).not.toMatch(/\d/);
  });

  it("labels the weekly update as a sample on a fictional project", () => {
    expect(SAMPLE_UPDATE.label).toBe("Sample deliverable · Fictional project");
  });
});
