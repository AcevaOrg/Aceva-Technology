import { describe, expect, it, vi } from "vitest";

/**
 * Misspelt ACEVA terms stay in scope (3 November 2026).
 *
 * "proof sprnt cost?" was refused as out of scope: no exact domain term, no
 * second-person address, and a cosine score under the typo floor. Embeddings
 * are mocked to null so only the keyword path decides here; a refusal below
 * therefore means the message would have fallen through to the vector check.
 */
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

import { hasMisspeltDomainTerm, isGibberishInput, isInvalidOrUnclearInput, isQuestionInScope } from "@/lib/pulse/scope";

describe("misspelt ACEVA terms", () => {
  for (const question of ["proof sprnt cost?", "how long is a proff sprint", "rescue sprnt price", "whats acevaa", "custom softwre for my shop", "pricng?", "what tech stak do you use"]) {
    it(`keeps "${question}" in scope`, async () => {
      expect(hasMisspeltDomainTerm(question.toLowerCase()), "the typo matcher itself").toBe(true);
      expect(await isQuestionInScope(question)).toBe(true);
    });
  }

  // Generic words near a tolerant term must not count as one. Tested on the
  // matcher itself: with embeddings mocked, isQuestionInScope falls back to
  // keyword scoring, which accepts these for reasons unrelated to typos.
  for (const question of ["sprint race results", "what is the price of bread", "best pizza in Karachi", "a spring sprint", "proof of address", "custom of the house"]) {
    it(`does not treat "${question}" as a misspelt ACEVA term`, () => {
      expect(hasMisspeltDomainTerm(question.toLowerCase())).toBe(false);
    });
  }

  it("does not class a misspelt ACEVA term as gibberish, but still catches keyboard mashing", () => {
    // "sprnt" has five consonants in a row, which the gibberish token rule rejects.
    expect(isGibberishInput("proof sprnt cost?")).toBe(false);
    expect(isInvalidOrUnclearInput("proof sprnt cost?")).toBe(false);
    expect(isGibberishInput("asdfgh qwerty")).toBe(true);
    expect(isGibberishInput("xkcdptrs")).toBe(true);
  });

  it("keeps location questions addressed to ACEVA in scope", async () => {
    for (const question of ["what city are you in", "Which country are you based in?", "which town are u in"]) {
      expect(await isQuestionInScope(question), question).toBe(true);
    }
    // A city question about somewhere else is still not about ACEVA.
    expect(await isQuestionInScope("What is the capital city of France?")).toBe(false);
  });

  it("still refuses explicit off-topic requests that contain a tolerant word", async () => {
    expect(await isQuestionInScope("What is the capital of France?")).toBe(false);
  });
});
