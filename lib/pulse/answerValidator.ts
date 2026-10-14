import { LLMMessage } from "./llm";
import { getDiscoveryField } from "./discoverySteps";
import {
  isGibberishInput,
  isIncoherentQuestion,
  isGreetingInput,
  isCasualOrFAQOrGeneralQuery,
  isProjectDiscoveryInput,
} from "./scope";

export type DiscoveryQuestionField =
  | "budget"
  | "timeline"
  | "industry"
  | "platform"
  | "friction"
  | "scale"
  | "goals"
  | "general_discovery";


/**
 * A real monetary amount.
 *
 * Deliberately strict. The previous pattern began `\$?\d{1,3}`, so the bare "2"
 * in "end of Q2" read as a budget figure and a timeline answer satisfied the
 * budget question. A figure now needs a currency symbol, a k/m suffix, grouped
 * or four-plus digits, or a spelled-out money word.
 */
const MONETARY_AMOUNT =
  /[$€£]\s?\d|\b\d+(\.\d+)?\s*(k|m|mil|million|thousand)\b|\b\d{1,3}(,\d{3})+\b|\b\d{4,}\b|\b(dollars?|usd|eur|euros?|gbp|pounds?|rupees?|pkr)\b/i;

/**
 * The user has a budget position but declines to name a figure. Still a valid
 * answer to the budget question — "whatever it takes" is a real answer, not a
 * non-answer, and used to be rejected, stalling progress at the final step.
 */
