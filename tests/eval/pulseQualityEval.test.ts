import { describe, expect, it } from "vitest";
import { generatePulseCompletion, diversifySources, keepCompetitiveChunks } from "@/lib/pulse/llm";
import { generateEmbedding } from "@/lib/pulse/embeddings";
import { findSimilarChunks } from "@/lib/pulse/vectorStore";
import { QUALITY_CASES, openingSentence, scoreAnswer, type QualityCase } from "./pulseQualityDataset";
import { QUESTION_BANK_CASES } from "./pulseQuestionBank";

/**
 * The live Pulse quality evaluation (P3, 30 October 2026). Run with
 *
 *   npx vitest run --config vitest.eval.config.ts tests/eval/pulseQualityEval.test.ts
 *
 * Each case in pulseQualityDataset.ts is answered by the real model
 * PULSE_QUALITY_SAMPLES times (default 2), and its retrieval is measured
 * separately with the same hybrid search the chat uses. It costs a few cents
 * of gpt-4o-mini and text-embedding-3-small per run and skips without a key.
 *
 * Hard rules fail the case outright: any invented fact, any leak of internal
 * material or customer data, and any gap answer that gives the visitor no
 * route to the team. Correctness, retrieval relevance, consistency and the
 * variety of deferral wording are measured across the run and held to the
 * thresholds in the final test, which also prints the metrics table.
 *
 * The knowledge-expansion question bank (pulseQuestionBank.ts) runs with the
 * same scorer and thresholds. PULSE_QUALITY_SET=core or =bank runs one set on
 * its own; the default runs both. PULSE_QUALITY_RETRIEVAL_ONLY=1 measures
 * retrieval alone, without generating any answer, so a knowledge or ranking
 * change can be compared before and after for the price of the embeddings.
 */

const SAMPLES = Number(process.env.PULSE_QUALITY_SAMPLES || 2);
if (!Number.isInteger(SAMPLES) || SAMPLES < 1) throw new Error("PULSE_QUALITY_SAMPLES must be a positive whole number");

const SET = process.env.PULSE_QUALITY_SET || "all";
if (!["all", "core", "bank"].includes(SET)) throw new Error("PULSE_QUALITY_SET must be all, core or bank");
const CASES: QualityCase[] = [
  ...(SET === "bank" ? [] : QUALITY_CASES),
  ...(SET === "core" ? [] : QUESTION_BANK_CASES),
];

const RETRIEVAL_ONLY = process.env.PULSE_QUALITY_RETRIEVAL_ONLY === "1";

const THRESHOLDS = { correctness: 0.9, retrieval: 0.9, consistency: 0.85, deferralVariety: 0.5 };

const probe = await generatePulseCompletion("What services does ACEVA offer?", undefined, undefined, "quality-probe");
const live = probe.isFallback === false && probe.answer.length > 0;
if (!live) console.warn("[quality-eval] SKIPPED: no live model (needs OPENAI_API_KEY and network).");

interface CaseResult {
  testCase: QualityCase;
  answers: string[];
  correct: boolean[];
  hallucinated: boolean[];
  leaked: boolean[];
  retrievalHit: boolean | null;
  retrievedFiles: string[];
}
const results: CaseResult[] = [];

/** The same search topic and selection the chat route uses. */
async function retrievedFiles(testCase: QualityCase): Promise<string[]> {
  let topic = testCase.question;
  const industry = testCase.projectContext?.industry;
  const firstUser = testCase.history?.find((turn) => turn.role === "user")?.content;
  if (typeof industry === "string") topic = `${testCase.question} ${industry}`;
  else if (firstUser && firstUser !== testCase.question) topic = `${testCase.question} ${firstUser}`.slice(0, 300);
  const embedding = await generateEmbedding(topic);
  const chosen = keepCompetitiveChunks(diversifySources(findSimilarChunks(embedding, 20, 0.02, topic)));
  return [...new Set(chosen.map((result) => result.chunk.id.replace(/-chunk-\d+$/, "")))];
}

const rate = (hits: number, total: number) => (total === 0 ? 1 : hits / total);

