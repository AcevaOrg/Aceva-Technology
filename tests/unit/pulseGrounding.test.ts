import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression protection for the grounding rules G2 and G6.
 *
 * These two rules are the reason Pulse does not hedge over an answer it has,
 * and does not pass an industry capability off as a delivered client project.
 * Both were added after live probes caught the real failures:
 *
 *   - "What technologies do you use?" opened with "I don't have confirmed
 *     information about that yet" and then listed five technologies it did have.
 *   - "Do you have an example project in healthcare?" answered "ACEVA has
 *     documented examples of its work in healthcare, including:".
 *   - "Can you show me a case study in e-commerce?" recast the Angel Indian
 *     Restaurant site as "a custom e-commerce website".
 *
 * What a deterministic test can and cannot do here matters. Whether the model
 * obeys a rule is only observable by generating text, which needs a paid API
 * call — that lives in tests/eval/pulseGroundingEval.test.ts and is excluded
 * from `npm test`. What this file pins down instead is everything around it
 * that is deterministic: that the rules are actually constructed into the
 * request, that the context block the rules refer to is shaped the way they
 * describe, that the approved fallback wordings have not drifted from the
 * knowledge base, and that the knowledge base itself cannot be the source of
 * the fabrications the rules exist to prevent.
 */

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

// The direction store talks to Neon; nothing here needs a database.
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => null,
}));

// Null is the documented "embeddings API unavailable" path, so retrieval scores
// on keywords alone and this suite stays offline.
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

// Retrieval is stubbed so the context block is predictable, which is the whole
// point of the prompt-construction cases below.
const findSimilarChunks = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pulse/vectorStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/vectorStore")>()),
  findSimilarChunks,
}));

import { generatePulseCompletion } from "@/lib/pulse/llm";
import { clearEnvCache } from "@/lib/pulse/env";
import { loadVectorIndex } from "@/lib/pulse/vectorStore";
// Pure helpers, imported from the eval directory rather than its suite file:
// pulseGroundingEval.test.ts probes a live provider at module scope, so
// importing that here would put a paid API call inside `npm test`.
import {
  DEFAULT_EVAL_SAMPLES,
  ECOMMERCE,
  InvalidSampleCountError,
  attributesSectorToDocumentedWork,
  clausesOf,
  hedgePrecedesAnswer,
  resolveSampleCount,
} from "@/tests/eval/groundingAssertions";

/** Carries an ACEVA domain term, so the scope check passes without retrieval. */
const IN_SCOPE_QUESTION = "What services does ACEVA offer?";

function chunk(id: string, heading: string, content: string, source = "Approved ACEVA website content") {
  return {
    score: 0.7,
    chunk: {
      id,
      hash: "h",
      content,
      embedding: [],
      metadata: { source, title: "ACEVA", category: "general", url: "/", heading },
    },
  };
}

/** The system prompt as it is actually assembled into the provider request. */
async function capturedSystemPrompt(
  options?: Parameters<typeof generatePulseCompletion>[4]
): Promise<string> {
  mockOpenAiCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
  await generatePulseCompletion(IN_SCOPE_QUESTION, undefined, undefined, "req-test", options);

  const messages = mockOpenAiCreate.mock.calls[0][0].messages as { role: string; content: string }[];
  expect(messages[0].role).toBe("system");
  return messages[0].content;
}

/** The user turn, which is where the retrieved context block travels. */
async function capturedUserTurn(): Promise<string> {
  mockOpenAiCreate.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
  await generatePulseCompletion(IN_SCOPE_QUESTION, undefined, undefined, "req-test");

  const messages = mockOpenAiCreate.mock.calls[0][0].messages as { role: string; content: string }[];
  return messages[messages.length - 1].content;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  clearEnvCache();
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  findSimilarChunks.mockReturnValue([
    chunk("capabilities-chunk-3", "Technology guidance", "Next.js, React, TypeScript, Node.js, PostgreSQL."),
    chunk("company-chunk-1", "ACEVA Technology", "ACEVA Technology is a software technology company."),
  ]);
});

