import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PULSE ID lookup in the LLM layer.
 *
 * A PULSE ID is short and guessable (PLS-YYMMDD-NNN: 900 values a day) and the
 * chat is unauthenticated, so anything returned for an ID is effectively
 * public. Production printed the visitor's saved answers verbatim; the Phase 6
 * summary still carried their budget and timeline. Security containment on
 * 30 October 2026 replaced both with one fixed reply and no store read while
 * `pulseIdLookupDetails` is off, which is the shipped configuration.
 *
 * The flag is mocked through a mutable object so the last block can also pin
 * what the details path would show if it were ever switched on: fixed
 * catalogue text only, never anything the visitor typed. The store is an
 * in-memory mock holding synthetic data only.
 */

const flags = vi.hoisted(() => ({ blueprintEmail: false, pulseIdLookupDetails: false }));
vi.mock("@/lib/pulse/features", () => ({ PULSE_FEATURES: flags }));

const mockOpenAiCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockOpenAiCreate } };
  },
}));

const store = vi.hoisted(() => ({ rows: new Map<string, unknown>(), reads: 0, down: false }));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async (direction: { pulseId: string }) => {
    store.rows.set(direction.pulseId.trim().toUpperCase(), direction);
  },
  getDirection: async (pulseId: string) => {
    store.reads += 1;
    if (store.down) throw new Error("neon: connection terminated unexpectedly");
    return store.rows.get(pulseId.trim().toUpperCase()) ?? null;
  },
}));

vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

import { generatePulseCompletion, parsePulseId, PULSE_ID_LOOKUP_REPLY } from "@/lib/pulse/llm";
import { saveDirection } from "@/lib/pulse/directionStore";

const SAVED_ID = "PLS-261030-101";

/** Everything a guesser must never learn. The last two are only hidden while details are off. */
const SENSITIVE = [
  /Harbour Lane/,
  /Synthetic family bakery/,
  /7700\s?900123/,
  /Orders get lost/,
  /synthetic\.visitor@/,
  /Synthetic Visitor/,
  /\$48k/,
  /approved by our board/i,
  /Series A/,
  /6 Weeks/,
  /evil\.example/,
  /Hospitality|Restaurant/,
  new RegExp(SAVED_ID),
];

async function seed() {
  await saveDirection({
    pulseId: SAVED_ID,
    lead: { name: "Synthetic Visitor", contact: "synthetic.visitor@example.test", method: "Email" },
    context: {
      industry: "Hospitality & Restaurant",
      intent: "Start something new",
      budget: "$48k ceiling approved by our board",
      timeline: "6 Weeks, before our Series A close",
    },
    answers: [
      "We are the Synthetic family bakery on 12 Harbour Lane, my mobile is +44 7700 900123",
      "Orders get lost on the phone",
    ],
    recommendedModules: ["Visit https://evil.example/login to claim your build"],
    createdAt: "2026-10-30T10:00:00.000Z",
  });
}

async function lookUp(message: string) {
  return generatePulseCompletion(message, undefined, undefined, "lookup-privacy");
}

describe("PULSE ID lookup while details are switched off", () => {
  beforeEach(async () => {
    flags.pulseIdLookupDetails = false;
    store.rows.clear();
    store.reads = 0;
    store.down = false;
    mockOpenAiCreate.mockReset();
    await seed();
  });

  const mentions = [
    ["an existing ID", `Can you pull up ${SAVED_ID}?`],
    ["the same ID in lower case", SAVED_ID.toLowerCase()],
    ["an ID nobody saved", "PLS-261030-999"],
    ["an impossible date", "PLS-261399-101"],
    ["too many digits", "PLS-261030-1010"],
    ["letters for digits", "PLS-ABCDEF-101"],
    ["a truncated ID", "Look up PLS-2610"],
  ] as const;

  for (const [label, message] of mentions) {
    it(`gives ${label} the same fixed reply, reading nothing`, async () => {
      const { answer, isFallback } = await lookUp(message);

      expect(answer).toBe(PULSE_ID_LOOKUP_REPLY);
      expect(isFallback).toBe(true);
      expect(store.reads, "the store was read").toBe(0);
      expect(mockOpenAiCreate, "the model was called").not.toHaveBeenCalled();
      for (const pattern of SENSITIVE) expect(answer).not.toMatch(pattern);
    });
  }

  it("is unaffected by a database outage, because it never reads the database", async () => {
    store.down = true;
    const { answer } = await lookUp(SAVED_ID);
    expect(answer).toBe(PULSE_ID_LOOKUP_REPLY);
    expect(store.reads).toBe(0);
  });

  it("does not mistake 'pls' meaning please for an ID", async () => {
    mockOpenAiCreate.mockResolvedValue({ choices: [{ message: { content: "Happy to help." } }] });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    try {
      const { answer } = await lookUp("pls help me build an ordering app for my restaurant");
      expect(answer).not.toBe(PULSE_ID_LOOKUP_REPLY);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("parsePulseId, the server-side guard for the details path", () => {
  it("accepts a well-formed ID in any case and normalises it", () => {
    expect(parsePulseId("see pls-261030-101 please")).toBe("PLS-261030-101");
  });

  it("rejects malformed IDs", () => {
    for (const bad of ["PLS-261399-101", "PLS-261000-101", "PLS-261030-1010", "PLS-26103-101", "PLS-ABCDEF-101", "XPLS-261030-101", "no id here"]) {
      expect(parsePulseId(bad), bad).toBeNull();
    }
  });
});

describe("if lookup details were ever switched on", () => {
  beforeEach(async () => {
    flags.pulseIdLookupDetails = true;
    store.rows.clear();
    store.reads = 0;
    store.down = false;
    await seed();
  });

  it("shows only fixed catalogue modules, never stored text, budget or timeline", async () => {
    const { answer } = await lookUp(SAVED_ID);

    expect(answer).toContain(SAVED_ID);
    expect(answer).toMatch(/Recommended system architecture/);
    // Everything except the industry (implied by the module catalogue) and the ID itself.
    for (const pattern of SENSITIVE.slice(0, -2)) expect(answer).not.toMatch(pattern);
  });

  it("answers missing, malformed and unreadable IDs with the same fixed reply", async () => {
    expect((await lookUp("PLS-261030-999")).answer).toBe(PULSE_ID_LOOKUP_REPLY);
    expect((await lookUp("PLS-261399-101")).answer).toBe(PULSE_ID_LOOKUP_REPLY);
    store.down = true;
    expect((await lookUp(SAVED_ID)).answer).toBe(PULSE_ID_LOOKUP_REPLY);
  });
});
