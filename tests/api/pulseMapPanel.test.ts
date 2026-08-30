import { describe, expect, it } from "vitest";
import { getSequentialNodeValue } from "@/components/pulse/PulseMapPanel";
import { PulseState } from "@/components/pulse/types";

const emptyState: PulseState = {
  open: true,
  stage: "intent",
  step: 0,
  answers: [],
  context: {},
  messages: [],
};

const baseState: PulseState = {
  open: true,
  stage: "discovery",
  step: 0,
  answers: [],
  context: { intent: "Start Something New" },
  messages: [],
};

describe("Pulse Live Project Map Sequential Node Logic Verification Suite", () => {
  it("Test 0: Initial state before user selects an intent -> All 6 nodes AWAITING CONTEXT", () => {
    expect(getSequentialNodeValue(0, emptyState)).toBeNull(); // 01 INTENT
    expect(getSequentialNodeValue(1, emptyState)).toBeNull(); // 02 INDUSTRY
    expect(getSequentialNodeValue(2, emptyState)).toBeNull(); // 03 OPERATION
    expect(getSequentialNodeValue(3, emptyState)).toBeNull(); // 04 CURRENT STATE
    expect(getSequentialNodeValue(4, emptyState)).toBeNull(); // 05 FRICTION DETECTED
    expect(getSequentialNodeValue(5, emptyState)).toBeNull(); // 06 DESIRED OUTCOME
  });

  it("Test 1: User selects 'Start Something New' -> 01 populated, 02-06 AWAITING CONTEXT", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 0,
      answers: [],
      context: { intent: "Start Something New" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toBeNull(); // 02 INDUSTRY
    expect(getSequentialNodeValue(2, state)).toBeNull(); // 03 OPERATION
    expect(getSequentialNodeValue(3, state)).toBeNull(); // 04 CURRENT STATE
    expect(getSequentialNodeValue(4, state)).toBeNull(); // 05 FRICTION DETECTED
    expect(getSequentialNodeValue(5, state)).toBeNull(); // 06 DESIRED OUTCOME
  });

  it("Test 1b: User selects 'Improve what I have' -> 01 shows 'Improve what I have'", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 0,
      answers: [],
      context: { intent: "Improve what I have" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Improve what I have");
    expect(getSequentialNodeValue(1, state)).toBeNull();
  });

  it("Test 2: User answers 'It's for my restaurant.' -> 01 & 02 populated, 03-06 AWAITING CONTEXT", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 1,
      answers: ["It's for my restaurant."],
      context: { intent: "Start Something New", industry: "Hospitality & Restaurant" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toMatch(/Restaurant/i);
    expect(getSequentialNodeValue(2, state)).toBeNull();
    expect(getSequentialNodeValue(3, state)).toBeNull();
    expect(getSequentialNodeValue(4, state)).toBeNull();
    expect(getSequentialNodeValue(5, state)).toBeNull();
  });

  it("Test 3: User answers 'Customers should be able to order food online.' -> 01, 02 & 03 populated", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 2,
      answers: ["It's for my restaurant.", "Customers should be able to order food online."],
      context: { intent: "Start Something New", industry: "Hospitality & Restaurant" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toMatch(/Restaurant/i);
    expect(getSequentialNodeValue(2, state)).toMatch(/Online Food Ordering|Order/i);
    expect(getSequentialNodeValue(3, state)).toBeNull();
    expect(getSequentialNodeValue(4, state)).toBeNull();
    expect(getSequentialNodeValue(5, state)).toBeNull();
  });

  it("Test 4: User answers 'We currently take orders through WhatsApp.' -> 01 to 04 populated", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 3,
      answers: [
        "It's for my restaurant.",
        "Customers should be able to order food online.",
        "We currently take orders through WhatsApp.",
      ],
      context: { intent: "Start Something New", industry: "Hospitality & Restaurant" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toMatch(/Restaurant/i);
    expect(getSequentialNodeValue(2, state)).toMatch(/Online Food Ordering|Order/i);
    expect(getSequentialNodeValue(3, state)).toMatch(/WhatsApp/i);
    expect(getSequentialNodeValue(4, state)).toBeNull();
    expect(getSequentialNodeValue(5, state)).toBeNull();
  });

  it("Test 5: User answers 'It's difficult to keep track of all the orders.' -> 01 to 05 populated", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 4,
      answers: [
        "It's for my restaurant.",
        "Customers should be able to order food online.",
        "We currently take orders through WhatsApp.",
        "It's difficult to keep track of all the orders.",
      ],
      context: { intent: "Start Something New", industry: "Hospitality & Restaurant" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toMatch(/Restaurant/i);
    expect(getSequentialNodeValue(2, state)).toMatch(/Online Food Ordering|Order/i);
    expect(getSequentialNodeValue(3, state)).toMatch(/WhatsApp/i);
    expect(getSequentialNodeValue(4, state)).toMatch(/Difficult to track/i);
    expect(getSequentialNodeValue(5, state)).toBeNull();
  });

  it("Test 6: User answers 'I want everything managed through one system.' -> All 6 populated", () => {
    const state: PulseState = {
      ...baseState,
      stage: "discovery",
      step: 5,
      answers: [
        "It's for my restaurant.",
        "Customers should be able to order food online.",
        "We currently take orders through WhatsApp.",
        "It's difficult to keep track of all the orders.",
        "I want everything managed through one system.",
      ],
      context: { intent: "Start Something New", industry: "Hospitality & Restaurant" },
    };

    expect(getSequentialNodeValue(0, state)).toBe("Start Something New");
    expect(getSequentialNodeValue(1, state)).toMatch(/Restaurant/i);
    expect(getSequentialNodeValue(2, state)).toMatch(/Online Food Ordering|Order/i);
    expect(getSequentialNodeValue(3, state)).toMatch(/WhatsApp/i);
    expect(getSequentialNodeValue(4, state)).toMatch(/Difficult to track/i);
    expect(getSequentialNodeValue(5, state)).toMatch(/Centralized order management|managed/i);
  });
});
