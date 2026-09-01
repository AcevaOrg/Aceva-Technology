import { LLMMessage } from "./llm";
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
 * Detect the target discovery field based on the active question in history or missing context.
 */
export function detectActiveQuestionTarget(
  history?: LLMMessage[],
  context?: Record<string, unknown>
): DiscoveryQuestionField {
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

  // 1. General Input Quality & Noise Checks (Gibberish, Incoherent WH-chain, Greetings, Company FAQ)
  if (isGibberishInput(clean)) return { isValid: false };
  if (isIncoherentQuestion(clean)) return { isValid: false };
  if (isGreetingInput(clean)) return { isValid: false };
  if (isCasualOrFAQOrGeneralQuery(clean)) return { isValid: false };

  const lower = clean.toLowerCase();

  // 2. Field-Specific Answer Validation
  switch (targetField) {
    case "budget": {
      // Rejections for budget question:
      // Reject pure timeline text (e.g., "As soon as possible", "ASAP", "3 weeks", "next month")
      const isTimelineOnly = /^(as soon as possible|asap|urgent|immediately|next month|next week|\d+\s*(weeks?|months?|days?))[\s!.]*$/i.test(lower);
      if (isTimelineOnly) return { isValid: false };

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

      // Valid Budget Acceptance:
      // Monetary numbers ($5,000, 5000, 5k, 10k-20k, $5k-$10k, five thousand dollars)
      const hasMonetary = /\$?\d{1,3}(,\d{3})*(\.\d{2})?\s*k?\b|\b\d+\s*k\b|\b(dollars?|usd|thousand|hundred|million)\b/i.test(lower);
      // Valid Uncertainty / Team Discussion / Flexible / TBD
      const hasValidUncertainty = /\b(not sure|haven'?t decided|not decided|tbd|to be decided|team|discuss|discuss with|flexible|open|deal|negotiate|window|undecided)\b/i.test(lower);

      if (hasMonetary || hasValidUncertainty || /\bbudget\b/i.test(lower)) {
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
