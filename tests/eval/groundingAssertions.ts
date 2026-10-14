/**
 * Pure helpers for the live grounding evaluation.
 *
 * They sit outside the suite file deliberately. `pulseGroundingEval.test.ts`
 * runs a live provider probe at module scope, so importing *that* from the
 * default test run would fire a paid API call. Importing this module cannot do
 * anything, which is what lets `tests/unit/pulseGrounding.test.ts` cover the
 * sample-count validation and the disclaimer-position rule deterministically
 * and offline.
 *
 * Neither vitest config collects this file as a suite: the default run includes
 * only `tests/unit/**` and `tests/api/**`, and the eval config only
 * `tests/eval/**` files ending in `.test.ts`.
 */

export const DEFAULT_EVAL_SAMPLES = 3;

export class InvalidSampleCountError extends Error {
  constructor(raw: string) {
    super(
      `PULSE_EVAL_SAMPLES must be a positive whole number, got ${JSON.stringify(raw)}. ` +
        `Leave it unset to use the default of ${DEFAULT_EVAL_SAMPLES}.`,
    );
    this.name = "InvalidSampleCountError";
  }
}

/**
 * How many times the evaluation samples each case.
 *
 * Throws rather than falling back on anything unusable. This replaces
 * `Math.max(1, Number(raw ?? 3))`, which returned NaN for a typo such as
 * `PULSE_EVAL_SAMPLES=abc`; the sample loop then ran zero times and the suite
 * reported "4 passed" in 25ms having made no provider calls at all. A green run
 * that evaluated nothing is worse than a red one, so an unusable value now
 * fails loudly at collection time instead.
 *
 * An unset or empty value means "not configured" and takes the default, which
 * matches how a shell treats `PULSE_EVAL_SAMPLES=`.
 */
export function resolveSampleCount(
  raw: string | undefined = process.env.PULSE_EVAL_SAMPLES,
): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_EVAL_SAMPLES;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidSampleCountError(raw);
  }

  return parsed;
}

