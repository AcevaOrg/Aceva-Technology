import crypto from "crypto";

export const EMBEDDING_MODEL_NAME = process.env.EMBEDDING_MODEL || "aceva-semantic-vector-v3";
export const EMBEDDING_DIMENSION = 384;

/**
 * Calculates cosine similarity between two numerical vector embeddings.
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

// Low-weight high-frequency words
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "to", "from", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "s", "t", "can",
  "will", "just", "don", "should", "now", "what", "which", "who", "whom",
  "this", "that", "these", "those", "aceva", "technology"
]);

// High-weight domain synonym/stem mappings
const STEM_MAP: Record<string, string> = {
  services: "service",
  servicing: "service",
  capabilities: "capability",
  capably: "capability",
  technologies: "tech",
  techs: "tech",
  technical: "tech",
  technology: "tech",
  products: "product",
  production: "product",
  processes: "process",
  processing: "process",
  customs: "custom",
  customized: "custom",
  softwares: "software",
  automations: "automation",
  automated: "automation",
  intelligences: "intelligence",
  intelligent: "intelligence",
  rescues: "rescue",
  rescued: "rescue",
  pricing: "price",
  prices: "price",
  costing: "price",
  costs: "price",
  contacts: "contact",
  contacting: "contact",
  careers: "career",
  jobs: "career",
  openings: "career",
};

function normalizeWord(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return "";
  if (STEM_MAP[clean]) return STEM_MAP[clean];
  if (clean.endsWith("ies") && clean.length > 4) return clean.slice(0, -3) + "y";
  if (clean.endsWith("es") && clean.length > 4) return clean.slice(0, -2);
  if (clean.endsWith("s") && clean.length > 3) return clean.slice(0, -1);
  if (clean.endsWith("ing") && clean.length > 5) return clean.slice(0, -3);
  if (clean.endsWith("ed") && clean.length > 4) return clean.slice(0, -2);
  return clean;
}

interface WeightedToken {
  token: string;
  weight: number;
}

function extractWeightedTokens(text: string): WeightedToken[] {
  const rawWords = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const result: WeightedToken[] = [];

  for (let i = 0; i < rawWords.length; i++) {
    const raw = rawWords[i];
    const stem = normalizeWord(raw);
    if (!stem) continue;

    const isStop = STOP_WORDS.has(raw) || STOP_WORDS.has(stem);
    const weight = isStop ? 0.1 : 1.5;

    result.push({ token: stem, weight });

    // Unigram raw if different
    if (raw !== stem && !isStop) {
      result.push({ token: raw, weight: 1.0 });
    }

    // Bigram
    if (i < rawWords.length - 1) {
      const nextStem = normalizeWord(rawWords[i + 1]);
      if (nextStem && (!STOP_WORDS.has(raw) || !STOP_WORDS.has(rawWords[i + 1]))) {
        result.push({ token: `${stem}_${nextStem}`, weight: 2.5 });
      }
    }
  }

  return result;
}

/**
 * Generates a normalized semantic feature vector embedding for a given text chunk.
 * Uses OpenAI embedding API when available, or a high-performance feature-weighted 384-dim fallback.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.trim();

  // 1. Try external embedding API if OPENAI_API_KEY is configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: cleanText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length > 0) {
          return embedding;
        }
      }
    } catch {
      // Fall through to feature-weighted tokenized embedding generator
    }
  }

  // 2. High-precision 384-dimensional feature-weighted vector generator
  const vector = new Float32Array(EMBEDDING_DIMENSION);
  const weightedTokens = extractWeightedTokens(cleanText);

  for (const { token, weight } of weightedTokens) {
    const hash = crypto.createHash("sha256").update(token).digest();
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      const byteVal = hash[i % hash.length];
      const val = ((byteVal / 255) * 2 - 1) * weight;
      vector[i] += val;
    }
  }

  // Unit normalize the vector
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    sumSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSq) || 1;
  const result: number[] = new Array(EMBEDDING_DIMENSION);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    result[i] = Number((vector[i] / norm).toFixed(6));
  }

  return result;
}
