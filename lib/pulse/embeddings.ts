import { getEmbeddingModel, getOpenAIApiKey } from "./env";

/** The model used when EMBEDDING_MODEL is unset. */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Output width per supported model. Used to sanity-check a built index against
 * the model it claims to have been built with; an unlisted model is allowed, it
 * just skips that particular check.
 */
export const EMBEDDING_DIMENSIONS: Readonly<Record<string, number>> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

/** The expected width for a model, or undefined if the model is not listed. */
export function getExpectedEmbeddingDimension(model: string = getEmbeddingModel()): number | undefined {
  return EMBEDDING_DIMENSIONS[model];
}

/**
 * Calculates cosine similarity between two numerical vector embeddings.
 *
 * Returns 0 for mismatched widths. That guard is correct but silent, which is
 * how a 1536-dimension query vector scoring against a 384-dimension index went
 * unnoticed: every chunk scored 0 and retrieval quietly degraded to keyword
 * matching. `loadVectorIndex` now rejects such an index outright.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embeds `text` with the configured embedding model.
 *
 * Returns `null`, never a substitute vector, when the API cannot be reached.
 * The previous implementation fell back to a locally hashed pseudo-embedding of
 * a different width than the index, so callers could not tell a real vector
 * from a useless one. A `null` here means "score on keywords alone".
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cleanText = text.trim();
  if (!cleanText) return null;

  const model = getEmbeddingModel();
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    console.warn(
      "[embeddings] OPENAI_API_KEY is not set — retrieval falls back to keyword-only scoring.",
    );
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: cleanText }),
    });

    if (!response.ok) {
      console.warn(
        `[embeddings] ${model} returned HTTP ${response.status} — retrieval falls back to keyword-only scoring.`,
      );
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.warn(
        `[embeddings] ${model} returned no vector — retrieval falls back to keyword-only scoring.`,
      );
      return null;
    }

    return embedding as number[];
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(
      `[embeddings] ${model} request failed (${reason}) — retrieval falls back to keyword-only scoring.`,
    );
    return null;
  }
}
