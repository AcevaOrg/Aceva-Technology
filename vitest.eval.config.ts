import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The live grounding evaluation, which `npm test` never runs.
 *
 * It is the only suite that generates text through the chat provider: each case
 * makes a real embedding call and a real chat completion so the grounding rules
 * G2 and G6 can be checked against what the model actually says. That makes it
 * the wrong thing to run on every save — it costs money and needs a key — and
 * the right thing to run after touching RAG_SYSTEM_PROMPT, the knowledge base,
 * or the retrieval pipeline.
 *
 * It needs no exclusion anywhere else: the suite lives under `tests/eval/`, and
 * `vitest.config.ts` includes only `tests/unit/**` and `tests/api/**`, so the
 * default run cannot reach it.
 *
 * Run with `npm run test:eval`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/eval/**/*.test.ts"],
    restoreMocks: true,
  },
});
