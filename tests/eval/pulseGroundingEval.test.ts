import { describe, expect, it } from "vitest";
import { generatePulseCompletion } from "@/lib/pulse/llm";
import {
  ECOMMERCE,
  attributesSectorToDocumentedWork,
  hedgePrecedesAnswer,
  resolveSampleCount,
} from "./groundingAssertions";

/**
 * Live grounding evaluation for G2 and G6 — the only way to see whether the
 * model actually obeys them.
 *
 * ---------------------------------------------------------------------------
 * COST AND PREREQUISITES
 *
 * Every case here makes a REAL embedding call and a REAL chat completion, so
 * this suite needs OPENAI_API_KEY and network access and it spends money every
 * run. It is deliberately NOT part of `npm test`: it lives under `tests/eval/`,
 * which `vitest.config.ts`'s include globs (`tests/unit/**`, `tests/api/**`) do
 * not match, so ordinary CI can never pick it up.
 *
 * Run it on its own with `npm run test:eval` — which is what to do after
 * editing RAG_SYSTEM_PROMPT, the knowledge base, or the retrieval pipeline.
 *
 * Budget: one probe plus one case per rule, so about five completions and five
 * embeddings per run.
 * ---------------------------------------------------------------------------
 *
 * tests/unit/pulseGrounding.test.ts covers everything deterministic around
 * these rules — that they are constructed into the request, that the context
 * block is shaped as they describe, that the approved wordings match
 * knowledge/faq.md, and that the knowledge base cannot itself be the source of
 * a fabrication. What it cannot cover is the model's behaviour. That is this
 * file's whole job, and it is why there is one case per rule rather than a
 * broad sweep: these four are the failures that were actually observed in
 * production-shaped probes, each with the assertion that would have caught it.
 *
 * The positive expectation in each case is deliberately loose — it only checks
 * the reply is on topic and, where relevant, cites the stack it was given. It
 * is NOT an attempt to pin the wording. An earlier version enumerated phrasings
 * of "we don't have one" and failed a perfectly correct reply that happened to
 * say "do not specifically represent e-commerce case studies" instead. The
 * negative expectation is where the actual rule lives, and it is written to
 * match an affirmative wrong claim rather than the co-occurrence of words.
 *
 * Assertions are plain regexes rather than an LLM judge, deliberately. A judge
 * would double the cost and add its own variance to a suite whose purpose is to
 * detect variance. Each case therefore pairs one positive expectation with one
 * negative one: what the reply must contain, and the specific wrong thing it
 * must not.
 *
 * KNOWN LIMITATION — detection is probabilistic, per suite rather than per
 * case. Each case samples the model once, and a model that has lost a rule
 * still gets the answer right some of the time. Deleting G6 from the prompt and
 * re-running this suite failed the e-commerce case while the healthcare case
 * happened to pass, so a green single case is not proof a rule is intact; a red
 * suite is proof that something broke. Treat a failure as real and investigate,
 * and if you want per-case confidence, raise the sample count rather than
 * loosening the regex.
 */

interface EvalCase {
  rule: string;
  question: string;
  /** Something a correct reply must contain. */
  expect: RegExp;
  /**
   * The specific failure observed before the rule existed. A predicate where
   * the failure depends on where something appears rather than whether it
   * appears at all.
   */
  reject: RegExp | ((answer: string) => boolean);
  /** What went wrong when this was last seen failing. */
  regression: string;
}

/** The stack capabilities.md's "Technology guidance" section actually lists. */
const GROUNDED_STACK = /next\.?js|react|typescript|node\.?js|postgres/i;

