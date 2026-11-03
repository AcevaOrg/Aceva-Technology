import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { buildChatRequestBody, initialState } from "@/components/pulse/PulseContext";
import { inferContextForAnswer } from "@/components/pulse/PulseMessages";
import type { PulseState } from "@/components/pulse/types";
import { generatePulseCompletion, diversifySources, keepCompetitiveChunks, PULSE_ID_LOOKUP_REPLY, type LLMMessage } from "@/lib/pulse/llm";
import { generateEmbedding } from "@/lib/pulse/embeddings";
import { findSimilarChunks } from "@/lib/pulse/vectorStore";
import { CLARIFY_REFERENCE_REPLY, GREETING_REJECTION, OUT_OF_SCOPE_REJECTION } from "@/lib/pulse/scope";
import { ALL_GENERATION_SETS, COVERAGE_CASES, CSV_ROW_CASES, GENERAL_CASES, PROJECT_ASK, type CoverageCase } from "./pulseManagerAnswers";

/**
 * Live coverage of ACEVA's approved answers (2-3 November 2026).
 *
 * Part 1 checks retrieval for every phrasing that names an approved fact,
 * through the same embed → findSimilarChunks → diversify → keepCompetitive
 * pipeline that `generatePulseCompletion` uses, so a miss here is a miss in
 * production.
 *
 * Part 2 asks every phrasing of every set through the real chat route, the way
 * the Pulse panel sends it: a first message is typed on the welcome screen and
 * arrives as the answer to discovery step 0; a follow-up carries its history.
 * Only the request is simulated. A company question that the route mistook for
 * a discovery answer is therefore caught here — retrieval alone would pass it.
 *
 * Part 3 asks each row of the manager's CSV (aceva_pulse_knowledge_base.csv in
 * the repo root, untracked and git-ignored) in its own words, scored against
 * the case CSV_ROW_CASES maps it to. It is skipped when the file is absent.
 *
 * Cost: about 520 gpt-4o-mini completions and 440 embeddings per run, roughly
 * US$0.60-0.90 at list prices. Needs OPENAI_API_KEY and network access; `npm
 * test` never runs it.
 *
 *   npx vitest run --config vitest.eval.config.ts tests/eval/pulseManagerAnswersEval.test.ts
 *
 * PULSE_MANAGER_EVAL=retrieval skips generation. PULSE_AUDIT_OUT=<file> writes
 * every question, answer and verdict as JSON for the audit report.
 */

const CONCURRENCY = 6;
const RETRIEVAL_ONLY = process.env.PULSE_MANAGER_EVAL === "retrieval";
const AUDIT_OUT = process.env.PULSE_AUDIT_OUT;
const CSV_PATH = path.join(process.cwd(), "aceva_pulse_knowledge_base.csv");

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i]);
      }
    })
  );
  return out;
}

/** The retrieval topic exactly as generatePulseCompletion builds it. */
function searchTopic(question: string, history?: LLMMessage[]): string {
  const firstUser = history?.find((m) => m.role === "user")?.content;
  return firstUser && firstUser !== question ? `${question} ${firstUser}`.slice(0, 300) : question;
}

/** Minimal RFC 4180 reader: quoted fields may hold commas, quotes and newlines. */
function readCsvQuestions(file: string): Map<number, string> {
  const questions = new Map<number, string>();
  if (!fs.existsSync(file)) return questions;
  const text = fs.readFileSync(file, "utf8");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const idCol = header.indexOf("id");
  const questionCol = header.indexOf("question");
  for (const r of rows.slice(1)) {
    const id = Number(r[idCol]);
    if (Number.isInteger(id) && r[questionCol]?.trim()) questions.set(id, r[questionCol].trim());
  }
  return questions;
}

/** Replies that are canned rather than generated from the knowledge base. */
const CANNED = new Set([GREETING_REJECTION, OUT_OF_SCOPE_REJECTION, CLARIFY_REFERENCE_REPLY, PULSE_ID_LOOKUP_REPLY]);
const isCanned = (answer: string) =>
  CANNED.has(answer.trim()) || /^PULSE is currently unavailable|^I'm having trouble responding/.test(answer.trim());

/** Sends one message through the real route exactly as the Pulse panel would. */
async function askThroughRoute(message: string, history?: LLMMessage[]) {
  const state: PulseState = history?.length
    ? {
        ...initialState,
        open: true,
        stage: "discovery",
        step: 0,
        messages: history.map((m, i) => ({
          id: `h${i}`,
          sender: m.role === "user" ? ("user" as const) : ("pulse" as const),
          text: m.content,
          timestamp: "",
        })),
      }
    : { ...initialState, open: true, stage: "intent" };
  const inferred = inferContextForAnswer(message, 0, state.context);
  const body = buildChatRequestBody(message, state, inferred, 0);
  const response = await POST(
    new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify({ ...body, sessionId: crypto.randomUUID() }),
    })
  );
  const data = (await response.json()) as { answer?: string; isValid?: boolean; nextStep?: number; reasked?: boolean };
  return { status: response.status, ...data, answer: data.answer ?? "" };
}

const probe = await generatePulseCompletion("What services does ACEVA offer?", undefined, undefined, "manager-answers-probe");
const live = probe.isFallback === false && probe.answer.length > 0;
if (!live) console.warn("[manager-answers-eval] SKIPPED: no live model (needs OPENAI_API_KEY and network).");

const csvQuestions = readCsvQuestions(CSV_PATH);
const caseById = new Map(
  Object.values(ALL_GENERATION_SETS)
    .flat()
    .map((c) => [c.id, c] as const)
);

interface Job {
  set: string;
  testCase: CoverageCase;
  question: string;
  csvRow?: number;
}

