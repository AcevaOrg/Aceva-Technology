import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { generateEmbedding, getExpectedEmbeddingDimension } from "@/lib/pulse/embeddings";
import { findSimilarChunks, loadVectorIndex } from "@/lib/pulse/vectorStore";

/**
 * Retrieval quality against the real index — no mocks, no fixtures.
 *
 * ---------------------------------------------------------------------------
 * COST AND PREREQUISITES
 *
 * This suite makes roughly 15 LIVE embedding calls to the OpenAI API per run
 * (one capability probe, plus one per active question), so it needs
 * OPENAI_API_KEY and network access and it spends a fraction of a cent every
 * time `npm test` runs. Without a usable key the whole suite SKIPS with a
 * warning rather than failing — see the `liveEmbeddings` probe below.
 * ---------------------------------------------------------------------------
 *
 * Every other suite stubs `generateEmbedding` to keep itself offline, which
 * means the vector half of the hybrid score is never exercised: keyword-only
 * ranking still "passes" while cosine similarity is silently broken. That is
 * exactly the failure this repo already shipped once (a 384-dim index queried
 * with 1536-dim vectors, so cosine returned 0 for every chunk and nobody
 * noticed). These cases embed live and hold the retriever to a numeric bar, so
 * a regression in the index, the chunker, or the embedding model shows up here.
 *
 * The bar per question:
 *   - a chunk from the expected knowledge file is in the top 3, and
 *   - the top score clears that question's score threshold (see below).
 *
 * Expectations name the source FILE, not a chunk number. Chunk ids are
 * positional (`faq-chunk-2`), so inserting a heading renumbers everything after
 * it; pinning the number would make routine knowledge edits fail this suite for
 * no retrieval reason. The file is the stable identity of "the right chunk".
 */

/**
 * Score thresholds, in two tiers.
 *
 * The hybrid score is 0.5*cosine + 0.5*termRelevance. When a visitor uses the
 * corpus's own vocabulary both halves fire and the score is high: "What is a
 * Proof Sprint?" measures 0.853. When they paraphrase, the keyword half can only
 * match body text and a correct top hit measures 0.43-0.49 — so a single 0.5 bar
 * failed questions whose retrieval was in fact right, which said nothing about
 * quality.
 *
 * So questions that quote a named term from the knowledge base are held to the
 * higher bar and everything else to 0.35. A case claims the higher bar by
 * declaring `verbatimTerm`, and "the question set itself" below checks that claim
 * against the markdown: a declared term must really occur both in the question
 * and in the expected file's headings or title, so the tier cannot be granted by
 * assertion alone.
 */
const MIN_TOP_SCORE = 0.35;
const VERBATIM_MIN_TOP_SCORE = 0.5;
const TOP_K = 3;

interface RetrievalCase {
  category: string;
  question: string;
  /** Knowledge file (without .md) expected to supply the answer. */
  expectedSource: string;
  /**
   * A named term the corpus defines, quoted verbatim by the question — a proper
   * noun, product name, acronym, or titled section topic. Ordinary English that
   * merely happens to appear inside a heading ("launch" in "Post-Launch Support
   * & Maintenance SLA", "database", "pricing") is NOT a knowledge term and must
   * not be declared: it would impose the high bar on what is really a
   * paraphrase.
   */
  verbatimTerm?: string;
}

