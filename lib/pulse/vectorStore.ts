import fs from "fs";
import path from "path";
import { VectorDatabaseIndex, VectorDocumentChunk } from "@/components/pulse/types";
import { cosineSimilarity, EMBEDDING_DIMENSION, EMBEDDING_MODEL_NAME } from "./embeddings";

const INDEX_FILE_PATH = path.join(process.cwd(), "knowledge", "vectorIndex.json");

export function loadVectorIndex(): VectorDatabaseIndex {
  try {
    if (fs.existsSync(INDEX_FILE_PATH)) {
      const fileContent = fs.readFileSync(INDEX_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileContent) as VectorDatabaseIndex;
      if (Array.isArray(parsed.chunks)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Error reading vector index file:", error);
  }

  return {
    version: "1.0.0",
    embeddingModel: EMBEDDING_MODEL_NAME,
    dimension: EMBEDDING_DIMENSION,
    updatedAt: new Date().toISOString(),
    chunks: [],
  };
}

export function saveVectorIndex(indexData: VectorDatabaseIndex): void {
  const dir = path.dirname(INDEX_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  indexData.updatedAt = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE_PATH, JSON.stringify(indexData, null, 2), "utf-8");
}

export interface SimilaritySearchResult {
  chunk: VectorDocumentChunk;
  score: number;
}

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  service: ["service", "services", "capability", "capabilities", "offering", "offerings", "solution", "solutions", "provide", "provides", "do"],
  services: ["service", "services", "capability", "capabilities", "offering", "offerings", "solution", "solutions", "provide", "provides", "do"],
  capability: ["capability", "capabilities", "service", "services", "offering", "offerings"],
  capabilities: ["capability", "capabilities", "service", "services", "offering", "offerings"],
  product: ["product", "products", "software", "app", "application", "platform", "system", "website"],
  website: ["website", "web app", "web application", "digital experience", "portal", "site", "online store", "ordering"],
  app: ["app", "mobile app", "application", "mobile product", "software", "platform", "system"],
  build: ["build", "create", "design", "develop", "launch", "make", "engineer"],
  tech: ["tech", "technology", "technologies", "stack", "framework", "architecture", "next.js", "react", "node", "typescript", "postgres"],
  technology: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  technologies: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  pricing: ["pricing", "price", "cost", "engagement", "rate", "fee", "budget", "quote", "sprint"],
  rescue: ["rescue", "recovery", "unstable", "audit", "legacy", "fix", "broken", "stuck"],
  career: ["career", "careers", "job", "jobs", "hiring", "openings", "team"],
  restaurant: ["restaurant", "food", "kitchen", "cafe", "menu", "ordering", "dining", "reservation"],
};

/**
 * Calculates a synonym-aware keyphrase BM25-style term relevance score between query text and chunk content/metadata.
 */
function calculateTermRelevance(queryText: string, chunk: VectorDocumentChunk): number {
  const rawTerms = queryText.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!rawTerms.length) return 0;

  const contentLower = chunk.content.toLowerCase();
  const titleLower = chunk.metadata.title.toLowerCase();
  const headingLower = (chunk.metadata.heading || "").toLowerCase();
  const categoryLower = (chunk.metadata.category || "").toLowerCase();
  const urlLower = (chunk.metadata.url || "").toLowerCase();

  let matches = 0;

  for (const term of rawTerms) {
    const synonyms = DOMAIN_SYNONYMS[term] || [term, term.endsWith("s") ? term.slice(0, -1) : term + "s"];

    for (const syn of synonyms) {
      if (urlLower.includes(syn) || categoryLower.includes(syn)) {
        matches += 3.0;
      }
      if (headingLower.includes(syn)) {
        matches += 3.5;
        break;
      }
      if (titleLower.includes(syn)) {
        matches += 3.0;
        break;
      }
      if (contentLower.includes(syn)) {
        matches += 1.5;
        break;
      }
    }
  }

  // Primary Overview Chunk Boost for main topic queries
  const isOverviewChunk = chunk.id.endsWith("-chunk-1") || headingLower === titleLower;
  if (isOverviewChunk && (urlLower === "/services" || categoryLower === "capabilities" || titleLower.includes("capabilities"))) {
    matches += 4.5;
  }

  return Math.min(1.0, matches / (rawTerms.length * 2.0));
}

/**
 * Finds top-K similar chunks using hybrid vector search (Cosine Similarity + Synonym BM25 Boost).
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  topK = 5,
  minScore = 0.02,
  queryText = ""
): SimilaritySearchResult[] {
  const index = loadVectorIndex();
  if (!index.chunks.length) return [];

  const results: SimilaritySearchResult[] = [];

  for (const chunk of index.chunks) {
    if (!chunk.embedding || !chunk.embedding.length) continue;
    const vecScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    const termScore = queryText ? calculateTermRelevance(queryText, chunk) : 0;

    // Hybrid Score: 50% Vector Cosine Similarity + 50% Keyphrase & Synonym Match
    const finalScore = queryText ? 0.5 * vecScore + 0.5 * termScore : vecScore;

    if (finalScore >= minScore) {
      results.push({ chunk, score: finalScore });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
