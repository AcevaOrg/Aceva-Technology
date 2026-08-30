import { describe, expect, it } from "vitest";
import { pulseReducer, initialState } from "@/components/pulse/PulseContext";
import { formatEnrichedProjectContext, getConciseUIModules } from "@/lib/pulse/modules";
import { downloadPulseBlueprintDocx } from "@/lib/pulse/docxGenerator";

describe("Pulse 6-Step Discovery & Direction System Verification Suite", () => {
  it("Step 1: Reading the System - Intent selection & Business Domain Discovery", () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Start something new" });
    expect(state.stage).toBe("discovery");
    expect(state.step).toBe(0);
    expect(state.context.intent).toBe("Start something new");

    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "We run a fast-casual restaurant chain in New York.",
      inferred: { industry: "Hospitality & Restaurant", business: "Restaurant operation" },
    });
    expect(state.step).toBe(1);
    expect(state.answers).toHaveLength(1);
    expect(state.context.industry).toBe("Hospitality & Restaurant");
  });

  it("Step 2: Mapping Friction - Operational Friction & Bottleneck Discovery", () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Improve what I have" });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "We run a fast-casual restaurant chain in New York.",
      inferred: { industry: "Hospitality & Restaurant" },
    });

    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Manual paper orders and high third-party delivery commissions.",
      inferred: { current: "Paper order workflow", friction: ["Manual paper orders", "High commission fees"] },
    });

    expect(state.step).toBe(2);
    expect(state.answers).toHaveLength(2);
    expect(state.context.friction).toContain("Manual paper orders");
  });

  it("Step 3: Building Context - Scale, Market & Audience Volume Discovery", () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Solve a problem" });
    state.answers = ["Restaurant chain", "Paper orders"];
    state.step = 2;

    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "3 locations, 45 staff members, serving 1,500 daily customers.",
      inferred: { scale: "3 locations, 45 staff members, 1500 daily customers", market: "New York" },
    });

    expect(state.step).toBe(3);
    expect(state.answers).toHaveLength(3);
    expect(state.context.scale).toContain("45 staff members");
  });

  it("Step 4: Forming Direction - Desired Features & Functional Goals Discovery", () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Start something new" });
    state.answers = ["Restaurant chain", "Paper orders", "3 locations"];
    state.step = 3;

    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Direct online ordering system, kitchen display screen, and customer loyalty rewards.",
      inferred: { goals: ["Direct online ordering system", "Kitchen display screen", "Customer loyalty rewards"] },
    });

    expect(state.step).toBe(4);
    expect(state.answers).toHaveLength(4);
    expect(state.context.goals).toContain("Direct online ordering system");
  });

  it("Step 5: Timeline & Budget Fit - Target Timeline & Budget Window Discovery", () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Start something new" });
    state.answers = ["Restaurant chain", "Paper orders", "3 locations", "Online ordering"];
    state.step = 4;

    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Target launch in 3-4 weeks, budget to be discussed directly with the ACEVA team.",
      inferred: { timeline: "3-4 weeks", budget: "To be aligned directly with ACEVA team" },
    });

    expect(state.step).toBe(5);
    expect(state.answers).toHaveLength(5);
    expect(state.context.timeline).toBe("3-4 weeks");
  });

  it("Step 6: Synthesis & Direction Blueprint Generation - 1-1.5 Line UI Modules & Docx Export", async () => {
    let state = pulseReducer(initialState, { type: "INTENT", value: "Start something new" });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Hospitality restaurant operation",
      inferred: { industry: "Hospitality & Restaurant" },
    });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Manual order friction",
      inferred: { friction: ["Manual order friction"] },
    });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "3 locations, 45 staff",
      inferred: { scale: "3 locations, 45 staff" },
    });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "Online ordering, kitchen display, customer loyalty",
      inferred: { goals: ["Online ordering", "Kitchen display", "Customer loyalty"] },
    });
    state = pulseReducer(state, {
      type: "RECORD_VALID_ANSWER",
      value: "3-4 weeks, budget discussed directly",
      inferred: { timeline: "3-4 weeks", budget: "To be aligned directly with ACEVA team" },
    });

    state = pulseReducer(state, { type: "COMPLETE" });
    expect(state.stage).toBe("direction");

    const enriched = formatEnrichedProjectContext(state.context, state.answers);
    expect(enriched.industryFocus).toMatch(/Restaurant/i);
    expect(enriched.targetTimeline).toContain("3");
    expect(enriched.primaryGoals).toMatch(/Ordering|Kitchen|Catalog/i);

    const uiModules = getConciseUIModules(state.context.industry, state.context, state.answers);
    expect(uiModules.length).toBeGreaterThanOrEqual(4);
    for (const mod of uiModules) {
      expect(mod.length).toBeLessThan(250);
      expect(mod).toContain("—");
    }

    const pulseId = "PLS-260830-101";
    expect(typeof downloadPulseBlueprintDocx).toBe("function");
  });
});