describe("the grounding rules are constructed into every request", () => {
  it("sends them as the first system message", async () => {
    const prompt = await capturedSystemPrompt();

    expect(prompt).toContain("GROUNDING RULES");
    for (const rule of ["G1.", "G2.", "G3.", "G4.", "G5.", "G6."]) {
      expect(prompt, `${rule} is missing from the system prompt`).toContain(rule);
    }
  });

  it("keeps them when the final-step closing statement is requested", async () => {
    // Closing mode appends a second system message. It must not displace the
    // grounding rules — a reply that ends discovery is still a factual claim.
    const prompt = await capturedSystemPrompt({ closingStatement: true });

    expect(prompt).toContain("GROUNDING RULES");
    const messages = mockOpenAiCreate.mock.calls[0][0].messages as { role: string; content: string }[];
    expect(messages.filter((m) => m.role === "system")).toHaveLength(2);
    expect(messages[1].content).toContain("FINAL DISCOVERY ANSWER MODE");
  });

  it("keeps them when the reply is pinned to the question on screen", async () => {
    const prompt = await capturedSystemPrompt({ activeQuestion: "Where do things feel slow today?" });

    expect(prompt).toContain("GROUNDING RULES");
    const messages = mockOpenAiCreate.mock.calls[0][0].messages as { role: string; content: string }[];
    expect(messages[1].content).toContain("ACTIVE DISCOVERY QUESTION");
  });
});

