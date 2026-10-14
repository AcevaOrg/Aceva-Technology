import { describe, expect, it } from "vitest";

import * as modules from "@/lib/pulse/modules";
import { getRecommendedModules, isCodebaseModernization } from "@/lib/pulse/modules";
import type { PulseContextData } from "@/components/pulse/types";

/**
 * Recomputes the module list exactly the way each consumer does, so a divergence
 * between the screen and the deliverables would show up here.
 *
 * - UI panel:     PulseMessages stage 3
 * - saved record: the /api/pulse/save-direction payload
 * - lead email:   built server-side from that same payload
 * - docx:         docxGenerator
 * - PULSE lookup: llm.ts, from the stored SavedDirection
 */
function asConsumersSeeIt(context: PulseContextData, answers: string[]) {
  return {
    uiPanel: getRecommendedModules(context.industry, context, answers),
    savedRecord: getRecommendedModules(context.industry, context, answers),
    docx: getRecommendedModules(context.industry, context, answers),
    // The lookup path reads the persisted record back, so context may be partial.
    pulseLookup: getRecommendedModules(context?.industry, context, answers),
  };
}

const SCENARIOS = [
  {
    label: "dairy",
    context: { intent: "Automate something", industry: "Dairy & Agriculture" } as PulseContextData,
    answers: [
      "We run a dairy farm and supply milk to distributors",
      "Yield logging is done by hand every morning",
    ],
    // The branch that existed only in the concise UI ladder.
    expect: /milk|yield|dairy|farm/i,
    rejectGeneric: true,
  },
  {
    label: "finance",
    context: { intent: "Start something new", industry: "Finance & Fintech" } as PulseContextData,
    answers: [
      "We are a microfinance lender and need customer onboarding",
      "Loan approval is manual and slow",
    ],
    // The branch that existed only in the detailed ladder.
    expect: /kyc|wallet|loan|ledger|fraud/i,
    rejectGeneric: true,
  },
] as const;

/** The fallback list, which neither scenario should land on. */
const GENERIC_FIRST_MODULE = "Core Web Application Interface & User Portal";

