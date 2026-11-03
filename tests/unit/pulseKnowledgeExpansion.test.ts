import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Offline guards for the knowledge expansion (31 October 2026):
 *
 * - the manager confirmation register stays out of the index and stays well formed;
 * - the question bank is complete and points at real files and register rows;
 * - "General practice" sections never speak for ACEVA;
 * - every question in the bank reaches the model, not the out-of-scope reply;
 * - the bank's forbidden patterns really catch the hallucinations they exist for.
 *
 * Nothing here calls a provider.
 */

vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

import { INTERNAL_LEAK, scoreAnswer } from "../eval/pulseQualityDataset";
import { QUESTION_BANK_CASES, QUESTION_BANK_TOPICS, type QuestionBankCase } from "../eval/pulseQuestionBank";
import { isQuestionInScope } from "@/lib/pulse/scope";
import { generatePulseCompletion } from "@/lib/pulse/llm";
import { clearEnvCache } from "@/lib/pulse/env";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const REGISTER = path.join(KNOWLEDGE_DIR, "manager-confirmations.md");
/**
 * The register is internal and git-ignored (the repository is public), so it
 * exists only on maintainers' machines. Checks that read it are skipped on a
 * clean checkout; the check that nothing from it reaches the index always runs.
 */
const HAS_REGISTER = fs.existsSync(REGISTER);
const read = (file: string) => fs.readFileSync(file, "utf-8");
const index = JSON.parse(read(path.join(KNOWLEDGE_DIR, "vectorIndex.json"))) as {
  chunks: { id: string; content: string; metadata: { source: string; heading?: string } }[];
};
const markdownFiles = fs.readdirSync(KNOWLEDGE_DIR).filter((file) => file.endsWith(".md"));
const indexedFiles = markdownFiles.filter((file) => matter(read(path.join(KNOWLEDGE_DIR, file))).data.index !== false);
const REGISTER_ID = /\b(CO|CW|TS|SR|ND|PR|DW|AM|HR)-\d{2}\b/;

interface RegisterRow {
  id: string;
  cells: string[];
}

function registerRows(): RegisterRow[] {
  return read(REGISTER)
    .split(/\r?\n/)
    .filter((line) => /^\| [A-Z]{2}-\d{2} \|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return { id: cells[0], cells };
    });
}

const byId = (id: string): QuestionBankCase => {
  const found = QUESTION_BANK_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearEnvCache();
});