/** Phrasings that defer a question rather than answering it. */
const UNCERTAINTY =
  /\b(not certain|(?:don't|do not) have confirmed information|no confirmed information)\b/i;

/**
 * True when an uncertainty disclaimer comes BEFORE the grounded answer.
 *
 * G2 draws a line that matching the disclaimer anywhere could not see. A
 * disclaimer that *replaces* an answer is the failure this rule exists for. A
 * disclaimer that *follows* a real answer and names one still-missing detail is
 * explicitly correct under the same rule — "answer the covered part plainly and
 * name only the specific piece that needs confirming". The previous assertion
 * searched the whole reply and so flagged compliant answers such as "ACEVA uses
 * Next.js, React, TypeScript and PostgreSQL. The specific cloud host is not
 * certain, so the team can confirm." Position is the only thing separating the
 * two, so position is what this measures.
 *
 * `grounded` marks the answer the retrieved context does supply. A disclaimer
 * with no grounded content anywhere is a pure deferral on a question the
 * context covers, which is also a failure — hence the `=== -1` arm.
 */
export function hedgePrecedesAnswer(answer: string, grounded: RegExp): boolean {
  const hedgeAt = answer.search(UNCERTAINTY);
  if (hedgeAt === -1) return false;

  const groundedAt = answer.search(grounded);
  return groundedAt === -1 || hedgeAt < groundedAt;
}

/** The sector the two documented client sites are not. */
export const ECOMMERCE = /\be-?commerce\b|\bonline stores?\b|\bonline shops?\b|\bwebshops?\b/i;

/** Anything that makes a clause a denial rather than a claim. */
const NEGATION =
  /\b(?:not|never|neither|nor|none|no|without|cannot|lacks?|lacking|unfortunately|outside|beyond|instead of|other than|rather than)\b|n't/i;

/** Hedged or hypothetical: describes what could be, not what was delivered. */
const HYPOTHETICAL = /\b(?:can|could|may|might|would|should|if|whether|able to|capable of)\b/i;

/** A reference to the client work this knowledge base documents. */
const WORK_REFERENCE =
  "\\b(?:these|those|this|the|both|its|our)\\s+(?:two\\s+)?(?:documented\\s+)?(?:client\\s+)?(?:projects?|sites?|websites?|work|portfolio)\\b|\\b(?:angel|amrit)\\b";

/** A verb that asserts the subject *is*, or *contains*, the thing named. */
const AFFIRMATIVE_LINK =
  "\\b(?:is|are|was|were|include|includes|included|features?|comprise[sd]?|consists?|consisted)\\b";

/**
 * Between the subject and its verb.
 *
 * Commas are allowed so an aside does not break the link — "These projects,
 * which we delivered in October, are e-commerce sites" is still an
 * attribution. A conjunction is not allowed: past an "and", the verb belongs
 * to a different subject.
 */
const SUBJECT_GAP = "(?:(?!\\b(?:and|or|but)\\b)[^;]){0,45}";

/**
 * Between the verb and the sector. Deliberately tighter than SUBJECT_GAP: the
 * sector has to be what the verb actually links to, not merely something later
 * in the clause.
 *
 * This is the whole of requirement 2. "The Angel site is a restaurant website
 * and an e-commerce project is something we'd scope separately" used to be
 * rejected because `angel`, `is` and `e-commerce` all appeared in one clause.
 * They are not related: "is" links Angel to "a restaurant website", and the
 * sector belongs to a second phrase after "and". Refusing to cross a
 * conjunction or a comma is what tells those two apart.
 */
const COMPLEMENT_GAP = "(?:(?!\\b(?:and|or|but)\\b)[^,;]){0,30}";

/** subject → verb → sector, in that order, each link close enough to be real. */
function attributionPattern(sector: RegExp): RegExp {
  return new RegExp(
    `(?:${WORK_REFERENCE})${SUBJECT_GAP}(?:${AFFIRMATIVE_LINK})${COMPLEMENT_GAP}(?:${sector.source})`,
    "gi",
  );
}

/**
 * Splits text into clauses, because negation governs its clause, not the
 * sentence.
 *
 * The recorded regression is why this matters: "These projects include a custom
 * e-commerce website, but there are no detailed case studies available beyond
 * these two sites." A sentence-level negation check sees the "no" in the second
 * half and lets the false claim in the first half through. Boundaries are
 * therefore sentence ends, semicolons and contrastive conjunctions — not every
 * comma, which would fragment "These projects, which we delivered in October,
 * are e-commerce sites" into pieces too small to judge.
 */
export function clausesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .flatMap((sentence) =>
      sentence.split(/\s*(?:;|,?\s*\b(?:but|however|though|although|whereas|while)\b)\s*/i),
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/**
 * True when some clause affirmatively presents the documented client work as
 * belonging to `sector`.
 *
 * This replaces a regex that tried to encode the same idea with tempered
 * lookaheads and got it wrong twice in opposite directions — first flagging
 * "…and its owner, Amrit Pal Singh, though these projects are not specifically
 * in the e-commerce sector", then flagging "The documented client work does not
 * include a specific case study in e-commerce" because that "not" sits before
 * the verb rather than after it. Two more holes survived even then: "Neither of
 * these projects is an online store", where the negation precedes the subject
 * entirely, and "The documented work includes no e-commerce component", where
 * the negation is a bare "no".
 *
 * Testing the four conditions independently across a whole clause was still a
 * bag of words, and it failed in both directions. Any clause that merely
 * contained "can", "if", "should", "beyond" or "no" anywhere was excused, so
 * "Both sites are online stores you can browse" went undetected. And any
 * clause where the three pieces co-occurred was rejected, even when they were
 * unrelated.
 *
 * So the relationship is matched explicitly — subject, verb, sector, in that
 * order and close enough to be grammatically linked — and negation or
 * hypothesis counts only when it GOVERNS that link, meaning it appears at or
 * before the sector. A qualifier after the sector ("…online stores with no
 * checkout limits") qualifies something else and no longer buys an exemption.
 */
export function attributesSectorToDocumentedWork(answer: string, sector: RegExp): boolean {
  const attribution = attributionPattern(sector);

  return clausesOf(answer).some((clause) =>
    [...clause.matchAll(attribution)].some((match) => {
      const governing = clause.slice(0, match.index + match[0].length);
      return !NEGATION.test(governing) && !HYPOTHETICAL.test(governing);
    }),
  );
}