const csvJobs: Job[] = [...csvQuestions].flatMap(([row, question]) => {
  const testCase = caseById.get(CSV_ROW_CASES[row]);
  return testCase ? [{ set: "csv", testCase, question, csvRow: row }] : [];
});

const jobs: Job[] = [
  ...Object.entries(ALL_GENERATION_SETS).flatMap(([set, cases]) =>
    cases.flatMap((testCase) => testCase.phrasings.map((question) => ({ set, testCase, question })))
  ),
  ...csvJobs,
];

const key = (job: Pick<Job, "question" | "set"> & { testCase: { id: string } }) => `${job.set}::${job.testCase.id}::${job.question}`;
const retrieval = new Map<string, { hit: boolean; top: string[] }>();
const verdicts = new Map<string, { answer: string; failures: string[] }>();

function judge(job: Job, reply: Awaited<ReturnType<typeof askThroughRoute>>): string[] {
  const { testCase } = job;
  const failures: string[] = [];
  if (reply.status !== 200) failures.push(`HTTP ${reply.status}`);
  if (!testCase.allowFallback && isCanned(reply.answer)) failures.push(`canned fallback instead of an answer: ${reply.answer}`);
  for (const pattern of testCase.must) if (!pattern.test(reply.answer)) failures.push(`missing ${pattern}`);
  for (const pattern of testCase.mustNot) if (pattern.test(reply.answer)) failures.push(`forbidden ${pattern}`);
  if (testCase.general) {
    if (PROJECT_ASK.test(reply.answer)) failures.push(`turned a company question into project discovery (${PROJECT_ASK.exec(reply.answer)?.[0]})`);
    if (reply.isValid) failures.push("route accepted a company question as a discovery answer");
    if (reply.reasked) failures.push("route spent the discovery re-ask on a company question");
  }
  return failures;
}

describe.skipIf(!live)("approved answers through the real chat route (live)", () => {
  beforeAll(async () => {
    const retrievalJobs = jobs.filter((job) => job.testCase.context && (job.set === "coverage" || job.set === "general" || job.set === "csv"));
    await pool(retrievalJobs, async (job) => {
      const topic = searchTopic(job.question, job.testCase.history);
      const embedding = await generateEmbedding(topic);
      const chosen = keepCompetitiveChunks(diversifySources(findSimilarChunks(embedding, 20, 0.02, topic)));
      // Knowledge lines wrap with indentation, so collapse all whitespace before matching.
      const hit = chosen.some((r) => job.testCase.context!.test(r.chunk.content.replace(/\s+/g, " ")));
      retrieval.set(key(job), { hit, top: chosen.slice(0, 4).map((r) => r.chunk.id) });
    });
    if (!RETRIEVAL_ONLY) {
      await pool(jobs, async (job) => {
        const reply = await askThroughRoute(job.question, job.testCase.history);
        verdicts.set(key(job), { answer: reply.answer, failures: judge(job, reply) });
      });
    }
    const hits = [...retrieval.values()].filter((r) => r.hit).length;
    const passed = [...verdicts.values()].filter((v) => v.failures.length === 0).length;
    console.log(`[manager-answers-eval] retrieval ${hits}/${retrieval.size}; answers ${passed}/${verdicts.size}; csv rows ${csvJobs.length}`);

    if (AUDIT_OUT) {
      const records = jobs.map((job) => ({
        set: job.set,
        id: job.testCase.id,
        csvRow: job.csvRow,
        source: job.testCase.source,
        general: Boolean(job.testCase.general),
        history: job.testCase.history?.map((m) => `${m.role}: ${m.content}`),
        question: job.question,
        retrieval: retrieval.get(key(job)),
        answer: verdicts.get(key(job))?.answer,
        failures: verdicts.get(key(job))?.failures,
      }));
      fs.mkdirSync(path.dirname(AUDIT_OUT), { recursive: true });
      fs.writeFileSync(AUDIT_OUT, JSON.stringify(records, null, 2));
    }
  }, 1_800_000);

  describe("retrieval reaches the approved fact", () => {
    for (const job of jobs.filter((j) => j.testCase.context && (j.set === "coverage" || j.set === "general" || j.set === "csv"))) {
      it(`${job.set}/${job.testCase.id}${job.csvRow ? ` (row ${job.csvRow})` : ""}: "${job.question}"`, () => {
        const result = retrieval.get(key(job));
        expect(result?.hit, `context lacks ${job.testCase.context}; top chunks: ${result?.top.join(", ")}`).toBe(true);
      });
    }
  });

  for (const set of [...Object.keys(ALL_GENERATION_SETS), "csv"]) {
    describe.skipIf(RETRIEVAL_ONLY)(`answers: ${set}`, () => {
      for (const job of jobs.filter((j) => j.set === set)) {
        it(`${job.testCase.id}${job.csvRow ? ` (row ${job.csvRow})` : ""}: "${job.question}"`, () => {
          const verdict = verdicts.get(key(job));
          expect(verdict, "no reply recorded").toBeDefined();
          expect(verdict!.failures, `answer: ${verdict!.answer}`).toEqual([]);
        });
      }
    });
  }

  it("covers every CSV row when the CSV is present", () => {
    if (csvQuestions.size === 0) return;
    const unmapped = [...csvQuestions.keys()].filter((row) => !caseById.has(CSV_ROW_CASES[row]));
    expect(unmapped, "CSV rows with no case").toEqual([]);
  });

  it("has a general-question set", () => {
    expect(GENERAL_CASES.length).toBeGreaterThan(10);
    expect(COVERAGE_CASES.filter((c) => c.general).length).toBeGreaterThan(20);
  });
});