const CASES: RetrievalCase[] = [
  // ---- pricing ----
  { category: "pricing", question: "How much would a project like this cost?", expectedSource: "pricing-approach" },
  { category: "pricing", question: "What engagement models do you offer?", expectedSource: "how-aceva-helps", verbatimTerm: "Engagement Models" },
  { category: "pricing", question: "Do you charge a fixed price or by the hour?", expectedSource: "faq" },

  // ---- NDA / confidentiality ----
  { category: "nda", question: "Will you sign an NDA before we share details?", expectedSource: "nda-and-confidentiality", verbatimTerm: "NDA" },
  { category: "nda", question: "How do you keep our project information confidential?", expectedSource: "nda-and-confidentiality" },
  { category: "nda", question: "Who owns the intellectual property for the code you write?", expectedSource: "process-deliverables-and-guarantees" },

  // ---- tech stack ----
  { category: "tech-stack", question: "What technology stack do you build with?", expectedSource: "tech-stack-and-architecture", verbatimTerm: "Technology Stack" },
  { category: "tech-stack", question: "Do you build with Next.js and React?", expectedSource: "tech-stack-and-architecture", verbatimTerm: "Next.js" },
  { category: "tech-stack", question: "Which database do you use for a new project?", expectedSource: "tech-stack-and-architecture" },

  // ---- timeline ----
  { category: "timeline", question: "How long does a typical project take to deliver?", expectedSource: "process" },
  { category: "timeline", question: "Can you guarantee a delivery date before we start?", expectedSource: "process" },
  { category: "timeline", question: "How soon will someone review my requirements?", expectedSource: "process-deliverables-and-guarantees" },

  // ---- process ----
  { category: "process", question: "What does your development process look like?", expectedSource: "process-deliverables-and-guarantees" },
  { category: "process", question: "What is a Proof Sprint?", expectedSource: "proof-sprint", verbatimTerm: "Proof Sprint" },
  { category: "process", question: "Our previous developer left the product broken and unfinished.", expectedSource: "rescue-sprint" },

  // ---- support ----
  { category: "support", question: "What happens after launch if we find a bug?", expectedSource: "process-deliverables-and-guarantees" },
  { category: "support", question: "Do you offer ongoing maintenance and monitoring?", expectedSource: "process-deliverables-and-guarantees" },
  { category: "support", question: "Do we get administrative access to our own hosting and repositories?", expectedSource: "faq" },

  // ---- industries ----
  { category: "industries", question: "Do you build software for dairy farms?", expectedSource: "how-aceva-helps", verbatimTerm: "Dairy Farms" },
  { category: "industries", question: "Have you built anything for law firms?", expectedSource: "how-aceva-helps" },
];

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

