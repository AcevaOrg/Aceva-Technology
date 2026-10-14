import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

import { POST } from "@/app/api/chat/route";
import { validateAnswerAgainstQuestion, detectActiveQuestionTarget } from "@/lib/pulse/answerValidator";
import {
  DISCOVERY_STEPS,
  DISCOVERY_STEP_FIELDS,
  getDiscoveryQuestion,
  getDiscoveryField,
} from "@/lib/pulse/discoverySteps";
import type { LLMMessage } from "@/lib/pulse/llm";
import { GREETING_REJECTION, OUT_OF_SCOPE_REJECTION } from "@/lib/pulse/scope";

function createChatRequest(body: unknown) {
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}

/** A message that passes answer validation on its own merits. */
const VALID_ANSWER = "We run three restaurants and want direct online ordering";

describe("fallback replies never advance progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Every canned path out of generatePulseCompletion. The route used to decide
  // this by comparing the reply against two rejection constants, so only the
  // first two of these were caught and the rest advanced the progress bar.
  const fallbacks = [
    // Taken from the constants rather than copied, so a reworded rejection
    // cannot leave a stale duplicate here pretending to be the real thing.
    ["greeting rejection", GREETING_REJECTION],
    ["out-of-scope rejection", OUT_OF_SCOPE_REJECTION],
    ["provider unavailable", "PULSE is currently unavailable. Please try again later."],
    ["provider failure", "I'm having trouble responding right now. Please try again in a moment."],
    ["PULSE ID lookup hit", "**Found Saved Project Direction [PLS-260826-883]**"],
    ["PULSE ID lookup miss", "I searched for PULSE ID **PLS-260826-999**, but couldn't find a saved direction."],
    ["a reworded rejection", "Sorry, I can only help with ACEVA software projects."],
  ] as const;

  for (const [label, answer] of fallbacks) {
    it(`returns isValid: false for a ${label}`, async () => {
      mockGeneratePulseCompletion.mockResolvedValue({ answer, isFallback: true });

      const response = await POST(createChatRequest({ message: VALID_ANSWER }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.answer).toBe(answer);
      expect(data.isValid).toBe(false);
    });
  }

  it("still advances progress for a genuine generated answer", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({
      answer: "Three locations with direct ordering — noted.",
      isFallback: false,
    });

    const response = await POST(createChatRequest({ message: VALID_ANSWER }));
    const data = await response.json();

    expect(data.isValid).toBe(true);
  });

  it("does not advance progress when the answer is generated but invalid for the question", async () => {
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });

    const response = await POST(createChatRequest({ message: "asdfghjkl" }));
    const data = await response.json();

    expect(data.isValid).toBe(false);
  });
});

describe("the LLM is pinned to the question on screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });
  });

  for (const [index, spec] of DISCOVERY_STEPS.entries()) {
    it(`passes step ${index}'s own question ("${spec.title.slice(0, 32)}…")`, async () => {
      await POST(createChatRequest({ message: VALID_ANSWER, step: index }));

      const options = mockGeneratePulseCompletion.mock.calls[0][4] as { activeQuestion?: string };
      expect(options.activeQuestion).toBe(spec.title);
      expect(options.activeQuestion).toBe(getDiscoveryQuestion(index));
    });
  }

  it("passes no question when the client sends no step", async () => {
    await POST(createChatRequest({ message: VALID_ANSWER }));

    const options = mockGeneratePulseCompletion.mock.calls[0][4] as { activeQuestion?: string };
    expect(options.activeQuestion).toBeUndefined();
  });

  it("ignores an out-of-range or non-numeric step rather than erroring", async () => {
    for (const step of [-1, 5, 99, 1.5, "2", null, {}]) {
      mockGeneratePulseCompletion.mockClear();

      const response = await POST(createChatRequest({ message: VALID_ANSWER, step }));
      expect(response.status).toBe(200);

      const options = mockGeneratePulseCompletion.mock.calls[0][4] as { activeQuestion?: string };
      expect(options.activeQuestion).toBeUndefined();
    }
  });
});