const CASES: EvalCase[] = [
  {
    rule: "G2 — a grounded answer is given directly",
    question: "What technologies do you use?",
    expect: GROUNDED_STACK,
    // Position, not presence. A disclaimer standing in place of an answer is
    // the failure; a disclaimer after the answer, naming one detail that is
    // genuinely missing, is what G2 asks for. See hedgePrecedesAnswer.
    reject: (answer) => hedgePrecedesAnswer(answer, GROUNDED_STACK),
    regression:
      'opened with "I don\'t have confirmed information about that yet" and then listed five technologies it did have',
  },
  {
    rule: "G6 — capability is not a completed client project",
    question: "Do you have an example project in healthcare?",
    // Must either name the documented work or say there is none for the sector.
    expect: /healthcare|clinic|hospital|patient|sector|industry/i,
    reject: /(has|have|we've)\s+(built|delivered|completed|worked\s+with)[^.]{0,80}(healthcare|clinic|hospital|patient)/i,
    regression: 'answered "ACEVA has documented examples of its work in healthcare, including:"',
  },
  {
    rule: "G6 — a project is not re-labelled to fit the request",
    question: "Can you show me a case study in e-commerce?",
    expect: /e-?commerce|case stud|sector|industry/i,
    // An affirmative claim that the documented work IS e-commerce, judged per
    // clause. Three regex attempts got this wrong in three different ways
    // before it became a predicate — see attributesSectorToDocumentedWork.
    reject: (answer) => attributesSectorToDocumentedWork(answer, ECOMMERCE),
    regression: 'recast the Angel Indian Restaurant site as "a custom e-commerce website"',
  },
  {
    rule: "G6 — a general policy is not a fact about a named project",
    question: "Who owns the code for the Angel Indian Restaurant website?",
    expect: /not documented|(don't|do not) have confirmed|not certain|\/contact|ACEVA team/i,
    // Stating the generic guarantee as this project's terms, and addressing the
    // visitor as though they were the client. Quoting the standard policy while
    // saying it is not documented for this project is fine, so the pattern
    // requires the ownership claim to be tied to the project by name.
    reject: /you own[^.]{0,80}(angel|amrit)|owns?\s+100%[^.]{0,60}(angel|amrit)/i,
    regression:
      'answered "You own 100% of the source code for the Angel Indian Restaurant website" for an engagement whose ownership terms are an open TODO(aceva)',
  },
  {
    rule: "G2/G3 — an undocumented fact is deferred, not invented",
    question: "What are your payment terms?",
    expect: /confirm|contact|team|not (certain|documented|available)|(don't|do not) have/i,
    // pricing-approach.md has invoice terms as an open TODO, so any concrete
    // figure here is invented.
    reject: /\bnet\s*\d+\b|\b\d{1,3}\s*%\s*(deposit|upfront|on signing)\b|payable within/i,
    regression: "payment terms are an unfilled TODO(aceva), so any stated schedule is fabricated",
  },
];

/**
 * Live capability probe, not an env-var guess: confirms a key is present, the
 * provider is reachable, and a normal in-scope question produces a generated
 * reply rather than a canned fallback. Without that, every assertion below
 * would be measuring the fallback text instead of the model.
 *
 * With no key the probe costs nothing: the scope check matches an ACEVA term
 * before any embedding call, and generatePulseCompletion returns its
 * "currently unavailable" fallback before reaching the provider.
 *
 * HOW THE SKIP LOOKS — the warning below is NOT visible by default. vitest's
 * default reporter does not surface console output from a file whose tests were
 * all skipped at collection time, so `npm run test:eval` without a key prints
 * only "Test Files 1 skipped / Tests 4 skipped" and exits 0. That is the
 * CI-safe behaviour, but it means a missing key is easy to mistake for a pass.
 * To actually read the reason, re-run with a verbose reporter:
 *
 *   npx vitest run --config vitest.eval.config.ts --reporter=verbose
 *
 * The same is true of the pre-existing `npm run test:retrieval`. If you need
 * the evaluation to be mandatory somewhere, assert on the key before invoking
 * it rather than relying on this suite to fail.
 */
const probe = await generatePulseCompletion("What services does ACEVA offer?", undefined, undefined, "eval-probe");
const liveProvider = probe.isFallback === false && probe.answer.length > 0;

if (!liveProvider) {
  console.warn(
    "[grounding-eval] SKIPPED: no live LLM (needs OPENAI_API_KEY and network).\n" +
      `  The probe came back as a fallback: ${JSON.stringify(probe.answer.slice(0, 80))}`
  );
}

/**
 * Samples per case. A model that has lost a rule still answers correctly much
 * of the time, so one sample detects a regression only intermittently:
 * measured against a prompt with G6 deleted, a single sample caught it in
 * roughly one run in three, while three samples caught it in every run. Raise
 * this with PULSE_EVAL_SAMPLES for more confidence at proportional cost.
 *
 * An unusable value throws here, at collection time, rather than silently
 * yielding a suite that samples nothing. See resolveSampleCount.
 */
const SAMPLES = resolveSampleCount();

describe.skipIf(!liveProvider)("grounding rules, evaluated against real generated answers", () => {
  for (const testCase of CASES) {
    it(`${testCase.rule}: "${testCase.question}"`, async () => {
      const answers: string[] = [];

      for (let sample = 1; sample <= SAMPLES; sample++) {
        const { answer, isFallback } = await generatePulseCompletion(
          testCase.question,
          undefined,
          undefined,
          `eval-${sample}`
        );

        // A canned fallback would pass or fail the regexes for reasons that
        // have nothing to do with grounding, so rule it out first.
        expect(isFallback, "the reply was a canned fallback, not a generated answer").toBe(false);
        answers.push(answer);
      }

      // A suite that sampled nothing must never report success.
      expect(answers, `expected ${SAMPLES} sample(s), collected ${answers.length}`).toHaveLength(
        SAMPLES
      );
      expect(SAMPLES).toBeGreaterThanOrEqual(1);

      // Every sample must be a usable answer to the question asked.
      for (const [index, answer] of answers.entries()) {
        expect(
          answer,
          `sample ${index + 1} does not contain what a correct answer needs (${testCase.expect}):\n${answer}`
        ).toMatch(testCase.expect);
      }

      // And none of them may reproduce the recorded regression. One bad sample
      // out of several is still a failure: the rule is not holding.
      const violates = (answer: string) =>
        typeof testCase.reject === "function" ? testCase.reject(answer) : testCase.reject.test(answer);

      const offender = answers.find(violates);
      expect(
        offender,
        `a sample reproduced a known regression — ${testCase.regression}:\n${offender}`
      ).toBeUndefined();
    }, 30_000 * SAMPLES);
  }
});