describe.skipIf(!live)("Pulse quality evaluation (live)", () => {
  for (const testCase of CASES) {
    it(`${testCase.topic} / ${testCase.id}`, async () => {
      const result: CaseResult = {
        testCase,
        answers: [],
        correct: [],
        hallucinated: [],
        leaked: [],
        retrievalHit: null,
        retrievedFiles: [],
      };

      if (testCase.expectedSources?.length) {
        result.retrievedFiles = await retrievedFiles(testCase);
        result.retrievalHit = testCase.expectedSources.some((source) => result.retrievedFiles.includes(source));
      }

      for (let sample = 1; sample <= (RETRIEVAL_ONLY ? 0 : SAMPLES); sample++) {
        const { answer, isFallback } = await generatePulseCompletion(
          testCase.question,
          testCase.history,
          testCase.projectContext,
          `quality-${testCase.id}-${sample}`
        );
        if (!testCase.allowFallback) expect(isFallback, `${testCase.id}: canned fallback instead of an answer`).toBe(false);
        const verdict = scoreAnswer(testCase, answer);
        if (process.env.PULSE_QUALITY_VERBOSE === "1") {
          console.log(`[quality-eval] ${testCase.id} #${sample}${verdict.correct ? "" : " (INCOMPLETE)"}:\n${answer}\n`);
        }
        result.answers.push(answer);
        result.correct.push(verdict.correct);
        result.hallucinated.push(verdict.hallucinated);
        result.leaked.push(verdict.leaked);

        expect(verdict.hallucinated, `${testCase.id} sample ${sample} invented or contradicted a fact: ${verdict.failures.join("; ")}\n${answer}`).toBe(false);
        expect(verdict.leaked, `${testCase.id} sample ${sample} leaked internal material or customer data:\n${answer}`).toBe(false);
        if (testCase.kind === "gap") {
          expect(verdict.deferred, `${testCase.id} sample ${sample} gave no route to the team:\n${answer}`).toBe(true);
        }
      }
      results.push(result);
    }, 60_000 * SAMPLES);
  }

  it("meets the aggregate quality thresholds", () => {
    const samples = results.flatMap((r) => r.correct);
    const withRetrieval = results.filter((r) => r.retrievalHit !== null);
    const consistent = results.filter((r) => r.correct.every((c) => c === r.correct[0]));
    const gapOpenings = results.filter((r) => r.testCase.kind === "gap").flatMap((r) => r.answers.map(openingSentence));
    const privacy = results.filter((r) => r.testCase.privacy);

    const metrics = {
      cases: results.length,
      samples: samples.length,
      correctness: rate(samples.filter(Boolean).length, samples.length),
      retrievalRelevance: rate(withRetrieval.filter((r) => r.retrievalHit).length, withRetrieval.length),
      hallucinationRate: rate(results.flatMap((r) => r.hallucinated).filter(Boolean).length, samples.length),
      leakRate: rate(results.flatMap((r) => r.leaked).filter(Boolean).length, samples.length),
      privacyCasesPassed: `${privacy.filter((r) => !r.leaked.some(Boolean)).length}/${privacy.length}`,
      consistency: rate(consistent.length, results.length),
      deferralVariety: rate(new Set(gapOpenings).size, gapOpenings.length),
    };
    console.log("[quality-eval] metrics", JSON.stringify(metrics, null, 2));
    // Per-topic correctness, so a regression in one area is visible even when
    // the overall rate still clears its threshold.
    const byTopic: Record<string, string> = {};
    for (const topic of [...new Set(results.map((r) => r.testCase.topic))]) {
      const topicSamples = results.filter((r) => r.testCase.topic === topic).flatMap((r) => r.correct);
      byTopic[topic] = `${topicSamples.filter(Boolean).length}/${topicSamples.length}`;
    }
    if (!RETRIEVAL_ONLY) console.log("[quality-eval] correct samples by topic", JSON.stringify(byTopic));

    const misses = results.filter((r) => r.correct.some((c) => !c)).map((r) => r.testCase.id);
    const retrievalMisses = withRetrieval
      .filter((r) => !r.retrievalHit)
      .map((r) => `${r.testCase.id} -> ${r.retrievedFiles.join(", ")}`);
    if (misses.length) console.log("[quality-eval] cases with an incomplete or incorrect sample:", misses.join(", "));
    if (retrievalMisses.length) console.log("[quality-eval] retrieval misses:", retrievalMisses.join(" | "));

    expect(results.length, "every case must have run").toBe(CASES.length);
    if (RETRIEVAL_ONLY) {
      expect(metrics.retrievalRelevance).toBeGreaterThanOrEqual(THRESHOLDS.retrieval);
      return;
    }
    expect(metrics.hallucinationRate).toBe(0);
    expect(metrics.leakRate).toBe(0);
    expect(metrics.correctness).toBeGreaterThanOrEqual(THRESHOLDS.correctness);
    expect(metrics.retrievalRelevance).toBeGreaterThanOrEqual(THRESHOLDS.retrieval);
    expect(metrics.consistency).toBeGreaterThanOrEqual(THRESHOLDS.consistency);
    expect(metrics.deferralVariety).toBeGreaterThanOrEqual(THRESHOLDS.deferralVariety);
  });
});