describe("the step on screen decides which question is being answered", () => {
  // Pulse's own prose used to decide this. "When things get busy, what slows
  // your team down?" contains "when", which matched the timeline pattern, so a
  // step-1 friction answer was validated against the timeline question — and
  // because timeline/budget marks the end of discovery, the route switched the
  // model into closing-statement mode three questions early.
  const misleadingBubble: LLMMessage[] = [
    { role: "user", content: "We run three restaurants" },
    { role: "assistant", content: "Got it. When things get busy, what slows your team down the most?" },
  ];

  it("maps every discovery step to a field, so a new question cannot go unmapped", () => {
    expect(DISCOVERY_STEP_FIELDS).toHaveLength(DISCOVERY_STEPS.length);
    for (const index of DISCOVERY_STEPS.keys()) {
      expect(getDiscoveryField(index)).toBe(DISCOVERY_STEP_FIELDS[index]);
    }
  });

  it("uses the step's field rather than keyword-matching the last reply", () => {
    for (const index of DISCOVERY_STEPS.keys()) {
      expect(detectActiveQuestionTarget(misleadingBubble, {}, index)).toBe(DISCOVERY_STEP_FIELDS[index]);
    }
  });

  it("accepts a friction answer at the friction step", () => {
    const field = detectActiveQuestionTarget(misleadingBubble, {}, 1);
    expect(field).toBe("friction");
    expect(
      validateAnswerAgainstQuestion("Taking orders over WhatsApp takes us a week to reconcile", field).isValid
    ).toBe(true);
  });

  it("still falls back to the history heuristic for free chat with no step", () => {
    expect(detectActiveQuestionTarget(misleadingBubble, {})).toBe("timeline");
    expect(getDiscoveryField(undefined)).toBeUndefined();
    for (const step of [-1, DISCOVERY_STEPS.length, 1.5, "2", null]) {
      expect(getDiscoveryField(step)).toBeUndefined();
    }
  });
});

describe("discovery closes only on the final question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });
  });

  /** A valid answer to whichever question is on screen at `step`. */
  const ANSWER_FOR_STEP = [
    "We run three restaurants and want direct online ordering",
    "Taking orders over WhatsApp takes us a week to reconcile",
    "3 locations and 45 staff",
    "Customers order online and the kitchen sees one screen",
    "Launch in 6 weeks, budget around $15k",
  ];

  for (const [step, message] of ANSWER_FOR_STEP.entries()) {
    const isLast = step === DISCOVERY_STEPS.length - 1;

    it(`${isLast ? "closes" : "does not close"} discovery at step ${step}`, async () => {
      const response = await POST(createChatRequest({ message, step }));
      expect(response.status).toBe(200);

      const options = mockGeneratePulseCompletion.mock.calls[0][4] as { closingStatement?: boolean };
      expect(Boolean(options.closingStatement)).toBe(isLast);
    });
  }

  it("does not close discovery when the final answer does not answer the question", async () => {
    // A real project statement, but no timeline or budget in it, so the final
    // question has not been answered and Pulse must ask again rather than
    // declaring discovery complete. (Gibberish would not do as the example:
    // that never reaches the model at all.)
    await POST(
      createChatRequest({
        message: "We want the kitchen screen to show incoming orders",
        step: DISCOVERY_STEPS.length - 1,
      })
    );

    const options = mockGeneratePulseCompletion.mock.calls[0][4] as { closingStatement?: boolean };
    expect(Boolean(options.closingStatement)).toBe(false);
  });
});

describe("budget answer validation", () => {
  const accepted = [
    "whatever it takes",
    "Whatever it takes.",
    "we'll pay what it costs",
    "whatever it costs",
    "no limit",
    "no fixed budget",
    "within reason",
    "around $15k",
    "$5,000",
    "15000",
    "5k",
    "Around five thousand dollars.",
    "I'm not sure yet.",
    "We'll decide after talking to the team.",
    "depends on the scope",
  ];

  for (const answer of accepted) {
    it(`accepts "${answer}"`, () => {
      expect(validateAnswerAgainstQuestion(answer, "budget").isValid).toBe(true);
    });
  }

  const rejected = [
    // The headline case: the old monetary pattern matched the bare "2" in "Q2".
    "end of Q2",
    "End of Q2.",
    "Q3",
    "by the end of the quarter",
    "As soon as possible.",
    "asap",
    "3 weeks",
    "next month",
    "6 months",
  ];

  for (const answer of rejected) {
    it(`rejects the timeline answer "${answer}"`, () => {
      expect(validateAnswerAgainstQuestion(answer, "budget").isValid).toBe(false);
    });
  }

  it("accepts a combined answer that names both a timeline and a figure", () => {
    expect(validateAnswerAgainstQuestion("6 weeks, around $15k", "budget").isValid).toBe(true);
    expect(
      validateAnswerAgainstQuestion("launch in 2 months, budget to be discussed", "budget").isValid
    ).toBe(true);
  });

  it("still rejects noise and off-topic input", () => {
    for (const answer of ["asdfklisadfi", "Hello", "Who is the CEO?", "restaurant"]) {
      expect(validateAnswerAgainstQuestion(answer, "budget").isValid).toBe(false);
    }
  });
});