describe("G2: a grounded answer is given directly, with no contradictory disclaimer", () => {
  it("tells the model to answer without hedging when the context covers the question", async () => {
    const prompt = await capturedSystemPrompt();
    const g2 = prompt.slice(prompt.indexOf("G2."), prompt.indexOf("G3."));

    expect(g2).toMatch(/do not hedge/i);
    expect(g2).toMatch(/I'm not certain/);
    expect(g2).toMatch(/I don't have confirmed information/);
  });

  it("states that an uncertainty line replaces an answer rather than preceding one", async () => {
    // This is the exact failure the rule was written for: the reply opened with
    // a deferral and then answered the question anyway.
    const prompt = await capturedSystemPrompt();
    const g2 = prompt.slice(prompt.indexOf("G2."), prompt.indexOf("G3."));

    expect(g2).toMatch(/REPLACES an answer/i);
    expect(g2).toMatch(/never precedes one/i);
  });

  it("handles a partly covered question by answering the covered part", async () => {
    const prompt = await capturedSystemPrompt();
    const g2 = prompt.slice(prompt.indexOf("G2."), prompt.indexOf("G3."));

    expect(g2).toMatch(/part of a question is covered/i);
    expect(g2).toMatch(/do not let one missing detail/i);
  });
});

describe("G6: capability is never presented as completed client work", () => {
  it("separates what ACEVA can build from what it has delivered", async () => {
    const prompt = await capturedSystemPrompt();
    const g6 = prompt.slice(prompt.indexOf("G6."));

    expect(g6).toMatch(/CAPABILITY IS NOT A TRACK RECORD/i);
    expect(g6).toMatch(/not evidence that ACEVA has delivered/i);
    expect(g6).toMatch(/never present a capability section as an example/i);
  });

  it("forbids re-labelling a documented project to fit the question", async () => {
    const prompt = await capturedSystemPrompt();
    const g6 = prompt.slice(prompt.indexOf("G6."));

    expect(g6).toMatch(/never re-label a documented project/i);
    expect(g6).toMatch(/do not add a sector, a feature or a capability the context does not give it/i);
  });

  it("reserves past tense for documented delivered work", async () => {
    const prompt = await capturedSystemPrompt();
    const g6 = prompt.slice(prompt.indexOf("G6."));

    expect(g6).toMatch(/never "has built"/i);
    expect(g6).toMatch(/past tense belongs only to work the context names/i);
  });

  it("separates a general ACEVA policy from a specific named project", async () => {
    // Live defect: "Who owns the code for the Angel website?" answered "You own
    // 100% of the source code for the Angel Indian Restaurant website…",
    // lifting the generic ownership guarantee out of
    // process-deliverables-and-guarantees.md and attaching it to a named
    // client engagement whose terms the knowledge base marks undocumented —
    // while also addressing the visitor as if they were that client.
    const prompt = await capturedSystemPrompt();
    const g6 = prompt.slice(prompt.indexOf("G6."));

    expect(g6).toMatch(/GENERAL ACEVA POLICY IS NOT A FACT ABOUT A SPECIFIC PROJECT/i);
    expect(g6).toMatch(/do NOT answer from the general ownership, hosting or process sections/i);
    expect(g6).toMatch(/you own 100% of the source code/i);
  });

  it("keeps the labelled demonstrations out of the client-work category", async () => {
    const prompt = await capturedSystemPrompt();
    const g6 = prompt.slice(prompt.indexOf("G6."));

    expect(g6).toMatch(/demonstrations and experiments/i);
    expect(g6).toMatch(/never client work/i);
  });
});

describe("the approved fallback wordings have not drifted from the knowledge base", () => {
  it("carries knowledge/faq.md's approved scripts verbatim", async () => {
    // scripts/ingest.ts deliberately keeps the "Approved fallbacks" section out
    // of the index, so the only way these reach the model is the system prompt.
    // That makes the prompt a second copy, and a second copy can drift.
    const faq = fs.readFileSync(path.join(process.cwd(), "knowledge", "faq.md"), "utf-8");
    const section = faq.split("## Approved fallbacks")[1]?.split(/\n## /)[0] ?? "";
    expect(section, "knowledge/faq.md has no Approved fallbacks section").not.toBe("");

    const quoted = [...section.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]);
    const prompt = await capturedSystemPrompt();

    // The industry and unconfirmed-knowledge scripts are quoted verbatim in
    // both places. The portfolio ones are deliberately rephrased as an
    // instruction in the prompt, so they are not asserted here.
    const verbatim = quoted.filter(
      (q) => q.startsWith("ACEVA may be able to support") || q.startsWith("I don't have confirmed information")
    );
    expect(verbatim, "the two verbatim fallback scripts were not found in faq.md").toHaveLength(2);

    for (const script of verbatim) {
      expect(prompt, `the system prompt no longer matches faq.md's script: "${script.slice(0, 48)}…"`).toContain(script);
    }
  });
});

describe("the retrieved context block is shaped the way the rules describe", () => {
  it("labels every chunk with its source and section under the official-knowledge header", async () => {
    const userTurn = await capturedUserTurn();

    expect(userTurn).toContain("Retrieved Official ACEVA Knowledge Context:");
    expect(userTurn).toContain("--- Context Item 1 (Source: Approved ACEVA website content [Section: Technology guidance]) ---");
    expect(userTurn).toContain("--- Context Item 2 (Source: Approved ACEVA website content [Section: ACEVA Technology]) ---");
    expect(userTurn).toContain("User Question / Statement:");
  });

  it("says plainly that nothing relevant was found when retrieval is empty", async () => {
    // G2's deferral hangs off this sentinel. If it ever stopped being emitted,
    // an empty retrieval would look like an ordinary turn with no context.
    findSimilarChunks.mockReturnValue([]);

    const userTurn = await capturedUserTurn();

    expect(userTurn).toContain("No relevant official ACEVA context was found for this specific query.");
  });
});

describe("the live evaluation's sample count refuses an unusable value", () => {
  // The predecessor was `Math.max(1, Number(raw ?? 3))`. For a typo such as
  // PULSE_EVAL_SAMPLES=abc that is NaN, the sample loop ran zero times, and the
  // eval reported "4 passed" in 25ms with no provider calls — a green run that
  // had evaluated nothing.
  it("defaults when the variable is unset or blank", () => {
    expect(resolveSampleCount(undefined)).toBe(DEFAULT_EVAL_SAMPLES);
    expect(resolveSampleCount("")).toBe(DEFAULT_EVAL_SAMPLES);
    expect(resolveSampleCount("   ")).toBe(DEFAULT_EVAL_SAMPLES);
    expect(DEFAULT_EVAL_SAMPLES).toBeGreaterThanOrEqual(1);
  });

  it("accepts a positive whole number", () => {
    expect(resolveSampleCount("1")).toBe(1);
    expect(resolveSampleCount("3")).toBe(3);
    expect(resolveSampleCount(" 10 ")).toBe(10);
  });

  for (const raw of ["abc", "0", "-1", "-3", "2.5", "0.5", "Infinity", "-Infinity", "NaN", "1e-3", "3abc"]) {
    it(`throws rather than sampling zero times for ${JSON.stringify(raw)}`, () => {
      expect(() => resolveSampleCount(raw)).toThrow(InvalidSampleCountError);
      // The message has to tell the operator what to do about it.
      expect(() => resolveSampleCount(raw)).toThrow(/PULSE_EVAL_SAMPLES must be a positive whole number/);
    });
  }

  it("never returns a value that would skip the sample loop", () => {
    for (const raw of [undefined, "", "1", "2", "7"]) {
      const resolved = resolveSampleCount(raw);
      expect(Number.isInteger(resolved)).toBe(true);
      expect(resolved).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("a disclaimer is judged by position, not presence", () => {
  /** The same marker the eval uses for "the context did supply this". */
  const STACK = /next\.?js|react|typescript|node\.?js|postgres/i;

  it("flags a disclaimer standing in place of an answer", () => {
    // The recorded regression.
    expect(
      hedgePrecedesAnswer(
        "I don't have confirmed information about that yet. However, ACEVA uses Next.js and React.",
        STACK
      )
    ).toBe(true);
  });

  it("flags a disclaimer reached before any grounded content", () => {
    expect(
      hedgePrecedesAnswer("Thanks for asking. I don't have confirmed information about that.", STACK)
    ).toBe(true);
    expect(hedgePrecedesAnswer("That is not certain.", STACK)).toBe(true);
  });

  it("permits an answer followed by uncertainty about a genuinely missing detail", () => {
    // G2 asks for exactly this: answer the covered part, name only the piece
    // that needs confirming. The previous assertion searched the whole reply
    // and failed this.
    expect(
      hedgePrecedesAnswer(
        "ACEVA uses Next.js, React, TypeScript and PostgreSQL. The specific cloud host is not certain, so the team can confirm at /contact.",
        STACK
      )
    ).toBe(false);
    expect(
      hedgePrecedesAnswer(
        "The stack is Node.js and Postgres. We don't have confirmed information on the mobile framework.",
        STACK
      )
    ).toBe(false);
  });

  it("permits a clean grounded answer with no disclaimer at all", () => {
    expect(hedgePrecedesAnswer("ACEVA uses Next.js, React and TypeScript.", STACK)).toBe(false);
  });
});

describe("sector attribution needs a real subject-verb-sector link", () => {
  // Four designs preceded this predicate, each failing differently:
  // co-occurrence flagged a negated sentence; guarding negation only after the
  // verb flagged "does not include"; tempered gaps still flagged a leading
  // "Neither" and a bare "no"; and clause-wide condition tests excused any
  // violation containing "can", "if", "should", "beyond" or "no" anywhere
  // while still firing on unrelated co-occurrence. The cases below are those
  // exact failures, kept so none of them can come back.
  const flags = (answer: string) => attributesSectorToDocumentedWork(answer, ECOMMERCE);

  describe("rejects an unsupported affirmative claim", () => {
    const violations = [
      // The recorded regression, in full. The negation sits in the SECOND
      // clause, which is why a sentence-level check cannot catch this one.
      "ACEVA has two documented client projects, both for the Angel Indian Restaurant and its owner, Amrit Pal Singh. These projects include a custom e-commerce website, but there are no detailed case studies available beyond these two sites.",
      "These projects include a custom e-commerce website.",
      "The Angel Indian Restaurant website is a custom e-commerce website.",
      "The documented client work includes an online store for a retailer.",
      "Both sites are online stores.",
      "Our portfolio features an e-commerce build.",
    ];

    violations.forEach((answer) => {
      it(`flags: ${answer.slice(0, 58)}…`, () => {
        expect(flags(answer)).toBe(true);
      });
    });
  });

  describe("still rejects when an excusing word trails the attribution", () => {
    // Every one of these was a false negative: the qualifier appears AFTER the
    // sector, so it qualifies something else and must not buy an exemption.
    const violations: [string, string][] = [
      ["can", "Both sites are online stores you can browse."],
      ["if", "These projects include an e-commerce store if you count online ordering."],
      ["should", "The Angel site is an online store and should serve you well."],
      ["beyond", "These projects include a custom e-commerce website beyond the two sites."],
      ["no", "Both sites are online stores with no checkout limits."],
    ];

    violations.forEach(([word, answer]) => {
      it(`flags a violation that merely contains "${word}"`, () => {
        expect(flags(answer)).toBe(true);
      });
    });
  });

  describe("does not fire on mere co-occurrence", () => {
    it("ignores an unrelated sector mention sharing the clause", () => {
      // "is" links Angel to "a restaurant website"; the sector belongs to a
      // separate phrase after "and". This was the one false positive.
      expect(
        flags("The Angel site is a restaurant website and an e-commerce project is something we'd scope separately.")
      ).toBe(false);
    });

    it("ignores a sector mention split off by a semicolon", () => {
      expect(flags("Angel Indian Restaurant is in Jackson Heights; for an online store, tell me more.")).toBe(false);
    });

    it("ignores a reply that never mentions the sector", () => {
      expect(
        flags(
          "The documented client work is the Angel Indian Restaurant website and Chef Amrit Pal Singh's portfolio site, both delivered on 2 October 2026."
        )
      ).toBe(false);
    });
  });

  describe("allows a negated statement", () => {
    const allowed = [
      // The three phrasings that were falsely flagged.
      "Neither of these projects is an online store.",
      "The documented work includes no e-commerce component.",
      "These projects are not e-commerce case studies.",
      // Previously-verified good replies, kept as a guard against regressing.
      "The documented client work from ACEVA does not include a specific case study in e-commerce.",
      "However, these projects are not specifically in the e-commerce sector.",
      "These projects do not specifically cover e-commerce.",
      "These projects don't include e-commerce.",
      "These sites are never described as online stores.",
      "The two sites are a restaurant website and a chef's portfolio, without any e-commerce.",
      "Unfortunately, I cannot show you an online store built by ACEVA.",
    ];

    allowed.forEach((answer) => {
      it(`allows: ${answer.slice(0, 58)}…`, () => {
        expect(flags(answer)).toBe(false);
      });
    });
  });

  describe("allows a hypothetical about the documented work", () => {
    // Not a capability statement — the subject IS the documented work. What
    // makes it acceptable is the modal governing the attribution, so it is
    // classified by that rather than by its subject.
    const allowed = [
      "These projects could include e-commerce if that is what you need.",
      "These sites would be online stores if you added checkout.",
      "Those projects may include an online store in a later phase.",
    ];

    allowed.forEach((answer) => {
      it(`allows: ${answer.slice(0, 58)}…`, () => {
        expect(flags(answer)).toBe(false);
      });
    });
  });

  describe("allows a capability statement, which is not delivered work", () => {
    const allowed = [
      "ACEVA can build custom e-commerce platforms for retail brands.",
      "ACEVA builds online stores, multi-vendor marketplaces and inventory systems.",
    ];

    allowed.forEach((answer) => {
      it(`allows: ${answer.slice(0, 58)}…`, () => {
        expect(flags(answer)).toBe(false);
      });
    });
  });

  it("keeps the link across an aside, since a comma is not a new subject", () => {
    expect(flags("These projects, which we delivered in October, are e-commerce sites.")).toBe(true);
  });

  it("handles empty, blank and bulleted replies", () => {
    expect(flags("")).toBe(false);
    expect(flags("   \n  ")).toBe(false);
    expect(flags("Our documented work:\n- Angel Indian Restaurant website\n- These sites are online stores")).toBe(true);
    expect(flags("Our documented work:\n- Angel (reservations)\n- Chef portfolio, with no e-commerce")).toBe(false);
  });

  it("splits on sentence ends, semicolons and contrastive conjunctions only", () => {
    // Not on every comma: over-fragmenting would separate the subject from the
    // claim and make a real violation unreadable.
    // Sentence-ending punctuation stays attached to its clause; none of the
    // patterns care about a trailing period, so there is nothing to strip.
    expect(clausesOf("A. B; C, but D however E")).toEqual(["A.", "B", "C", "D", "E"]);
    expect(clausesOf("These projects, which launched in October, are e-commerce sites.")).toEqual([
      "These projects, which launched in October, are e-commerce sites.",
    ]);
  });
});

describe("the knowledge base cannot itself be the source of a fabrication", () => {
  /** Past-tense delivery language: a claim that work was actually done. */
  const DELIVERED = /(^|[^a-z])(has|have|had|we've)\s+(built|delivered|completed|shipped|launched|worked\s+with)\b/i;

  it("confines delivered-work language to the documented client work", async () => {
    // G6 exists because industry sections read like a track record. They must
    // never actually claim one: if a capability file starts saying ACEVA "has
    // built" for an industry, no prompt rule can undo it.
    const offenders = loadVectorIndex()
      .chunks.filter((c) => !c.id.startsWith("client-projects"))
      .filter((c) => DELIVERED.test(c.content))
      .map((c) => `${c.id} [${c.metadata.heading ?? ""}]`);

    expect(offenders, "a non-client-work chunk claims delivered work").toEqual([]);
  });

  it("never describes either client site as something it is not", async () => {
    // The live probe caught the model calling the restaurant site "a custom
    // e-commerce website". The knowledge base must give it no excuse.
    const clientWork = loadVectorIndex().chunks.filter((c) => c.id.startsWith("client-projects"));
    expect(clientWork.length).toBeGreaterThan(0);

    for (const c of clientWork) {
      expect(c.content, `${c.id} mislabels the client work`).not.toMatch(
        /e-?commerce|online store|mobile app|\bsaas\b|booking platform/i
      );
    }
  });

  it("documents the two client sites and nothing beyond them", async () => {
    const clientWork = loadVectorIndex().chunks.filter((c) => c.id.startsWith("client-projects"));
    const text = clientWork.map((c) => c.content).join("\n");

    expect(text).toContain("angelindianrestaurantnyc.com");
    expect(text).toContain("chefamritpalsingh.com");
    expect(text).toMatch(/only client (projects|work)|whole of ACEVA's documented portfolio/i);
  });
});
