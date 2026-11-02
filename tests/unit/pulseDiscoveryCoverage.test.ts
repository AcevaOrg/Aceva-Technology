import { describe, expect, it } from "vitest";

import { initialState, pulseReducer, buildChatRequestBody, parseStoredSession } from "@/components/pulse/PulseContext";
import { inferContextForAnswer } from "@/components/pulse/PulseMessages";
import type { PulseState } from "@/components/pulse/types";
import {
  MAX_DISCOVERY_REASKS,
  clauseForDiscoveryStep,
  coveredDiscoverySteps,
  isRepeatedDiscoveryAnswer,
  nextOpenDiscoveryStep,
  readCoveredSteps,
} from "@/lib/pulse/discoveryCoverage";
import { DISCOVERY_STEP_COUNT } from "@/lib/pulse/discoverySteps";
import { validateLeadSubmission } from "@/lib/pulse/leadValidation";

function discovery(overrides: Partial<PulseState> = {}): PulseState {
  return { ...initialState, stage: "discovery", step: 0, ...overrides };
}

describe("coveredDiscoverySteps: what the visitor has already said", () => {
  const cases: [string, string, number[]][] = [
    [
      "restaurant, everything in one message",
      "We run two restaurants in Lahore. Orders over WhatsApp are chaotic and we lose orders. We want customers to be able to order online, launch in 6 weeks, budget around $8k.",
      [1, 2, 3, 4],
    ],
    ["clinic, friction only", "Our clinic loses hours every week to manual appointment reminders", [1]],
    ["logistics, scale only", "We are a courier company with 12 drivers", [2]],
    ["retail, goals only", "Customers should be able to track their order without calling us", [3]],
    ["SaaS, timeline and budget", "Launch in 3 months, budget is flexible and open to discussion", [4]],
    ["solo founder", "It's just me for now, building a booking tool for tutors", [2]],
    ["plain description", "We sell handmade candles", []],
    [
      "clinic, budget deferred in the past tense",
      "We run a dental clinic with 2 dentists. Patients should be able to book online, launch in 2 months, budget to be discussed with the team.",
      [2, 3, 4],
    ],
  ];

  for (const [label, text, expected] of cases) {
    it(label, () => {
      expect(coveredDiscoverySteps(text)).toEqual(expected);
    });
  }

  it("never treats a question back to Pulse as an answer", () => {
    expect(coveredDiscoverySteps("Can you build it in 6 weeks for $8k?")).toEqual([]);
  });

  it("needs both halves for the timeline-and-budget step", () => {
    expect(coveredDiscoverySteps("We'd like to launch in 6 weeks")).not.toContain(4);
    expect(coveredDiscoverySteps("Our budget is about $8k")).not.toContain(4);
  });

  it("reads a head-count as scale, not budget", () => {
    const covered = coveredDiscoverySteps("We have 10k users and want to launch in 3 months");
    expect(covered).toContain(2);
    expect(covered).not.toContain(4);
  });

  it("picks the sentences that answer a step", () => {
    const text = "We run a bakery. We have 3 shops and 20 staff. Orders get lost on paper.";
    expect(clauseForDiscoveryStep(text, 2)).toBe("We have 3 shops and 20 staff.");
    expect(clauseForDiscoveryStep(text, 1)).toBe("Orders get lost on paper.");
  });
});

describe("nextOpenDiscoveryStep", () => {
  it("moves to the next step when nothing is covered", () => {
    expect(nextOpenDiscoveryStep(0, [])).toBe(1);
    expect(nextOpenDiscoveryStep(3, [])).toBe(4);
  });

  it("skips every step already answered", () => {
    expect(nextOpenDiscoveryStep(0, [1, 2])).toBe(3);
    expect(nextOpenDiscoveryStep(1, [2, 4])).toBe(3);
    expect(nextOpenDiscoveryStep(3, [4])).toBe(DISCOVERY_STEP_COUNT);
  });

  it("ends discovery after the final step", () => {
    expect(nextOpenDiscoveryStep(4, [])).toBe(DISCOVERY_STEP_COUNT);
  });
});

describe("untrusted covered steps", () => {
  it("keeps only whole numbers for the later steps", () => {
    expect(readCoveredSteps([4, 2, 2, 0, 5, -1, 1.5, "3", null])).toEqual([2, 4]);
    expect(readCoveredSteps("1,2")).toEqual([]);
  });
});

describe("repeat detection", () => {
  it("treats a restated answer as a repeat", () => {
    expect(isRepeatedDiscoveryAnswer("As I said, we need a mobile app", ["We need a mobile app"])).toBe(true);
  });

  it("never treats a short answer as a repeat, since it can answer several questions", () => {
    expect(isRepeatedDiscoveryAnswer("Not sure yet", ["Not sure yet"])).toBe(false);
    expect(isRepeatedDiscoveryAnswer("Flexible", ["Flexible"])).toBe(false);
  });
});