function readKnowledgeFile(source: string): string | null {
  const file = path.join(KNOWLEDGE_DIR, source + ".md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
}

/**
 * A knowledge file still carrying `TODO(aceva)` is an unfinished fact sheet the
 * owner has yet to fill in. Asserting retrieval quality against it would be
 * asserting against a placeholder, so those cases skip themselves and arm
 * automatically once the markers are replaced with real facts.
 */
function hasUnfilledTodos(source: string): boolean {
  return readKnowledgeFile(source)?.includes("TODO(aceva)") ?? false;
}

/** Every heading plus the frontmatter title — where the corpus names things. */
function headingsAndTitle(source: string): string {
  const raw = readKnowledgeFile(source) ?? "";
  const headings = [...raw.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim());
  const frontmatterTitle = raw.match(/^title:\s*(.+)$/m)?.[1] ?? "";
  return [...headings, frontmatterTitle].join(" | ").toLowerCase();
}

function thresholdFor(testCase: RetrievalCase): number {
  return testCase.verbatimTerm ? VERBATIM_MIN_TOP_SCORE : MIN_TOP_SCORE;
}

function sourceOf(chunkId: string): string {
  return chunkId.replace(/-chunk-\d+$/, "");
}

function format(results: { chunk: { id: string; metadata: { heading?: string } }; score: number }[]): string {
  if (!results.length) return "    (no chunks returned)";
  return results
    .map((r, i) => `    ${i + 1}. ${r.chunk.id} [${r.chunk.metadata.heading ?? ""}] score=${r.score.toFixed(4)}`)
    .join("\n");
}

const active = CASES.filter((c) => !hasUnfilledTodos(c.expectedSource));
const skipped = CASES.filter((c) => hasUnfilledTodos(c.expectedSource));

// Live capability probe, not an env-var guess: this confirms a key is present,
// the API is reachable, and the vector it returns is the width the index was
// built at. Without all three the hybrid score collapses to keyword-only, where
// the thresholds are meaningless — so the suite skips loudly rather than passing
// on half a score or failing CI for a missing secret.
const probe = await generateEmbedding("ACEVA pricing and engagement models");
const liveEmbeddings = probe !== null && probe.length === getExpectedEmbeddingDimension();

if (!liveEmbeddings) {
  console.warn(
    "[retrieval-quality] SKIPPED: live embeddings unavailable (needs OPENAI_API_KEY and network).\n" +
      "  These assertions need a real query vector; keyword-only scoring cannot meet the score bar."
  );
}
if (skipped.length) {
  console.warn(
    `[retrieval-quality] ${skipped.length} of ${CASES.length} questions skipped — knowledge file still has TODO(aceva):\n` +
      [...new Set(skipped.map((c) => c.expectedSource))].map((s) => `  - ${s}.md`).join("\n")
  );
}

describe("the question set itself", () => {
  it("covers all seven visitor topics across twenty questions", () => {
    expect(CASES).toHaveLength(20);
    expect([...new Set(CASES.map((c) => c.category))].sort()).toEqual([
      "industries",
      "nda",
      "pricing",
      "process",
      "support",
      "tech-stack",
      "timeline",
    ]);
  });

  it("names a source that actually exists in the index", () => {
    // A mistyped expectedSource could never appear in any result, making the
    // case permanently unsatisfiable rather than permanently skipped.
    const indexed = new Set(loadVectorIndex().chunks.map((c) => sourceOf(c.id)));
    for (const c of CASES) {
      expect(indexed, `no chunk in the index comes from ${c.expectedSource}.md`).toContain(c.expectedSource);
    }
  });

  it("only grants the higher score bar to questions that really quote the corpus", () => {
    // Without this, a case could claim `verbatimTerm` — and the 0.5 bar — for a
    // term the knowledge base never uses, or that its own question never says.
    const claimed = CASES.filter((c) => c.verbatimTerm);
    expect(claimed).not.toHaveLength(0);

    for (const c of claimed) {
      const term = c.verbatimTerm!.toLowerCase();
      expect(
        c.question.toLowerCase(),
        `declares verbatimTerm "${c.verbatimTerm}" but its own question does not contain it`
      ).toContain(term);
      expect(
        headingsAndTitle(c.expectedSource),
        `declares verbatimTerm "${c.verbatimTerm}" but no heading or title in ${c.expectedSource}.md contains it`
      ).toContain(term);
      expect(thresholdFor(c)).toBe(VERBATIM_MIN_TOP_SCORE);
    }

    for (const c of CASES.filter((x) => !x.verbatimTerm)) {
      expect(thresholdFor(c)).toBe(MIN_TOP_SCORE);
    }
  });
});

describe.skipIf(!liveEmbeddings)("retrieval quality against the real index", () => {
  const embeddings = new Map<string, number[] | null>();

  beforeAll(async () => {
    // One batch of live calls up front, shared by every case below.
    const embedded = await Promise.all(active.map((c) => generateEmbedding(c.question)));
    active.forEach((c, i) => embeddings.set(c.question, embedded[i]));
  }, 60_000);

  for (const testCase of active) {
    const bar = thresholdFor(testCase);
    const tier = testCase.verbatimTerm ? `verbatim "${testCase.verbatimTerm}"` : "paraphrase";

    it(`[${testCase.category}] "${testCase.question}" -> ${testCase.expectedSource} (${tier}, >=${bar})`, () => {
      const embedding = embeddings.get(testCase.question);
      expect(embedding, "live embedding missing for this question").not.toBeNull();

      // minScore 0 so the assertions below decide, not the retriever's filter.
      const results = findSimilarChunks(embedding ?? null, TOP_K, 0, testCase.question);

      expect(results.length, "retrieval returned nothing").toBeGreaterThan(0);

      const sources = results.map((r) => sourceOf(r.chunk.id));
      expect(
        sources,
        `expected a chunk from ${testCase.expectedSource}.md in the top ${TOP_K}, got:\n${format(results)}`
      ).toContain(testCase.expectedSource);

      expect(
        results[0].score,
        `top score ${results[0].score.toFixed(4)} is below the ${tier} bar of ${bar}:\n${format(results)}`
      ).toBeGreaterThanOrEqual(bar);
    });
  }

  for (const testCase of skipped) {
    it.skip(`[${testCase.category}] "${testCase.question}" -> ${testCase.expectedSource}.md still has TODO(aceva)`, () => {});
  }
});
