import { describe, expect, it } from "vitest";
import {
  inferIntentFromText,
  INTENT_OPTIONS,
  INTENT_PROMPTS,
  EXPLORE_OPTIONS,
  type PulseIntent,
} from "@/components/pulse/PulseMessages";

describe("inferIntentFromText", () => {
  // Every free-text entry used to be filed as "Solve a problem" regardless of
  // what the visitor typed.
  const cases: [string, PulseIntent][] = [
    ["I want to automate invoicing", "Automate something"],
    ["We re-type every order by hand into a spreadsheet", "Automate something"],
    ["Too much paperwork every morning", "Automate something"],

    ["I want to sell our products online", "Sell something"],
    ["We need checkout and payments", "Sell something"],
    ["Set up an online store for our bakery", "Sell something"],

    ["Our website is outdated and slow", "Improve what I have"],
    ["We want to modernise the existing portal", "Improve what I have"],
    ["Rebuild what we already have", "Improve what I have"],

    ["I want to build a new booking app", "Start something new"],
    ["Launch an MVP for a laundry service", "Start something new"],
    ["Create a platform from scratch", "Start something new"],

    ["Orders keep going missing and it is costing us", "Solve a problem"],
    ["Something is broken in our dispatch flow", "Solve a problem"],

    ["I'm not sure what I need", "I don't know yet"],
    ["No idea where to start", "I don't know yet"],
    ["Just exploring options for now", "I don't know yet"],
  ];

  for (const [text, expected] of cases) {
    it(`reads "${text}" as "${expected}"`, () => {
      expect(inferIntentFromText(text)).toBe(expected);
    });
  }

  it("only ever returns a real intent option", () => {
    const samples = [
      ...cases.map(([text]) => text),
      "",
      "   ",
      "We run a dental practice in Leeds",
      "asdfghjkl",
      "£15k",
    ];

    for (const text of samples) {
      expect(INTENT_OPTIONS).toContain(inferIntentFromText(text));
    }
  });

  it("does not default everything to Solve a problem", () => {
    const inferred = cases.map(([text]) => inferIntentFromText(text));
    const distinct = new Set(inferred);

    expect(distinct.size).toBe(6);
    expect(inferred.filter((i) => i === "Solve a problem").length).toBeLessThan(inferred.length / 2);
  });

  it("treats a bare business description as starting out", () => {
    expect(inferIntentFromText("We run a dental practice with three chairs")).toBe("Start something new");
  });

  it("falls back to not-knowing on empty input", () => {
    expect(inferIntentFromText("")).toBe("I don't know yet");
    expect(inferIntentFromText("   ")).toBe("I don't know yet");
  });
});

describe("intent catalogue", () => {
  it("has a prompt for every option", () => {
    for (const intent of INTENT_OPTIONS) {
      expect(INTENT_PROMPTS[intent]).toBeTruthy();
      expect(INTENT_PROMPTS[intent].length).toBeGreaterThan(10);
    }
  });
});

describe('"I don\'t know yet" path', () => {
  it("offers plain-language starting points", () => {
    expect(EXPLORE_OPTIONS.length).toBeGreaterThanOrEqual(4);

    for (const option of EXPLORE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(5);
      expect(option.hint.length).toBeGreaterThan(5);
      expect(option.prompt.length).toBeGreaterThan(15);
    }
  });

  it("commits every option to a real intent, never leaving it unknown", () => {
    // The whole point of the path: the blueprint and the lead email must record
    // what the visitor actually wants, not the placeholder they started from.
    for (const option of EXPLORE_OPTIONS) {
      expect(INTENT_OPTIONS).toContain(option.intent);
      expect(option.intent).not.toBe("I don't know yet");
    }
  });

  it("covers the other five intents between them", () => {
    const covered = new Set(EXPLORE_OPTIONS.map((o) => o.intent));
    for (const intent of INTENT_OPTIONS) {
      if (intent === "I don't know yet") continue;
      expect(covered).toContain(intent);
    }
  });

  it("sends a prompt that reads as the visitor's own words", () => {
    for (const option of EXPLORE_OPTIONS) {
      // Not a command to the assistant, and not a bare label.
      expect(option.prompt).not.toMatch(/^(help|please|tell me)\b/i);
      expect(option.prompt).not.toBe(option.label);
    }
  });
});
