import { describe, expect, it } from "vitest";
import { pulseReducer, initialState } from "@/components/pulse/PulseContext";

describe("Pulse Context & Progress Reducer Suite", () => {
  it("RECORD_VALID_ANSWER: increments step and answers count for new valid response", () => {
    const state1 = pulseReducer(initialState, {
      type: "RECORD_VALID_ANSWER",
      value: "I need a mobile app for my restaurant.",
    });

    expect(state1.step).toBe(1);
    expect(state1.answers).toHaveLength(1);
    expect(state1.answers[0]).toBe("I need a mobile app for my restaurant.");
  });

  it("DUPLICATE ANSWER PROTECTION: does not increment step or answers count for duplicate inputs", () => {
    const state1 = pulseReducer(initialState, {
      type: "RECORD_VALID_ANSWER",
      value: "I need a mobile app.",
    });
    expect(state1.step).toBe(1);
    expect(state1.answers).toHaveLength(1);

    // Re-submitting duplicate answer with "As I said, ..." prefix
    const state2 = pulseReducer(state1, {
      type: "RECORD_VALID_ANSWER",
      value: "As I said, I need a mobile app.",
    });

    // Step count and answers array length remain unchanged (no double count)
    expect(state2.step).toBe(1);
    expect(state2.answers).toHaveLength(1);
  });

  it("VALID UNCERTAINTY: records valid uncertainty answers into state context", () => {
    const uncertaintyAnswers = [
      "I'm not sure yet.",
      "We haven't decided.",
      "We're still deciding.",
      "I'll discuss it with the team.",
      "We'll decide later.",
      "To be decided.",
    ];

    uncertaintyAnswers.forEach((ans, index) => {
      const state = pulseReducer(initialState, {
        type: "RECORD_VALID_ANSWER",
        value: ans,
      });
      expect(state.step).toBe(1);
      expect(state.answers).toContain(ans);
    });
  });
});
