import { WizardStepSpec } from "@/components/pulse/types";

/**
 * The discovery questions, in order.
 *
 * Shared deliberately: the wizard renders `title` as its heading while the chat
 * route pins the same string into the prompt. When these lived only inside
 * PulseMessages the server had no idea which question was on screen, so the
 * model asked whatever it liked and the user saw two different questions at
 * once — the heading ("Where do things feel slow or manual today?") above a
 * Pulse bubble asking about patient portals and integrations.
 */
export const DISCOVERY_STEPS: readonly WizardStepSpec[] = [
  {
    label: "READING THE SYSTEM",
    title: "Tell us about your business or project.",
    helper: "What do you do, or what would you like to build, and who is it for?",
    placeholder: "e.g. We run a neighborhood restaurant in New York and want a direct online ordering website...",
  },
  {
    label: "MAPPING FRICTION",
    title: "Where do things feel slow or manual today?",
    helper: "Describe what takes too much time, feels confusing, or needs fixing.",
    placeholder: "e.g. Taking orders over WhatsApp is chaotic and hard to keep track of...",
  },
  {
    label: "BUILDING CONTEXT",
    title: "What does your operation look like today?",
    helper: "Share your team size, locations, daily customers, or general scale.",
    placeholder: "e.g. 2 locations, 15 team members, around 300 orders per day...",
  },
  {
    label: "FORMING DIRECTION",
    title: "What would success look like for you?",
    helper: "Tell us what key results or main capabilities matter most to you.",
    placeholder: "e.g. Customers can order online directly, and kitchen staff see orders on one simple screen...",
  },
  {
    label: "TIMELINE & BUDGET FIT",
    title: "What is your target launch timeline and budget window?",
    helper: "Specify your target launch timeframe and budget range (or if you prefer to discuss directly with ACEVA's team).",
    placeholder: "e.g. Target launch in 4-6 weeks, budget range to be discussed directly with the ACEVA team...",
  },
];

export const DISCOVERY_STEP_COUNT = DISCOVERY_STEPS.length;

/** The index of the last discovery question. A valid answer to it ends questioning. */
export const FINAL_DISCOVERY_STEP = DISCOVERY_STEPS.length - 1;

/**
 * The context field each step's answer fills, in the same order as the
 * questions above.
 *
 * This is the authoritative mapping. `detectActiveQuestionTarget` used to infer
 * it by keyword-matching the last assistant bubble, which misread Pulse's own
 * prose: the single word "when" in "When things get busy, what slows your team
 * down?" matched the timeline pattern, so a step-2 friction answer was
 * validated as a timeline answer and — because timeline/budget marks the final
 * step — Pulse announced that discovery was complete three questions early.
 * The client already sends the step it is displaying, so the field is known
 * rather than guessed.
 *
 * Step 5 asks for timeline and budget together and maps to "budget", which is
 * the stricter of the two: it accepts a figure, a deferral ("discuss with the
 * team", "flexible"), or a combined answer, and re-asks when only a timeline
 * was given.
 */
export const DISCOVERY_STEP_FIELDS = [
  "industry",
  "friction",
  "scale",
  "goals",
  "budget",
] as const;

export type DiscoveryStepField = (typeof DISCOVERY_STEP_FIELDS)[number];

/** The field `step`'s answer belongs to, or undefined if `step` is not a step. */
export function getDiscoveryField(step: unknown): DiscoveryStepField | undefined {
  if (typeof step !== "number" || !Number.isInteger(step)) return undefined;
  return DISCOVERY_STEP_FIELDS[step];
}

/** The question the interface is showing for `step`, or undefined if out of range. */
export function getDiscoveryQuestion(step: unknown): string | undefined {
  if (typeof step !== "number" || !Number.isInteger(step)) return undefined;
  return DISCOVERY_STEPS[step]?.title;
}

/** The clarifying line shown under the question for `step`. */
export function getDiscoveryHelper(step: unknown): string | undefined {
  if (typeof step !== "number" || !Number.isInteger(step)) return undefined;
  return DISCOVERY_STEPS[step]?.helper;
}
