import { describe, expect, it } from "vitest";

import { inferContextFromText, INDUSTRY_RULES } from "@/components/pulse/PulseMessages";
import { formatEnrichedProjectContext, getRecommendedModules } from "@/lib/pulse/modules";

/** The wizard step that asks each question, by the field it populates. */
const STEP = { industry: 0, friction: 1, scale: 2, goals: 3, timelineBudget: 4 } as const;

describe("inferContextFromText", () => {
  describe("each step writes only its own field", () => {
    it("files the goals answer as goals, never as the timeline", () => {
      // The previous implementation ended with
      //   if (isTimelineText || stepIndex >= 3) timeline = text
      // so this answer was stored as the project's launch timeline.
      // Deliberately full of timeline and budget vocabulary — "launch",
      // "day", "monthly", "cost" — because a goals answer that contained none
      // would pass even with the leak restored.
      const update = inferContextFromText(
        "Kitchen staff see orders the same day, we can launch menu changes monthly, and it should cut cost",
        STEP.goals,
        {}
      );

      expect(update.goals).toBeDefined();
      expect(update.timeline).toBeUndefined();
      expect(update.budget).toBeUndefined();
    });

    it("does not read a friction answer that mentions time or team as a timeline", () => {
      // "time" and "team" were both unbounded in the old timeline signal.
      for (const answer of [
        "My team spends too much time re-typing orders",
        "Sometimes the overtime hours are logged twice",
        "Our team has no visibility into daily totals",
      ]) {
        const update = inferContextFromText(answer, STEP.friction, {});

        expect(update.timeline).toBeUndefined();
        expect(update.current).toBeDefined();
      }
    });

    it("writes both timeline and budget from the combined step-4 answer", () => {
      const update = inferContextFromText(
        "Target launch in 4-6 weeks, budget around $15k",
        STEP.timelineBudget,
        {}
      );

      expect(update.timeline).toBe("4–6 Weeks");
      expect(update.budget).toBeDefined();
      expect(String(update.budget)).toMatch(/15k|\$15/i);
      expect(update.goals).toBeUndefined();
    });

    it("assigns budget when the user defers it rather than naming a figure", () => {
      const update = inferContextFromText(
        "We would rather discuss the budget with the ACEVA team directly",
        STEP.timelineBudget,
        {}
      );

      // budget was declared on PulseContextData but never assigned by anything.
      expect(update.budget).toBe("To be aligned directly with ACEVA team");
    });

    it("records a timeline-only answer without inventing a budget", () => {
      const update = inferContextFromText("As soon as possible", STEP.timelineBudget, {});

      expect(update.timeline).toBe("ASAP / Immediate Launch");
      expect(update.budget).toBeUndefined();
    });
  });

  describe("industry detection runs on every step", () => {
    it("picks up an industry first named in the friction answer", () => {
      // Step 0 produced only the generic placeholder; the domain arrives later.
      const afterStep0 = inferContextFromText("We want to modernise how we work", STEP.industry, {});
      expect(afterStep0.industry).toBe("Business Services");

      const afterStep1 = inferContextFromText(
        "Our dental clinic still tracks patients on paper",
        STEP.friction,
        afterStep0 as Record<string, unknown>
      );

      expect(afterStep1.industry).toBe("Healthcare & Clinics");
    });

    it("picks up an industry first named in the scale answer", () => {
      const update = inferContextFromText(
        "Three restaurants, about 300 covers a day",
        STEP.scale,
        { industry: "Business Services" }
      );

      expect(update.industry).toBe("Hospitality & Restaurant");
    });

    it("never overwrites an industry that is already specific", () => {
      const update = inferContextFromText(
        "We also sell merchandise in our retail shop",
        STEP.scale,
        { industry: "Healthcare & Clinics" }
      );

      expect(update.industry).toBeUndefined();
    });

    it("does not let a rule's canned friction replace the user's own words", () => {
      const update = inferContextFromText(
        "Our restaurant loses tickets between the bar and the kitchen",
        STEP.friction,
        { industry: "Business Services", friction: ["Something the user said"] }
      );

      expect(update.industry).toBe("Hospitality & Restaurant");
      expect(update.friction).toEqual(
        expect.arrayContaining([expect.stringContaining("Our restaurant loses tickets")])
      );
    });
  });
});

describe("word-boundary classification", () => {
  // Each of these matched a substring inside an ordinary word before.
  const cases = [
    {
      label: "appointment booking",
      text: "We need appointment booking for our dental clinic",
      // "app" inside "appointment"; "booking" read as a hotel
      mustNotMatchIndustry: ["Hotels & Hospitality", "Software & Technology"],
      mustNotAppearInBlueprint: [/Events & Ticketing/i],
    },
    {
      label: "confirm the order",
      text: "Customers should be able to confirm the order by email",
      // "firm" inside "confirm"
      mustNotMatchIndustry: ["Professional Services"],
      mustNotAppearInBlueprint: [/Professional Services/i],
    },
    {
      label: "show customers status",
      text: "We want to show customers their order status",
      // "show" read as a performance
      mustNotMatchIndustry: ["Events & Ticketing"],
      mustNotAppearInBlueprint: [/Events & Ticketing/i],
    },
    {
      label: "we restore furniture",
      text: "We restore vintage furniture and want a portfolio site",
      // "store" inside "restore"
      mustNotMatchIndustry: ["E-Commerce & Retail"],
      mustNotAppearInBlueprint: [/E-Commerce & Retail/i],
    },
  ] as const;

  for (const testCase of cases) {
    it(`"${testCase.label}" is not misclassified by INDUSTRY_RULES`, () => {
      const matched = INDUSTRY_RULES.find((rule) => rule.test.test(testCase.text));

      for (const wrong of testCase.mustNotMatchIndustry) {
        expect(matched?.industry).not.toBe(wrong);
      }
    });

    it(`"${testCase.label}" is not misclassified in the blueprint`, () => {
      const enriched = formatEnrichedProjectContext({}, [testCase.text]);

      for (const wrong of testCase.mustNotAppearInBlueprint) {
        expect(enriched.industryFocus).not.toMatch(wrong);
      }
    });
  }

  it("does not treat \"appointment\" or \"approval\" as a mobile app requirement", () => {
    // isMobile was /mobile|app|ios|android|native/ — "app" matched both words,
    // so these picked the native-mobile variant of every module list.
    for (const text of [
      "We need appointment booking and loan approval",
      "That workflow is not appropriate for our staff",
    ]) {
      const modules = getRecommendedModules(undefined, {}, [text]);
      expect(modules.join(" ")).not.toMatch(/Native Mobile Application|Cross-Platform Native Mobile/i);
    }
  });


  it("does not treat \"workshop\" or \"restore\" as retail", () => {
    for (const text of ["We run a workshop for mechanics", "We restore vintage furniture"]) {
      const enriched = formatEnrichedProjectContext({}, [text]);
      expect(enriched.industryFocus).not.toMatch(/E-Commerce & Retail/i);
    }
  });
});