describe("recommended modules come from a single source", () => {
  it("exposes no second module ladder", () => {
    // getConciseUIModules was a near-duplicate of getRecommendedModules and the
    // two drifted: it had a dairy branch the other lacked, and lacked the
    // fintech branch the other had. Nothing may reintroduce a parallel ladder.
    expect((modules as Record<string, unknown>).getConciseUIModules).toBeUndefined();
    expect(typeof getRecommendedModules).toBe("function");
  });

  for (const scenario of SCENARIOS) {
    describe(`${scenario.label} project`, () => {
      it("gives the UI panel and the saved record byte-identical output", () => {
        const seen = asConsumersSeeIt(scenario.context, [...scenario.answers]);

        expect(seen.uiPanel).toEqual(seen.savedRecord);
        expect(seen.uiPanel).toEqual(seen.docx);
        expect(seen.uiPanel).toEqual(seen.pulseLookup);
        expect(seen.uiPanel.join("\n")).toBe(seen.savedRecord.join("\n"));
      });

      it("resolves to its own industry branch, not the generic fallback", () => {
        const list = getRecommendedModules(
          scenario.context.industry,
          scenario.context,
          [...scenario.answers]
        );

        expect(list).toHaveLength(5);
        expect(list.join(" ")).toMatch(scenario.expect);
        if (scenario.rejectGeneric) {
          expect(list[0]).not.toContain(GENERIC_FIRST_MODULE);
        }
      });

      it("keeps every module in the shared display format", () => {
        // The six-steps verification relies on this shape for the UI panel.
        for (const entry of getRecommendedModules(
          scenario.context.industry,
          scenario.context,
          [...scenario.answers]
        )) {
          expect(entry).toContain("—");
          expect(entry.length).toBeLessThan(250);
        }
      });
    });
  }

  it("distinguishes dairy from finance rather than collapsing both to one branch", () => {
    const dairy = getRecommendedModules(
      SCENARIOS[0].context.industry,
      SCENARIOS[0].context,
      [...SCENARIOS[0].answers]
    );
    const finance = getRecommendedModules(
      SCENARIOS[1].context.industry,
      SCENARIOS[1].context,
      [...SCENARIOS[1].answers]
    );

    expect(dairy).not.toEqual(finance);
    expect(dairy.join(" ")).toMatch(/milk|yield/i);
    expect(finance.join(" ")).toMatch(/kyc|ledger/i);
  });

  describe("no module claims a vendor, framework or certification", () => {
    // knowledge/faq.md: "Do not invent clients, testimonials, results,
    // technologies, certifications, cloud providers, databases, or
    // guarantees." The module ladder is not model output, so none of the
    // grounding rules in RAG_SYSTEM_PROMPT constrain it — yet it reaches the
    // visitor through the stage-3 panel, the lead email, the emailed blueprint
    // and the .docx. It used to promise HIPAA compliance, name Stripe, PayPal,
    // FedEx, UPS and DHL, and describe mobile work as "Native" and
    // "Cross-Platform Native" while knowledge/mobile-products.md still has the
    // mobile framework open for confirmation.
    const UNVERIFIED = /\b(HIPAA|SOC ?2|PCI|GDPR|ISO ?27001|Stripe|PayPal|FedEx|UPS|DHL|Twilio|Firebase|coroutine)\b|Cross-Platform Native|Native (iOS|Mobile)/i;

    const projects: [string, string[]][] = [
      ["healthcare", ["We run a dental clinic and need patient booking"]],
      ["e-commerce", ["We sell clothes online and need checkout"]],
      ["logistics", ["We run a delivery fleet and need dispatch tracking"]],
      ["mobile", ["We need a mobile app for our customers"]],
      ["code migration", ["migrate our legacy Java codebase to Kotlin"]],
      ["restaurant", ["We run a restaurant and want online ordering"]],
      ["dairy", ["We run a dairy farm supplying distributors"]],
      ["real estate", ["We manage rental properties and tenants"]],
      ["finance", ["We are a microfinance lender needing onboarding"]],
      ["generic", ["We need an internal tool for our team"]],
    ];

    for (const [label, answers] of projects) {
      it(`${label}`, () => {
        const list = getRecommendedModules(undefined, {}, answers);
        expect(list).toHaveLength(5);
        expect(list.join(" ")).not.toMatch(UNVERIFIED);
      });
    }
  });

  describe("code migration is distinguished from an ordinary upgrade", () => {
    const TRANSPILATION = /transpil|null-safety|language migration|dependency mapping/i;

    it("does not hand a restaurant site Java-to-Kotlin modules for the word 'upgrade'", () => {
      // The refactor branch was tested ahead of every industry branch and its
      // pattern included a bare "upgrade", so this exact sentence produced a
      // codebase-audit and syntax-migration blueprint for a restaurant.
      const list = getRecommendedModules(undefined, { intent: "Improve what I have" }, [
        "I want to upgrade my restaurant ordering website",
      ]);

      expect(list.join(" ")).not.toMatch(TRANSPILATION);
      expect(list.join(" ")).toMatch(/menu|kitchen|ordering/i);
    });

    it("still recognises a real code migration", () => {
      for (const answer of [
        "migrate our legacy Java codebase to Kotlin",
        "we need to refactor the backend",
        "upgrade our API framework version",
      ]) {
        expect(isCodebaseModernization(answer)).toBe(true);
        expect(getRecommendedModules(undefined, {}, [answer]).join(" ")).toMatch(TRANSPILATION);
      }
    });

    it("treats ordinary improvement wording as ordinary work", () => {
      for (const answer of [
        "I want to upgrade my restaurant ordering website",
        "we want to improve what we have",
        "modernize our brand and website design",
      ]) {
        expect(isCodebaseModernization(answer)).toBe(false);
      }
    });
  });

  it("detects a microfinance lender as finance", () => {
    // Word-bounding `finance` stopped it matching the compound "microfinance",
    // which the unanchored original did match.
    const list = getRecommendedModules(undefined, {}, ["We are a microfinance organisation"]);

    expect(list.join(" ")).toMatch(/kyc|wallet|ledger/i);
    expect(list[0]).not.toContain(GENERIC_FIRST_MODULE);
  });
});