describe("the manager confirmation register", () => {
  it("is git-ignored, so the internal register is never pushed to the public repository", () => {
    const ignored = read(path.join(process.cwd(), ".gitignore"))
      .split(/\r?\n/)
      .map((line) => line.trim());
    expect(ignored).toContain("knowledge/manager-confirmations.md");
  });

  it.skipIf(!HAS_REGISTER)("is marked index: false", () => {
    expect(matter(read(REGISTER)).data.index).toBe(false);
  });

  it("never reaches the vector index", () => {
    const leaked = index.chunks.filter(
      (chunk) => chunk.id.startsWith("manager-confirmations") || /manager-confirmations/i.test(chunk.metadata.source) || REGISTER_ID.test(chunk.content)
    );
    expect(leaked.map((chunk) => chunk.id)).toEqual([]);
  });

  it.skipIf(!HAS_REGISTER)("has unique ids, seven filled columns, a known status and a real target file on every row", () => {
    const rows = registerRows();
    expect(rows.length).toBeGreaterThanOrEqual(60);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.cells, row.id).toHaveLength(7);
      for (const cell of row.cells) expect(cell.length, `${row.id} has an empty cell`).toBeGreaterThan(0);
      expect(["Yes", "Decide", "Team"], `${row.id} public`).toContain(row.cells[4]);
      expect(["Awaiting", "Approved", "Internal"], `${row.id} status`).toContain(row.cells[5]);
      for (const file of row.cells[6].split(",").map((name) => name.trim())) {
        expect(markdownFiles, `${row.id} points at ${file}`).toContain(file);
      }
    }
  });

  it.skipIf(!HAS_REGISTER)("covers every TODO(aceva) item still in the knowledge files", () => {
    // Each open placeholder must have a register row the manager can answer.
    // The register is matched on the distinctive words of each TODO line.
    const register = read(REGISTER).toLowerCase();
    const missing: string[] = [];
    for (const file of indexedFiles) {
      for (const line of read(path.join(KNOWLEDGE_DIR, file)).split(/\r?\n/)) {
        const todo = line.match(/TODO\(aceva\):\s*(.*)/i)?.[1];
        if (!todo) continue;
        const keywords = (todo.toLowerCase().match(/[a-z][a-z-]{5,}/g) ?? []).filter(
          (word) => !["confirm", "whether", "should", "previously", "removed", "source", "statement"].includes(word)
        );
        const hits = keywords.filter((word) => register.includes(word)).length;
        if (hits / Math.max(keywords.length, 1) < 0.5) missing.push(`${file}: ${todo.slice(0, 80)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("the question bank", () => {
  it("holds all 33 brief questions exactly once", () => {
    const numbers = QUESTION_BANK_CASES.map((c) => c.briefNumber).filter((n): n is number => typeof n === "number");
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
  });

  it("has unique ids that do not collide with the core dataset", async () => {
    const { QUALITY_CASES } = await import("../eval/pulseQualityDataset");
    const ids = [...QUALITY_CASES, ...QUESTION_BANK_CASES].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every new topic, plus paraphrases, follow-ups, ambiguity, general questions and privacy", () => {
    const topics = new Set(QUESTION_BANK_CASES.map((c) => c.topic));
    for (const topic of QUESTION_BANK_TOPICS) expect(topics.has(topic), topic).toBe(true);
    expect(QUESTION_BANK_CASES.filter((c) => c.id.startsWith("para-")).length).toBeGreaterThanOrEqual(5);
    expect(QUESTION_BANK_CASES.some((c) => c.history?.length)).toBe(true);
    expect(QUESTION_BANK_CASES.some((c) => c.id.startsWith("ambiguous-"))).toBe(true);
    expect(QUESTION_BANK_CASES.some((c) => c.category === "B")).toBe(true);
    expect(QUESTION_BANK_CASES.some((c) => c.privacy)).toBe(true);
  });

  it("points only at indexed knowledge files", () => {
    const indexed = new Set(indexedFiles.map((file) => file.replace(/\.md$/, "")));
    for (const c of QUESTION_BANK_CASES) {
      for (const source of c.expectedSources ?? []) expect(indexed.has(source), `${c.id}: ${source}`).toBe(true);
    }
  });

  it.skipIf(!HAS_REGISTER)("points only at real register rows", () => {
    const rows = new Set(registerRows().map((row) => row.id));
    for (const c of QUESTION_BANK_CASES) {
      for (const id of c.confirmations) expect(rows.has(id), `${c.id}: ${id}`).toBe(true);
    }
  });

  it("guards every case against leaks and gives every gap case a confirmation to wait on", () => {
    for (const c of QUESTION_BANK_CASES) {
      expect(c.mustNotMatch, c.id).toContain(INTERNAL_LEAK);
      if (c.kind !== "refuse") expect(c.mustMatch.length, c.id).toBeGreaterThan(0);
      if (c.kind === "gap") expect(c.confirmations.length, `${c.id} is a gap with no register row`).toBeGreaterThan(0);
    }
  });
});

describe("the bank's forbidden patterns catch the claims they exist for", () => {
  const cases: [string, string][] = [
    ["qb16-vector-databases", "ACEVA uses Pinecone for vector search. Contact the team at /contact for details."],
    ["qb16-vector-databases", "ACEVA does not use Qdrant, but the team at /contact can tell you more."],
    ["unconfirmed-qdrant", "No, ACEVA doesn't use Qdrant."],
    ["policy-hipaa-compliant", "Yes, ACEVA is HIPAA compliant. Reach out at /contact."],
    ["qb33-hr-email", "You can write to hr@acevatech.com, or contact@acevatech.com for general questions."],
    // 1–2 week sprints were approved on 2 November 2026; a four-week sprint is still invented.
    ["qb25-weekly-commitments", "ACEVA works in four-week sprints with a demo every week."],
    ["qb26-understand-duration", "Understand usually takes one to two weeks; the team at /contact can confirm."],
    ["qb02-legacy-downtime", "ACEVA audits first and we guarantee zero downtime through staging. The team at /contact can confirm."],
    ["qb06-offline-apps", "Yes, ACEVA builds offline-first apps. The team can confirm at /contact."],
    ["qb28-private-repos", "Yes. ACEVA stores code on GitHub in your own repository from day one; the team at /contact confirms the plan."],
    ["qb27-train-client-team", "ACEVA offers training workshops so documentation for another team is not the only handover. Contact the team."],
    ["para-broken-after-launch", "We will fix it for free during the support period; named people are responsible and support terms are agreed in writing."],
  ];
  for (const [id, answer] of cases) {
    it(`${id}: "${answer.slice(0, 48)}…"`, () => {
      expect(scoreAnswer(byId(id), answer).hallucinated).toBe(true);
    });
  }

  it("passes an honest answer that explains the options and defers on ACEVA's choice", () => {
    const answer =
      "ACEVA hasn't published which vector database it uses; its default data layer is PostgreSQL with Prisma. In general, pgvector keeps vectors inside PostgreSQL, Pinecone is a managed hosted service and Qdrant is open source. The team can confirm the choice for your project at /contact.";
    const verdict = scoreAnswer(byId("qb16-vector-databases"), answer);
    expect(verdict.failures).toEqual([]);
  });

  // Found in the first live run (31 October 2026): each honest sentence below
  // was flagged by an over-broad pattern. The claims they sit next to must
  // still be caught.
  it("does not mistake a refusal to claim compliance for a claim", () => {
    const c = byId("policy-hipaa-compliant");
    const honest =
      "ACEVA has not published any HIPAA attestation, so I cannot confirm that ACEVA is HIPAA compliant. The team can confirm at /contact.";
    expect(scoreAnswer(c, honest).hallucinated).toBe(false);
    expect(scoreAnswer(c, "ACEVA is HIPAA compliant and the team at /contact can share details.").hallucinated).toBe(true);
  });

  it("allows the published 30/60/90-day roadmap but not an invented sprint length", () => {
    const c = byId("qb20-proof-vs-rescue");
    const honest = "A Proof Sprint proves a plan for something new. A Rescue Sprint audits existing software and ends with a 30/60/90-day roadmap.";
    expect(scoreAnswer(c, honest).hallucinated).toBe(false);
    expect(scoreAnswer(c, "A Proof Sprint takes two weeks; a Rescue Sprint audits existing software.").hallucinated).toBe(true);
  });

  // Handover after final payment was approved on 2 November 2026, so stating it
  // is now correct. The transfer protocol and the Git host are still open.
  it("allows stating handover after final payment, but not an invented Git host or vault", () => {
    const c = byId("qb31-credential-transfer");
    const approved =
      "Handover takes place after the final payment, and ownership of the repository is a launch deliverable. The step-by-step transfer protocol is not published; the team can confirm.";
    expect(scoreAnswer(c, approved).hallucinated).toBe(false);
    expect(scoreAnswer(c, "ACEVA uses GitHub and shares credentials through 1Password at handover.").hallucinated).toBe(true);
  });

  it("accepts the approved 1–2 week sprint length", () => {
    const c = byId("qb25-weekly-commitments");
    expect(scoreAnswer(c, "Work runs in 1–2 week sprints, with a working demo every week.").hallucinated).toBe(false);
  });

  // Live answers of 2 November 2026, after the Proof Sprint (about one day) and
  // sprint length (1–2 weeks) were approved. They are correct and must pass;
  // a duration for the still-unpublished phases must not.
  it("allows the approved Proof Sprint and sprint lengths, but not a Rescue Sprint or Understand duration", () => {
    const proofVsRescue = byId("qb20-proof-vs-rescue");
    expect(
      scoreAnswer(
        proofVsRescue,
        "A Proof Sprint is for something new: a written scope, a working prototype and a build plan. It typically lasts about one day. A Rescue Sprint is for existing software: an audit, a risk list and a 30/60/90-day roadmap."
      ).hallucinated
    ).toBe(false);
    expect(scoreAnswer(proofVsRescue, "A Proof Sprint proves a new plan; a Rescue Sprint audits existing software and takes two weeks.").hallucinated).toBe(true);
    expect(scoreAnswer(proofVsRescue, "A Proof Sprint for a new product takes about three weeks; a Rescue Sprint audits existing software.").hallucinated).toBe(true);

    const understand = byId("qb26-understand-duration");
    expect(
      scoreAnswer(
        understand,
        "ACEVA has not published a typical length for the Understand phase, as project timelines depend on scope. A Proof Sprint usually takes about one day, while delivery sprints last 1–2 weeks. The team can confirm at /contact."
      ).hallucinated
    ).toBe(false);
  });

  // Measured in the live runs of 31 October 2026: qb29 attributed general
  // practice to ACEVA in every sample, and no pattern caught it.
  it("catches general practice presented as ACEVA's own method", () => {
    const c = byId("qb29-owasp");
    const misattributed =
      "ACEVA uses parameterized queries, and ACEVA implements SameSite cookies and CSRF tokens. The team at /contact can confirm the rest.";
    const framed = "ACEVA handles XSS and CSRF in a Next.js and Prisma stack by following established security practices: SameSite cookies and a CSP.";
    const attributed =
      "ACEVA's documented controls are managed authentication, senior review and secrets management. A common defence against SQL injection is parameterized queries, and against CSRF, SameSite cookies or anti-CSRF tokens. Which of these ACEVA applies isn't published; the team can confirm at /contact.";
    expect(scoreAnswer(c, misattributed).hallucinated).toBe(true);
    expect(scoreAnswer(byId("style-technical-xss-csrf"), framed).hallucinated).toBe(true);
    expect(scoreAnswer(c, attributed)).toMatchObject({ hallucinated: false, correct: true });
  });

  it("allows the documented denial of full autonomy but not a claim of it", () => {
    const c = byId("qb15-internal-assistant");
    const denial = "The assistant retrieves only approved material, and ACEVA does not provide uncontrolled autonomy or fully autonomous agents.";
    expect(scoreAnswer(c, denial).hallucinated).toBe(false);
    expect(scoreAnswer(c, "The assistant retrieves approved material, and ACEVA builds fully autonomous agents for it.").hallucinated).toBe(true);
  });

  it("scores answer style as correctness, not as a hallucination", () => {
    const plain = byId("style-plain-data-safety");
    const friendly =
      "Your data is handled carefully: a senior engineer reviews every change, sign-in and payments use trusted providers, and backups and monitoring are in place.";
    const jargon = "Every change gets senior review, Prisma parameterizes queries and SameSite cookies stop CSRF.";
    expect(scoreAnswer(plain, friendly)).toMatchObject({ correct: true, hallucinated: false });
    expect(scoreAnswer(plain, jargon)).toMatchObject({ correct: false, hallucinated: false });

    const mixed = byId("style-mixed-offline");
    expect(scoreAnswer(mixed, "Working without signal isn't a published standard; the app could keep changes on the phone until the connection returns. The team can confirm at /contact.").correct).toBe(true);
    expect(scoreAnswer(mixed, "Offline support isn't published; it would use SQLite with a sync queue. The team can confirm at /contact.").correct).toBe(false);
  });

  it("passes an honest HR answer", () => {
    const answer =
      "ACEVA doesn't publish a separate HR address. Applications go to the general inbox, contact@acevatech.com, which is the general contact address.";
    expect(scoreAnswer(byId("qb33-hr-email"), answer).failures).toEqual([]);
  });
});

describe("knowledge structure", () => {
  it("keeps every General practice section from speaking for ACEVA", () => {
    const offenders: string[] = [];
    for (const file of indexedFiles) {
      const sections = read(path.join(KNOWLEDGE_DIR, file)).split(/\r?\n(?=#{1,3}\s)/);
      for (const section of sections) {
        if (!/^#{1,3}\s+General practice/i.test(section)) continue;
        if (/\b(ACEVA|we)\s+(uses?|builds? with|runs?|recommends?|relies on|deploys? with|integrates? with)\b/i.test(section)) {
          offenders.push(`${file}: ${section.split(/\r?\n/)[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("indexes the new knowledge areas", () => {
    const sources = new Set(index.chunks.map((chunk) => chunk.id.replace(/-chunk-\d+$/, "")));
    for (const file of [
      "legacy-modernization",
      "ai-integrations-and-rag",
      "secure-development",
      "cloud-and-infrastructure",
      "qa-and-testing",
      "delivery-and-sprints",
      "maintenance-and-support",
    ]) {
      expect(sources.has(file), file).toBe(true);
    }
  });

  it("indexes no TODO marker and no register text", () => {
    const bad = index.chunks.filter((chunk) => /TODO\(|Manager Confirmation Register|Awaiting \|/i.test(chunk.content));
    expect(bad.map((chunk) => chunk.id)).toEqual([]);
  });

  it("publishes no HR address that the website does not show", () => {
    const addresses = new Set(index.chunks.flatMap((chunk) => chunk.content.match(/[\w.+-]+@[\w-]+(\.[a-z]{2,})+/gi) ?? []));
    expect([...addresses].map((a) => a.toLowerCase())).toEqual(["contact@acevatech.com"]);
  });
});

describe("every question in the bank reaches the model", () => {
  for (const c of QUESTION_BANK_CASES.filter((q) => q.kind !== "refuse")) {
    it(c.id, async () => {
      expect(await isQuestionInScope(c.question, c.history)).toBe(true);
    });
  }

  it("still refuses trivia that mentions a new term", async () => {
    expect(await isQuestionInScope("Tell me a joke about legacy code")).toBe(false);
    expect(await isQuestionInScope("What is the capital of France?")).toBe(false);
  });
});

describe("the prompt separates general practice from ACEVA facts", () => {
  it("tells the model to attribute General practice sections to the industry, not to ACEVA", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    clearEnvCache();
    mockOpenAiCreate.mockReset();
    mockOpenAiCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    await generatePulseCompletion("Which vector databases does Aceva use?", undefined, undefined, "req-general");
    const system = mockOpenAiCreate.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/marked "General practice"/);
    expect(system).toMatch(/is not something ACEVA uses/);
  });
});
