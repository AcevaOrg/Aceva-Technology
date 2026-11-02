import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Response quality, pinned deterministically.
 *
 * The live behaviour lives in tests/eval; this file holds what can be checked
 * without a model: the style rules are in the prompt the model receives, the
 * scope gates let a question about ACEVA itself through to the knowledge base,
 * and the canned replies read like an assistant rather than form validation.
 */

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => null,
}));

import { generatePulseCompletion } from "@/lib/pulse/llm";
import { clearEnvCache } from "@/lib/pulse/env";
import {
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
  getCasualOrFAQResponse,
  getGibberishOrNonsenseResponse,
  isInvalidOrUnclearInput,
  isProjectDiscoveryInput,
  isQuestionInScope,
} from "@/lib/pulse/scope";

type Message = { role: string; content: string };

async function capturedSystemPrompt(options?: Parameters<typeof generatePulseCompletion>[4]): Promise<string> {
  mockOpenAiCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
  await generatePulseCompletion("What services does ACEVA offer?", undefined, undefined, "style-test", options);
  const messages = mockOpenAiCreate.mock.calls.at(-1)![0].messages as Message[];
  return messages[0].content;
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("the response style rules reach the model", () => {
  beforeEach(() => {
    mockOpenAiCreate.mockReset();
    vi.unstubAllEnvs();
    clearEnvCache();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  });

  it("asks for the answer first, no filler openers and no emojis", async () => {
    const prompt = await capturedSystemPrompt();
    expect(prompt).toContain("RESPONSE STYLE");
    expect(prompt).toMatch(/LEAD WITH THE ANSWER/);
    expect(prompt).toMatch(/"Great question"/);
    expect(prompt).toMatch(/No emojis/);
  });

  it("treats a documented limit as an answer rather than a gap", async () => {
    const prompt = await capturedSystemPrompt();
    expect(prompt).toMatch(/A DOCUMENTED LIMIT IS AN ANSWER, NOT A GAP/);
    expect(prompt).toMatch(/does not guarantee a delivery date/);
    expect(prompt).toMatch(/nearest documented fact/);
  });

  it("matches the visitor's technical level without loosening grounding", async () => {
    const prompt = await capturedSystemPrompt();
    expect(prompt).toMatch(/MATCH THE VISITOR'S TECHNICAL LEVEL AND WORDING/);
    expect(prompt).toMatch(/NON-TECHNICAL QUESTIONS \(THE DEFAULT\)/);
    expect(prompt).toMatch(/TECHNICAL QUESTIONS: .*do not water the answer down/);
    expect(prompt).toMatch(/MIXED QUESTIONS: .*practical answer first in plain words/);
    expect(prompt).toMatch(/changes how you explain, never what you claim/);
    // Style sits below the grounding rules, which say they override everything after them.
    expect(prompt.indexOf("GROUNDING RULES (HIGHEST PRIORITY")).toBeLessThan(prompt.indexOf("MATCH THE VISITOR'S TECHNICAL LEVEL"));
  });

  it("keeps multi-part questions, follow-ups and the single next step", async () => {
    const prompt = await capturedSystemPrompt();
    expect(prompt).toMatch(/Answer every part, in the order asked/);
    expect(prompt).toMatch(/Resolve "that", "it"/);
    expect(prompt).toMatch(/at most one follow-up question/);
  });

  it("keeps the grounding rules ahead of the style rules", async () => {
    // Style must never outrank accuracy: G1–G6 come first and the style block
    // defers to G3 for every sensitive commitment.
    const prompt = await capturedSystemPrompt();
    expect(prompt.indexOf("GROUNDING RULES")).toBeLessThan(prompt.indexOf("RESPONSE STYLE"));
    expect(prompt).toMatch(/follow rules G3 and 12 exactly/);
    expect(prompt.indexOf("G6.")).toBeLessThan(prompt.indexOf("16. FALSE PREMISES"));
  });

  it("tells a discovery turn to add something rather than restate the answer", async () => {
    await capturedSystemPrompt({ activeQuestion: "Tell us about your business or project." });
    const messages = mockOpenAiCreate.mock.calls.at(-1)![0].messages as Message[];
    expect(messages[1].content).toMatch(/Do not restate what they said/);
    expect(messages[1].content).toMatch(/"That's great"/);
  });

  it("tells the closing statement not to promise an outcome", async () => {
    await capturedSystemPrompt({ closingStatement: true });
    const messages = mockOpenAiCreate.mock.calls.at(-1)![0].messages as Message[];
    expect(messages[1].content).toMatch(/Do not promise an outcome/);
  });
});

describe("questions about ACEVA itself reach the knowledge base", () => {
  // Both used to be refused: "CEO of" matched the trivia pattern for
  // "<title> of <place>", and "where are you located?" as a first message fell
  // through to the vector check, which scored company.md under the floor.
  const aboutAceva = [
    "Who is the CEO of ACEVA?",
    "Who founded Aceva?",
    "Where are you located?",
    "Where is ACEVA based?",
    "How big is the ACEVA team?",
  ];

  for (const question of aboutAceva) {
    it(`"${question}" is in scope and not junk`, async () => {
      expect(isInvalidOrUnclearInput(question)).toBe(false);
      expect(await isQuestionInScope(question)).toBe(true);
      // Still not a discovery answer: the progress bar must not move.
      expect(isProjectDiscoveryInput(question)).toBe(false);
    });
  }

  it("still refuses the same shapes about anything else", async () => {
    for (const question of ["Who is the CEO of Apple?", "What is the capital of France?", "Who is the president of Pakistan?"]) {
      expect(isInvalidOrUnclearInput(question)).toBe(true);
      expect(await isQuestionInScope(question)).toBe(false);
    }
  });
});

describe("canned replies read like an assistant, not a form", () => {
  it("the gibberish reply invites a sentence instead of demanding a 'clear project description'", () => {
    const reply = getGibberishOrNonsenseResponse();
    expect(reply).toMatch(/^I didn't quite catch that\./);
    expect(reply).not.toMatch(/please enter/i);
    expect(reply).toMatch(/ask me anything about ACEVA/i);
  });

  it("the trivia deflection says what it can help with", () => {
    const reply = getCasualOrFAQResponse("What is the capital of France?");
    expect(reply).toMatch(/anything about ACEVA or your own project/i);
    expect(reply).not.toMatch(/interesting question/i);
  });

  it("no canned reply uses an emoji or an exclamation-heavy tone", () => {
    const replies = [
      GREETING_REJECTION,
      OUT_OF_SCOPE_REJECTION,
      getGibberishOrNonsenseResponse(),
      getCasualOrFAQResponse("What is the capital of France?") ?? "",
      getCasualOrFAQResponse("who are you") ?? "",
    ];
    for (const reply of replies) {
      expect(reply).not.toMatch(EMOJI);
      expect((reply.match(/!/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});