describe("reducer: skipping, the clarification cap and repeats", () => {
  it("jumps to the step the server names and remembers what was covered", () => {
    const state = pulseReducer(discovery(), {
      type: "RECORD_VALID_ANSWER",
      value: "We run two bakeries with 20 staff",
      nextStep: 3,
      covered: [2],
    });
    expect(state.step).toBe(3);
    expect(state.coveredSteps).toEqual([2]);
    expect(state.answers).toHaveLength(1);
  });

  it("finishes discovery when every remaining step was covered", () => {
    const state = pulseReducer(discovery(), { type: "RECORD_VALID_ANSWER", value: "Everything at once", nextStep: 5 });
    expect(state.step).toBe(DISCOVERY_STEP_COUNT);
  });

  it("never moves backwards or past the end on a bad nextStep", () => {
    expect(pulseReducer(discovery({ step: 2 }), { type: "RECORD_VALID_ANSWER", value: "x".repeat(20), nextStep: 1 }).step).toBe(3);
    expect(pulseReducer(discovery({ step: 2 }), { type: "RECORD_VALID_ANSWER", value: "y".repeat(20), nextStep: 99 }).step).toBe(5);
  });

  it("counts a clarification", () => {
    expect(pulseReducer(discovery(), { type: "RECORD_REASK" }).reasks).toBe(1);
  });

  it("holds a repeated answer once, then accepts it, so a repeat never stalls discovery", () => {
    const first = pulseReducer(discovery(), { type: "RECORD_VALID_ANSWER", value: "We need a mobile app for our gym" });
    expect(first.step).toBe(1);

    const held = pulseReducer(first, { type: "RECORD_VALID_ANSWER", value: "As I said, we need a mobile app for our gym" });
    expect(held.step).toBe(1);
    expect(held.reasks).toBe(MAX_DISCOVERY_REASKS);

    const accepted = pulseReducer(held, { type: "RECORD_VALID_ANSWER", value: "As I said, we need a mobile app for our gym" });
    expect(accepted.step).toBe(2);
  });

  it("RESTART clears the discovery bookkeeping", () => {
    const state = pulseReducer(discovery({ reasks: 1, coveredSteps: [2, 3] }), { type: "RESTART" });
    expect(state.reasks).toBeUndefined();
    expect(state.coveredSteps).toBeUndefined();
  });
});

describe("request body carries the discovery bookkeeping", () => {
  it("sends covered steps, clarifications used and a repeat flag", () => {
    const state = discovery({ step: 1, answers: ["We need a mobile app for our gym"], coveredSteps: [3], reasks: 1 });
    const body = buildChatRequestBody("As I said, we need a mobile app for our gym", state);
    expect(body.covered).toEqual([3]);
    expect(body.reasks).toBe(1);
    expect(body.repeat).toBe(true);
  });

  it("lets the first typed message on the intent screen answer step 0", () => {
    const state = { ...initialState, stage: "intent" as const };
    expect(buildChatRequestBody("We run a gym", state).step).toBeUndefined();
    expect(buildChatRequestBody("We run a gym", state, undefined, 0).step).toBe(0);
  });

  it("survives a reload", () => {
    const raw = JSON.stringify({
      stage: "discovery",
      step: 3,
      messages: [{ id: "m1", sender: "user", text: "hi", timestamp: "" }],
      coveredSteps: [2, 9],
      reasks: 1,
      savedAt: Date.now(),
    });
    const session = parseStoredSession(raw);
    expect(session?.coveredSteps).toEqual([2]);
    expect(session?.reasks).toBe(1);
  });
});

describe("inferContextForAnswer fills the steps it lets Pulse skip", () => {
  it("records scale, friction and the launch window from one rich opening answer", () => {
    const context = inferContextForAnswer(
      "We run two restaurants in Lahore. Orders over WhatsApp are chaotic and we lose orders. We want customers to be able to order online, launch in 6 weeks, budget around $8k.",
      0,
      { intent: "Start something new" }
    );
    expect(context.industry).toBe("Hospitality & Restaurant");
    expect(String(context.scale)).toMatch(/two restaurants/i);
    expect((context.friction as string[]).join(" ")).toMatch(/whatsapp/i);
    expect((context.goals as string[]).join(" ")).toMatch(/order online/i);
    expect(String(context.timeline)).toMatch(/6 weeks/i);
    expect(context.budget).toBeTruthy();
  });

  it("leaves uncovered steps alone", () => {
    const context = inferContextForAnswer("We sell handmade candles", 0, {});
    expect(context.scale).toBeUndefined();
    expect(context.timeline).toBeUndefined();
  });
});

describe("Save Direction: phone numbers people actually type", () => {
  const lead = (contact: string) =>
    validateLeadSubmission({ lead: { name: "Test Visitor", contact, method: "Phone" } });

  for (const contact of ["(555) 123-4567", "555.123.4567", "+1 (555) 123-4567", "+92 300 1234567", "0300-1234567"]) {
    it(`accepts ${contact}`, () => {
      expect(lead(contact).ok).toBe(true);
    });
  }

  for (const contact of ["call me", "12345", "555-CALL-NOW", "+1 (555) 123-4567 ext 12"]) {
    it(`still refuses ${contact}`, () => {
      const result = lead(contact);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.contact).toBe(true);
    });
  }
});
