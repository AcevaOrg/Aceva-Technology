import { DISCOVERY_STEP_COUNT } from "./discoverySteps";

/**
 * What the visitor has already told Pulse, so discovery never asks for it again.
 *
 * Isomorphic: the chat route uses it to decide which question comes next, and
 * the browser uses the same patterns to fill the context for any step it skips,
 * so the two can never disagree about what counts as "already answered".
 *
 * Measured failure (31 October 2026): a visitor who opened with "We run two
 * restaurants, WhatsApp orders are chaotic, we want online ordering in 6 weeks
 * with about $10k" was still walked through all five questions, and every
 * valid answer drew a second, narrower question on the same subject, so a
 * single discovery ran to eight or nine questions.
 *
 * The patterns are deliberately conservative. A step is skipped only when the
 * visitor's own words plainly answer it; anything vaguer is asked as normal.
 */

/**
 * How many times, in the whole of discovery, Pulse may re-ask a question it
 * did not get an answer to. Five steps plus this one clarification keeps every
 * project to six discovery questions at most. After it is used, any genuine
 * reply (not a greeting, junk or a question of their own) is accepted.
 */
export const MAX_DISCOVERY_REASKS = 1;

/** Step 1: something is slow, manual or going wrong today. */
const FRICTION_SIGNAL =
  /\b(slow|slows|manual|manually|by hand|chaotic|messy|tedious|time[- ]consuming|takes (too )?(long|much time|hours|ages)|wast(e|es|ed|ing)|lose|loses|losing|lost|miss(es|ed)?|mistakes?|errors?|delays?|bottlenecks?|struggl(e|es|ing)|frustrat(ed|ing)|hard to|difficult to|can'?t keep track|no way to|pain ?points?|keeps? (going wrong|breaking)|double[- ]book(ed|ing|ings)?|no-shows?)\b/i;

/** Step 2: a size — a count of people, places or volume, or a stated small scale. */
const SCALE_SIGNAL =
  /\b(\d[\d,.]*\s*k?\+?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|a hundred|dozens of|hundreds of|thousands of|a few|several|a single|single)\s+([a-z-]+\s+)?(locations?|branch|branches|stores?|shops?|outlets?|sites?|offices?|clinics?|restaurants?|warehouses?|staff|employees|people|team members|members|users|customers|clients|students|patients|drivers|dentists|doctors|nurses|teachers|trainers|stylists|therapists|technicians|agents|engineers|developers|workers|couriers|managers|vehicles|trucks|orders|bookings|appointments|transactions|visitors|properties|units|tenants|rooms|beds|products|deliveries)\b|\b(solo|just me|one[- ]person|small team|family[- ]run|family business)\b/i;

/** Step 3: what success looks like or what people should be able to do. */
const GOALS_SIGNAL =
  /\b(success (would|will|means|looks like|is|for us)|our goal|the goal|main goal|goals? (is|are)|(want|like|need) (our )?(customers|clients|users|staff|patients|guests|members|students|drivers|people|tenants|them) to|so (that )?(customers|clients|users|we|staff|patients|guests|members|students|drivers|people|tenants|they) can|be able to|ideally|aim (is|to)|objective)\b/i;

/** Step 4, first half: a launch window. */
const TIMELINE_SIGNAL =
  /\b(asap|as soon as possible|urgent|urgently|immediately|within (a|an|one|two|three|four|six|\d+) (days?|weeks?|months?|quarters?|years?)|in (a|an|one|two|three|four|six|a few|\d+) (days?|weeks?|months?)|\d+\s*(-|to)\s*\d+\s*(days?|weeks?|months?)|\d+\s*(days?|weeks?|months?)|next (month|quarter|year)|by (the )?(end of )?(january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|summer|spring|autumn|fall|winter|next \w+|this year)|q[1-4]|deadline|launch (in|by|date))\b/i;

/**
 * Step 4, second half: a figure, or a budget explicitly left open. A bare
 * "10k" or "1,200" is a budget only when no head-count follows it, so
 * "10k users" is scale, not money.
 */
const BUDGET_SIGNAL =
  /[$€£]\s?\d|\b\d+(\.\d+)?\s*(k|m|thousand|million|lakh|lac|crore)\b(?!\s+([a-z-]+\s+)?(users|customers|clients|people|visitors|orders|members|students|patients|downloads|subscribers|followers|transactions|products|employees|staff|bookings))|\b(dollars?|usd|eur|euros?|gbp|pounds?|rupees?|pkr)\b|\bbudget\b[^.!?]*\b(discuss\w*|flexible|open|tbd|not sure|undecided|negotia\w*|depends)\b|\b(discuss\w*|flexible|open|tbd|undecided)\b[^.!?]*\bbudget\b/i;

/** The patterns that mark a step as answered. Step 0 always opens discovery, so it has none. */
const STEP_SIGNALS: Record<number, (text: string) => boolean> = {
  1: (text) => FRICTION_SIGNAL.test(text),
  2: (text) => SCALE_SIGNAL.test(text),
  3: (text) => GOALS_SIGNAL.test(text),
  // Asked together, so it is answered only when both halves are present.
  4: (text) => TIMELINE_SIGNAL.test(text) && BUDGET_SIGNAL.test(text),
};

/** A question back to Pulse is not an answer, however many keywords it carries. */
function isQuestionShaped(text: string): boolean {
  return text.trim().endsWith("?");
}

/** The later discovery steps (1–4) this text already answers, in order. */
export function coveredDiscoverySteps(text: string): number[] {
  const clean = text.trim();
  if (!clean || isQuestionShaped(clean)) return [];
  return Object.keys(STEP_SIGNALS)
    .map(Number)
    .filter((step) => STEP_SIGNALS[step](clean));
}

/**
 * The sentences of `text` that answer `step`, so the context for a skipped
 * step is filled from what the visitor said about it rather than from the
 * whole message. Falls back to the whole text when no single sentence does.
 */
export function clauseForDiscoveryStep(text: string, step: number): string {
  const sentences = text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const matches =
    step === 4
      ? sentences.filter((s) => TIMELINE_SIGNAL.test(s) || BUDGET_SIGNAL.test(s))
      : sentences.filter((s) => STEP_SIGNALS[step]?.(s));

  return matches.length > 0 ? matches.join(" ") : text.trim();
}

/**
 * The step to ask next after a valid answer to `step`: the first later step not
 * already answered, or DISCOVERY_STEP_COUNT when nothing is left to ask.
 */
export function nextOpenDiscoveryStep(step: number, covered: Iterable<number>): number {
  const done = new Set(covered);
  for (let next = step + 1; next < DISCOVERY_STEP_COUNT; next++) {
    if (!done.has(next)) return next;
  }
  return DISCOVERY_STEP_COUNT;
}

/**
 * Normalises an answer for repeat detection. "As I said, we run a bakery" is
 * the same answer as "We run a bakery".
 */
export function normaliseDiscoveryAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(as i said|like i said|as mentioned|again|to repeat)\s*,?\s*/i, "");
}

/**
 * "Not sure yet", "flexible", "to be discussed": an honest answer to more than
 * one question, so giving it twice is not a repeat.
 */
const REUSABLE_ANSWER =
  /^(i'?m |we'?re |i am |we are )?(not sure( yet)?|unsure|no idea|(i |we )?(don'?t|do not) know( yet)?|not decided( yet)?|(we )?haven'?t decided( yet)?|undecided|flexible|tbd|to be (decided|discussed)|none|nothing|no|n\/a|same as above)[.!]*$/i;

/** True when `text` repeats an answer already recorded. */
export function isRepeatedDiscoveryAnswer(text: string, previous: readonly string[]): boolean {
  const normalised = normaliseDiscoveryAnswer(text);
  if (!normalised || REUSABLE_ANSWER.test(normalised)) return false;
  return previous.some((answer) => normaliseDiscoveryAnswer(answer) === normalised);
}

/**
 * Untrusted `covered` from the browser: whole numbers 1–4, deduplicated. Any
 * other shape is dropped. The worst a forged list can do is skip the sender's
 * own questions.
 */
export function readCoveredSteps(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const steps = value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 1 && item < DISCOVERY_STEP_COUNT
  );
  return [...new Set(steps)].sort((a, b) => a - b);
}
