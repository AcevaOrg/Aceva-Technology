import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateEmbedding,
  getExpectedEmbeddingDimension,
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} from "@/lib/pulse/embeddings";
import {
  loadVectorIndex,
  findSimilarChunks,
  clearVectorIndexCache,
  VectorIndexError,
} from "@/lib/pulse/vectorStore";
import { clearEnvCache, getEmbeddingModel } from "@/lib/pulse/env";

/** A plausible API response for the configured model's width. */
function embeddingResponse(dimension: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: [{ embedding: Array.from({ length: dimension }, (_, i) => (i % 7) / 7) }] }),
  };
}

describe("Pulse vector index", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    clearEnvCache();
    clearVectorIndexCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearEnvCache();
    clearVectorIndexCache();
  });

  describe("index and query dimensions agree", () => {
    // The bug this guards: the index held 384-dimension hashed vectors while
    // queries used text-embedding-3-small at 1536, so cosineSimilarity hit its
    // length guard and returned 0 for every chunk. Retrieval still "worked" —
    // it had just silently become keyword-only.
    it("declares the model it was built with, and that model's width", () => {
      const index = loadVectorIndex();

      expect(index.embeddingModel).toBe(getEmbeddingModel());
      expect(index.dimension).toBe(getExpectedEmbeddingDimension(index.embeddingModel));
      expect(index.chunks.length).toBeGreaterThan(0);
    });

    it("stores every chunk at exactly the declared width", () => {
      const index = loadVectorIndex();
      const widths = new Set(index.chunks.map((chunk) => chunk.embedding.length));

      expect([...widths]).toEqual([index.dimension]);
    });

    it("produces a query vector the same width as the index", async () => {
      const index = loadVectorIndex();
      const expected = getExpectedEmbeddingDimension(index.embeddingModel);
      expect(expected).toBeDefined();

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(embeddingResponse(expected as number) as unknown as Response);
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      clearEnvCache();

      const queryEmbedding = await generateEmbedding("What services does ACEVA offer?");

      expect(queryEmbedding).not.toBeNull();
      expect(queryEmbedding?.length).toBe(index.dimension);

      // The request must name the configured model, not a hardcoded one.
      const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(body.model).toBe(getEmbeddingModel());
    });

    it("defaults to a real OpenAI model rather than a placeholder name", () => {
      expect(getEmbeddingModel()).toBe(DEFAULT_EMBEDDING_MODEL);
      expect(EMBEDDING_DIMENSIONS[DEFAULT_EMBEDDING_MODEL]).toBe(1536);
    });

    it("honours EMBEDDING_MODEL instead of ignoring it", () => {
      vi.stubEnv("EMBEDDING_MODEL", "text-embedding-3-large");
      clearEnvCache();

      expect(getEmbeddingModel()).toBe("text-embedding-3-large");
      expect(getExpectedEmbeddingDimension()).toBe(3072);
    });

    it("sends the configured model to the API, not a hardcoded one", async () => {
      // Deliberately a non-default model: asserting against the default would
      // pass even if the model name were hardcoded back into embeddings.ts.
      vi.stubEnv("EMBEDDING_MODEL", "text-embedding-3-large");
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      clearEnvCache();

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(embeddingResponse(3072) as unknown as Response);

      const result = await generateEmbedding("What services does ACEVA offer?");

      const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(body.model).toBe("text-embedding-3-large");
      expect(body.model).not.toBe(DEFAULT_EMBEDDING_MODEL);
      expect(result?.length).toBe(3072);
    });
  });

  describe("load-time validation", () => {
    it("throws when the index was built with a different model", () => {
      vi.stubEnv("EMBEDDING_MODEL", "text-embedding-3-large");
      clearEnvCache();
      clearVectorIndexCache();

      expect(() => loadVectorIndex()).toThrow(VectorIndexError);
      expect(() => loadVectorIndex()).toThrow(/npm run build:index/);
    });

    it("names both the stored and the configured model in the failure", () => {
      vi.stubEnv("EMBEDDING_MODEL", "text-embedding-ada-002");
      clearEnvCache();
      clearVectorIndexCache();

      expect(() => loadVectorIndex()).toThrow(/text-embedding-3-small/);
      expect(() => loadVectorIndex()).toThrow(/text-embedding-ada-002/);
    });
  });

  describe("keyword-only fallback when the embeddings API is unavailable", () => {
    it("returns null and logs rather than inventing a vector", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      clearEnvCache();
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

      const result = await generateEmbedding("What services does ACEVA offer?");

      expect(result).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("keyword-only"));
    });

    it("returns null when no API key is configured", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("OPENAI_API_KEY", "");
      clearEnvCache();

      expect(await generateEmbedding("What services does ACEVA offer?")).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("OPENAI_API_KEY"));
    });

    it("still ranks chunks on keyword relevance, and logs the degradation", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const hits = findSimilarChunks(null, 5, 0.02, "What is the proof sprint?");

      // Membership, not rank: `calculateTermRelevance` clamps to 1.0, so several
      // chunks tie at the ceiling and index order breaks the tie. Ordering is
      // only meaningful on the hybrid path, where the vector half separates them.
      expect(hits.some((hit) => hit.chunk.id.includes("proof-sprint"))).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("keyword relevance only"));
    });
  });

  describe("retrieval relevance", () => {
    // Keyword-only so the assertion is deterministic and needs no network; the
    // hybrid path adds the vector half on top of exactly this ranking.
    const cases = [
      ["What is the proof sprint?", /proof.?sprint/i],
      ["Who owns the source code when the project ends?", /ownership|own 100%|source code/i],
      ["How do you handle confidentiality and data security?", /confidential|security|access/i],
    ] as const;

    for (const [query, expected] of cases) {
      it(`surfaces a topically relevant chunk for "${query}"`, () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const hits = findSimilarChunks(null, 5, 0.02, query);

        expect(hits.length).toBeGreaterThan(0);
        expect(hits.some((hit) => expected.test(hit.chunk.content))).toBe(true);
      });
    }

    it('retrieves a relevant chunk for "Do you sign NDAs?"', () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // Before knowledge/nda-and-confidentiality.md existed, nothing under
      // knowledge/ contained "NDA" or "non-disclosure" at all and this query
      // ranked "Dairy Farms and Agriculture" top.
      //
      // Asserted as membership rather than rank: keyword-only scoring ties this
      // chunk at the 1.0 ceiling with chunks matching "nda" spuriously inside
      // "recommendation" and "attendance". On the hybrid path with a real query
      // embedding it ranks first, at 0.766.
      const hits = findSimilarChunks(null, 5, 0.02, "Do you sign NDAs?");

      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((hit) => hit.chunk.id.includes("nda-and-confidentiality"))).toBe(true);
    });

    it("retrieves the client project file for portfolio and project questions", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // Before knowledge/client-projects.md existed, the corpus said ACEVA
      // claimed no real client work, so these questions had no right answer to
      // find — while two live client sites credited ACEVA in their footers.
      for (const query of [
        "Do you have a portfolio?",
        "Do you have any case studies?",
        "Angel Indian Restaurant website",
        "Chef Amrit Pal Singh portfolio",
        "Have you built any real client websites?",
      ]) {
        const hits = findSimilarChunks(null, 5, 0.02, query);

        expect(hits.length, `nothing retrieved for "${query}"`).toBeGreaterThan(0);
        expect(
          hits.some((hit) => hit.chunk.id.startsWith("client-projects")),
          `no client-projects chunk in the top 5 for "${query}"`
        ).toBe(true);
      }
    });

    it("indexes the client projects as facts, not as handling instructions", () => {
      const index = loadVectorIndex();
      const projects = index.chunks.filter((chunk) => chunk.id.startsWith("client-projects"));

      // The two project sections plus the overview. The "Internal: …", "Not yet
      // documented" and "Review notes" sections are operator guidance and
      // provenance, which SKIPPED_HEADINGS keeps out of the index — retrieval
      // must never hand Pulse's own instructions back as an answer.
      expect(projects).toHaveLength(3);
      expect(projects.map((chunk) => chunk.metadata.heading)).toEqual([
        "ACEVA Client Work",
        "Angel Indian Restaurant website",
        "Chef Amrit Pal Singh portfolio website",
      ]);

      const text = projects.map((chunk) => chunk.content).join("\n");
      expect(text).toContain("angelindianrestaurantnyc.com");
      expect(text).toContain("chefamritpalsingh.com");
      // The client's own phone and email are on their public site but have no
      // business being handed out by ACEVA's assistant.
      expect(text).not.toMatch(/347-848-0098|angelrestaurant278/);
    });

    it("indexes the confirmed engagement details but not the open ones", () => {
      const projects = loadVectorIndex().chunks.filter((chunk) =>
        chunk.id.startsWith("client-projects")
      );
      const text = projects.map((chunk) => chunk.content).join("\n");

      // Confirmed by the team on 11 October 2026 and safe to state.
      for (const detail of [/design/i, /development/i, /content/i, /SEO/, /ongoing maintenance/i]) {
        expect(text).toMatch(detail);
      }
      expect(text).toContain("2 October 2026");
      expect(text).toMatch(/permission/i);

      // Each project chunk must stand alone: a question about one site has to
      // retrieve its scope and date without depending on the overview chunk.
      for (const chunk of projects.filter((c) => /website$/.test(c.metadata.heading ?? ""))) {
        expect(chunk.content, `${chunk.id} is missing the scope`).toMatch(/SEO/);
        expect(chunk.content, `${chunk.id} is missing the delivery date`).toContain("2 October 2026");
      }

      // Hosting and ownership are still unknown. An answer there would cut
      // against the client-ownership promise, so nothing may be indexed.
      expect(text).not.toMatch(/hosted|hosting/i);

      // The team said "ACEVA Technologies" while the live site, this repo and
      // both client footers say otherwise, so nothing was renamed on that
      // answer alone — Pulse stays on the name a visitor sees on the website.
      for (const chunk of loadVectorIndex().chunks) {
        expect(chunk.content).not.toContain("ACEVA Technologies");
      }
    });

    it("no longer claims there is no verified client work", () => {
      // Two chunks used to say the opposite of what the corpus now documents,
      // and one of them was wired into the system prompt as approved wording.
      for (const chunk of loadVectorIndex().chunks) {
        expect(chunk.content).not.toMatch(/does not currently claim real client work/i);
        expect(chunk.content).not.toMatch(/verified public portfolio examples/i);
      }
    });

    it("expands 'frameworks' to the technology vocabulary", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // "framework" existed only as a synonym VALUE, never as a key, so a
      // visitor using their own word got no expansion. Live, "Which frameworks
      // do you build with?" retrieved no stack chunk at all — "build" matched
      // the headings "Build" (process.md) and "What ACEVA Can Build"
      // (how-aceva-helps.md) and crowded it out — so Pulse answered that it
      // had no confirmed information, while "what's your tech stack?" answered
      // in full from the same corpus.
      const hits = findSimilarChunks(null, 8, 0.02, "frameworks");
      const files = new Set(hits.map((hit) => hit.chunk.id.replace(/-chunk-\d+$/, "")));

      expect(hits.length).toBeGreaterThan(0);
      expect(files, "the frameworks synonym no longer reaches the stack guide").toContain(
        "tech-stack-and-architecture"
      );
    });

    it("never indexes an unconfirmed placeholder", () => {
      // Placeholders are dense with the vocabulary of the question they stand in
      // for, so an indexed one outranks the section holding the real answer and
      // instructs the model to refuse. They stay in the markdown, not the index.
      const index = loadVectorIndex();

      for (const chunk of index.chunks) {
        expect(chunk.content).not.toMatch(/TODO\(aceva\)/i);
        expect(chunk.metadata.source).not.toMatch(/TODO\(aceva\)/i);
      }
    });
  });
});