const BUDGET_DEFERRED =
  /\b(not sure|haven'?t decided|not decided|undecided|tbd|to be decided|discuss|discussion|team|negotiate|negotiable|flexible|open|no limit|no cap|no fixed|no set|within reason|market rate|going rate|whatever it (takes|costs)|what ?ever it costs|what it (takes|costs)|depends on (the )?scope)\b/i;

/** Explicitly names the subject of the question. */
const BUDGET_SUBJECT = /\b(budget|budgets|cost|costs|price|pricing|spend|invest|investment|rate|rates|quote)\b/i;

/**
 * Detect the target discovery field for the answer being validated.
 *
 * `step` is the wizard step the client is displaying and is authoritative when
 * present: `DISCOVERY_STEP_FIELDS` maps it straight to a field. The keyword
 * heuristics below only run for free chat, where there is no step — they read
 * the last assistant bubble, and Pulse's own prose sets them off. "When things
 * get busy, what slows your team down?" matched the timeline pattern on the
 * word "when" alone, so a friction answer at step 2 was validated against the
 * timeline question and, because timeline/budget marks the end of discovery,
 * the route closed the questioning phase three steps early.
 *
 * An unmapped or out-of-range step falls through to the heuristics, so this is
 * a narrowing of when they apply rather than a replacement.
 */
export function detectActiveQuestionTarget(
  history?: LLMMessage[],
  context?: Record<string, unknown>,
  step?: unknown
): DiscoveryQuestionField {
  // 0. The question actually on screen, when the client told us which it is.
  const stepField = getDiscoveryField(step);
  if (stepField) return stepField;

  // 1. Check the last assistant question in history
  if (history && history.length > 0) {
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant")?.content.toLowerCase() || "";
    
    if (/\b(budget|cost|price|pricing|financial|money|investment)\b/i.test(lastAssistantMsg)) {
      return "budget";
    }
    if (/\b(timeline|timeframe|launch|deadline|weeks|months|when|asap|time frame)\b/i.test(lastAssistantMsg)) {
      return "timeline";
    }
    if (/\b(platform|web app|mobile app|website or app|ios|android|desktop application)\b/i.test(lastAssistantMsg)) {
      return "platform";
    }
    if (/\b(industry|field|sector|business type|type of business)\b/i.test(lastAssistantMsg)) {
      return "industry";
    }
    if (/\b(slow|manual|friction|bottleneck|problem|chaotic|frustrating|pain point)\b/i.test(lastAssistantMsg)) {
      return "friction";
    }
    if (/\b(success|goals|capabilities|outcomes|results|features|results matter)\b/i.test(lastAssistantMsg)) {
      return "goals";
    }
  }

  // 2. Fallback based on missing context fields in sequence
  if (!context?.intent) return "general_discovery";
  if (!context?.industry) return "industry";
  if (!context?.friction) return "friction";
  if (!context?.scale) return "scale";
  if (!context?.goals) return "goals";
  if (!context?.timeline && !context?.budget) return "budget"; // final discovery step

  return "general_discovery";
}

/**
 * Validates a user's answer against the target discovery question field.
 * Returns isValid: true ONLY when the message contains meaningful intent AND provides a relevant answer to the current question.
 */
export function validateAnswerAgainstQuestion(
  message: string,
  targetField: DiscoveryQuestionField
): { isValid: boolean; normalizedValue?: string } {
  const clean = message.trim();
  if (!clean) return { isValid: false };

  const lower = clean.toLowerCase();

  // An unmistakable answer to the question actually being asked outranks the
  // generic noise heuristics below. `isProjectDiscoveryInput` lists "whatever"
  // among its dismissive-noise words, which vetoed "whatever it takes" before
  // the budget case ever ran — a real answer, rejected, stalling the final step.
  const answersBudgetOutright =
    targetField === "budget" && (MONETARY_AMOUNT.test(lower) || BUDGET_DEFERRED.test(lower));

  // 1. General Input Quality & Noise Checks (Gibberish, Incoherent WH-chain, Greetings, Company FAQ)
  if (isGibberishInput(clean)) return { isValid: false };
  if (isIncoherentQuestion(clean)) return { isValid: false };
  if (isGreetingInput(clean)) return { isValid: false };
  if (!answersBudgetOutright && isCasualOrFAQOrGeneralQuery(clean)) return { isValid: false };

  // 2. Field-Specific Answer Validation
  switch (targetField) {
    case "budget": {
      const hasAmount = MONETARY_AMOUNT.test(lower);
      const isDeferred = BUDGET_DEFERRED.test(lower);
      const namesSubject = BUDGET_SUBJECT.test(lower);

      // A pure timeline answer — "As soon as possible", "3 weeks", "end of Q2"
      // — carries none of the three signals below and so falls through to the
      // rejection at the end of this case. It no longer slips past on a stray
      // digit: MONETARY_AMOUNT used to start `\$?\d{1,3}`, which matched the
      // "2" of "Q2". A combined "6 weeks, around $15k" still passes, on the
      // strength of the figure rather than the week count.

      // Reject pure industry text (e.g., "restaurant", "healthcare", "education", "finance")
      const isIndustryOnly = /^(restaurant|cafe|hotel|clinic|healthcare|education|school|gym|salon|real estate|ecommerce|shop|logistics|dairy|finance|fintech|legal|travel|manufacturing)[\s!.]*$/i.test(lower);
      if (isIndustryOnly) return { isValid: false };

      // Reject standalone project statements that do not answer budget (e.g., "I need a mobile app for my restaurant.")
      if (
        /\b(mobile app|website|web app|restaurant|hotel|clinic|store)\b/i.test(lower) &&
        !/\b(\$|\d+|k|budget|cost|price|team|discuss|flexible|tbd|sure|decided|window)\b/i.test(lower)
      ) {
        return { isValid: false };
      }

      if (hasAmount || isDeferred || namesSubject) {
        return { isValid: true };
      }

      return { isValid: false };
    }

    case "timeline": {
      // Rejections for timeline question:
      // Reject pure monetary budget text (e.g., "$5,000", "5000", "$10k", "five thousand dollars")
      const isBudgetOnly = /^(\$?\d{1,3}(,\d{3})*\s*k?|\$\d+|\d+\s*k|five thousand dollars)[\s!.]*$/i.test(lower);
      if (isBudgetOnly) return { isValid: false };

      // Reject pure industry text
      const isIndustryOnly = /^(restaurant|cafe|hotel|clinic|healthcare|education|school|gym|salon|real estate|ecommerce|shop|logistics|dairy|finance|fintech|legal|travel|manufacturing)[\s!.]*$/i.test(lower);
      if (isIndustryOnly) return { isValid: false };

      // Valid Timeline Acceptance:
      const hasTimelineKey = /\b(asap|as soon as possible|urgent|immediately|week|weeks|month|months|quarter|q[1-4]|day|days|year|flexible|tbd|not sure|not decided|discuss|team|launch|timeframe|time frame)\b/i.test(lower);
      if (hasTimelineKey) {
        return { isValid: true };
      }

      return { isValid: false };
    }

    case "platform": {
      // Rejections for platform question:
      const isMonetaryOrTimeline = /^(\$?\d{1,3}(,\d{3})*|\$\d+|\d+\s*k|asap|as soon as possible|\d+\s*(weeks|months))[\s!.]*$/i.test(lower);
      if (isMonetaryOrTimeline) return { isValid: false };

      // Reject standalone industry text when platform is specifically asked (e.g. "Restaurant")
      const isPureIndustry = /^(restaurant|cafe|hotel|clinic|healthcare|education|school|gym|salon|real estate|ecommerce|shop|logistics|dairy|finance|fintech|legal|travel|manufacturing)[\s!.]*$/i.test(lower);
      if (isPureIndustry) return { isValid: false };

      // Valid Platform Acceptance:
      const hasPlatformKey = /\b(website|web|web app|mobile|mobile app|mobile application|app|ios|android|desktop|saas|both|platform|deciding|not sure|team)\b/i.test(lower);
      if (hasPlatformKey) {
        return { isValid: true };
      }

      return { isValid: false };
    }

    case "industry": {
      // Rejections for industry question:
      const isMonetaryOrTimeline = /^(\$?\d{1,3}(,\d{3})*|\$\d+|\d+\s*k|asap|as soon as possible|\d+\s*(weeks|months))[\s!.]*$/i.test(lower);
      if (isMonetaryOrTimeline) return { isValid: false };

      // Valid Industry Acceptance:
      return { isValid: isProjectDiscoveryInput(clean) };
    }

    default: {
      return { isValid: isProjectDiscoveryInput(clean) };
    }
  }
}
