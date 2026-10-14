import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The live retrieval suite is excluded from `npm test`.
 *
 * It is the only suite that calls a real external service — roughly 15 OpenAI
 * embedding requests per run — so including it would make the default test
 * command cost money, require a key, and depend on the network. Run it on its
 * own with `npm run test:retrieval` (see vitest.retrieval.config.ts), which is
 * what to do after changing the knowledge base, the chunker, the embedding
 * model, or the relevance scorer.
 */
export const RETRIEVAL_SUITE = "tests/unit/pulseRetrievalQuality.test.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts?(x)", "tests/api/**/*.test.ts?(x)"],
    exclude: [...configDefaults.exclude, RETRIEVAL_SUITE],
    restoreMocks: true,
  },
});
