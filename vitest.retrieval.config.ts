import { defineConfig } from "vitest/config";
import path from "node:path";
import { RETRIEVAL_SUITE } from "./vitest.config";

/**
 * The live retrieval suite, which `npm test` deliberately skips.
 *
 * It is the only suite that talks to a real external service: it embeds each
 * question through the OpenAI API so the vector half of the hybrid score is
 * actually exercised. That makes it the wrong thing to run on every save — it
 * costs money and needs a key — and the right thing to run after touching the
 * knowledge base, the chunker, the embedding model, or the scorer.
 *
 * Run with `npm run test:retrieval`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: [RETRIEVAL_SUITE],
    restoreMocks: true,
  },
});
