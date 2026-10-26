import fs from "fs";
import path from "path";
import { VectorDatabaseIndex, VectorDocumentChunk } from "@/components/pulse/types";
import { cosineSimilarity, getExpectedEmbeddingDimension } from "./embeddings";
import { getEmbeddingModel } from "./env";

const INDEX_FILE_PATH = path.join(process.cwd(), "knowledge", "vectorIndex.json");

const REBUILD_HINT = "Rebuild it with `npm run build:index`.";

/**
 * Thrown when the index on disk cannot be used with the configured model.
 * Distinct from a generic Error so callers and tests can target it.
 */
export class VectorIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VectorIndexError";
  }
}

/**
 * The parsed index, held for the process lifetime.
 *
 * At 1536 dimensions the file is several megabytes, and this used to be read and
 * JSON-parsed on every single retrieval call — once per chat turn, twice when the
 * scope check also ran. Caching keeps that cost to the first request.
 */
let cachedIndex: VectorDatabaseIndex | null = null;

/** Drops the cached index. For tests, and for a rebuild within one process. */
export function clearVectorIndexCache(): void {
  cachedIndex = null;
}

/**
 * Rejects an index that cannot produce meaningful scores against the configured
 * model.
 *
 * This is the guard that was missing: a mismatch between the index width and the
 * query width makes `cosineSimilarity` return 0 for every chunk, so retrieval
 * silently collapses to keyword matching with no error anywhere. Failing loudly
 * at load is the only way that surfaces.
 */
function assertIndexIsUsable(index: VectorDatabaseIndex): void {
  const configuredModel = getEmbeddingModel();

  if (index.embeddingModel !== configuredModel) {
    throw new VectorIndexError(
      `Vector index was built with embedding model "${index.embeddingModel}" but EMBEDDING_MODEL is "${configuredModel}". ${REBUILD_HINT}`,
    );
  }

  const expected = getExpectedEmbeddingDimension(configuredModel);
  if (expected !== undefined && index.dimension !== expected) {
    throw new VectorIndexError(
      `Vector index declares dimension ${index.dimension} but "${configuredModel}" produces ${expected}. ${REBUILD_HINT}`,
    );
  }

  for (const chunk of index.chunks) {
    const width = chunk.embedding?.length ?? 0;
    if (width !== index.dimension) {
      throw new VectorIndexError(
        `Chunk "${chunk.id}" has a ${width}-dimension embedding but the index declares ${index.dimension}. ${REBUILD_HINT}`,
      );
    }
  }
}

export function loadVectorIndex(): VectorDatabaseIndex {
  if (cachedIndex) return cachedIndex;

  if (!fs.existsSync(INDEX_FILE_PATH)) {
    console.warn(`[vectorStore] No vector index at ${INDEX_FILE_PATH}. ${REBUILD_HINT}`);
    return {
      version: "1.0.0",
      embeddingModel: getEmbeddingModel(),
      dimension: getExpectedEmbeddingDimension() ?? 0,
      updatedAt: new Date().toISOString(),
      chunks: [],
    };
  }

  let parsed: VectorDatabaseIndex;
  try {
    parsed = JSON.parse(fs.readFileSync(INDEX_FILE_PATH, "utf-8")) as VectorDatabaseIndex;
  } catch (error) {
    throw new VectorIndexError(
      `Vector index at ${INDEX_FILE_PATH} is not valid JSON (${
        error instanceof Error ? error.message : "unknown error"
      }). ${REBUILD_HINT}`,
    );
  }

  if (!Array.isArray(parsed.chunks)) {
    throw new VectorIndexError(`Vector index at ${INDEX_FILE_PATH} has no chunks array. ${REBUILD_HINT}`);
  }

  assertIndexIsUsable(parsed);
  cachedIndex = parsed;
  return parsed;
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

/** Word split shared by query, chunk and synonym tokenisation. */
const TOKEN_SPLIT = /[^a-z0-9]+/;

/** How much the capabilities overview chunk amplifies relevance already found. */
const OVERVIEW_CHUNK_BOOST = 1.5;

/**
 * Synonym expansion is for domain vocabulary only.
 *
 * "provide", "provides" and "do" used to sit in the service lists. Expansion
 * stops at the first synonym that matches a field, so those three were only
 * ever reached by a chunk that contained no service word at all — and then
 * matched its body text, because almost every chunk in the corpus contains
 * "do" or "provides" somewhere. The effect was a flat +1.5 handed to the least
 * relevant chunks on any query mentioning services, which is the opposite of
 * what a synonym is for. `TERM_STOPWORDS` already excludes "do"/"does" on the
 * query side for the same reason.
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  service: ["service", "services", "capability", "capabilities", "offering", "offerings", "solution", "solutions"],
  services: ["service", "services", "capability", "capabilities", "offering", "offerings", "solution", "solutions"],
  capability: ["capability", "capabilities", "service", "services", "offering", "offerings"],
  capabilities: ["capability", "capabilities", "service", "services", "offering", "offerings"],
  product: ["product", "products", "software", "app", "application", "platform", "system", "website"],
  website: ["website", "web app", "web application", "digital experience", "portal", "site", "online store", "ordering"],
  app: ["app", "mobile app", "application", "mobile product", "software", "platform", "system"],
  build: ["build", "create", "design", "develop", "launch", "make", "engineer"],
  tech: ["tech", "technology", "technologies", "stack", "framework", "architecture", "next.js", "react", "node", "typescript", "postgres"],
  technology: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  technologies: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  // "framework"/"frameworks" were reachable only as synonym *values*, never as
  // keys, so a query that used the visitor's word instead of ours expanded to
  // nothing. "Which frameworks do you build with?" retrieved no stack chunk at
  // all — "build" matched the headings "Build" in process.md and "What ACEVA
  // Can Build" in how-aceva-helps.md and crowded the stack out entirely, so
  // Pulse answered that it had no confirmed information while the same
  // question as "what's your tech stack?" answered in full.
  framework: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  frameworks: ["tech", "technology", "technologies", "stack", "framework", "architecture"],
  pricing: ["pricing", "price", "cost", "engagement", "rate", "fee", "budget", "quote", "sprint"],
  rescue: ["rescue", "recovery", "unstable", "audit", "legacy", "fix", "broken", "stuck"],
  career: ["career", "careers", "job", "jobs", "hiring", "openings", "team"],
  restaurant: ["restaurant", "food", "kitchen", "cafe", "menu", "ordering", "dining", "reservation"],
};

/**
 * Query words that carry no retrieval signal.
 *
 * Term matches are weighted by where they land — 3.5 for a heading, 3.0 for a
 * document title, 1.5 for body text — so a function word that happens to sit in
 * a title is scored as a strong topical hit. "How ACEVA Can Help You" gave every
 * one of its 24 chunks +6.0 for the words "can" and "you", and "How ACEVA Works"
 * gave its 7 chunks +3.0 for "how". That was enough to put
 * how-aceva-helps-chunk-10 (Logistics and Transportation) first for "Can you
 * guarantee a delivery date before we start?" ahead of process-chunk-7, the
 * chunk that says almost that sentence and had the best cosine score of the
 * whole result set.
 *
 * Only closed-class function words belong here. Words that look generic but
 * carry domain meaning in this corpus — "get", "start", "date", "own", "need",
 * "help", "work", "time", "team", "cost", "price", "build", "long" — are
 * deliberately absent.
 */
const TERM_STOPWORDS = new Set([
  "and", "any", "are", "been", "being", "but", "can", "could", "did", "does",
  "doing", "done", "for", "from", "had", "has", "have", "her", "hers", "him",
  "his", "how", "into", "its", "just", "many", "may", "might", "more", "most",
  "much", "must", "nor", "not", "our", "ours", "out", "over", "shall", "she",
  "should", "some", "such", "than", "that", "the", "their", "theirs", "them",
  "then", "there", "these", "they", "this", "those", "too", "very", "was",
  "were", "what", "when", "where", "which", "while", "who", "whom", "whose",
  "why", "will", "with", "would", "you", "your", "yours",
]);

/**
 * Candidate stems for one token.
 *
 * Matching compares variant sets instead of reducing each token to a single
 * canonical form, because one-rule stemmers disagree on pairs this corpus
 * actually contains ("services"/"service", "processes"/"process"). Overlapping
 * variant sets keep the comparison symmetric: "farms" meets "farm", "ordering"
 * meets "order", "policies" meets "policy".
 */
const stemVariantCache = new Map<string, string[]>();

function stemVariants(token: string): string[] {
  const cached = stemVariantCache.get(token);
  if (cached) return cached;

  const out = new Set<string>([token]);
  const n = token.length;
  if (token.endsWith("ies") && n > 4) out.add(token.slice(0, -3) + "y");
  if (token.endsWith("es") && n > 3) {
    out.add(token.slice(0, -1));
    out.add(token.slice(0, -2));
  }
  if (token.endsWith("s") && !token.endsWith("ss") && n > 3) out.add(token.slice(0, -1));
  if (token.endsWith("ing") && n > 5) {
    out.add(token.slice(0, -3));
    out.add(token.slice(0, -3) + "e");
  }
  if (token.endsWith("ed") && n > 4) {
    out.add(token.slice(0, -2));
    out.add(token.slice(0, -1));
  }
  // Nominalisations and adverbs the corpus uses where the visitor uses the
  // base word: "hourly" for "hour", "delivery" for "deliver". Stripping leaves
  // junk for some words ("company" -> "compan"), which is harmless because a
  // junk stem only matches another token that reduces to the same junk.
  if (token.endsWith("ly") && n > 4) out.add(token.slice(0, -2));
  if (token.endsWith("y") && n > 4) out.add(token.slice(0, -1));

  const list = [...out];
  stemVariantCache.set(token, list);
  return list;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(TOKEN_SPLIT).filter(Boolean);
}

interface FieldTokens {
  tokens: string[];
  /** Every stem variant of every token, for O(1) single-token lookup. */
  variants: Set<string>;
}

function fieldTokens(text: string): FieldTokens {
  const tokens = tokenize(text);
  const variants = new Set<string>();
  for (const t of tokens) for (const v of stemVariants(t)) variants.add(v);
  return { tokens, variants };
}

/**
 * Word-boundary term match.
 *
 * Replaces `haystack.includes(needle)`, which matched straight across word
 * boundaries: the query word "car" hit the heading "Careers at ACEVA" and
 * collected its 3.5 heading weight, so "Do you sell insurance policies for
 * classic cars?" — a question the corpus does not answer — scored 0.3807, above
 * the suite's 0.35 floor. Multi-word synonyms ("web app", "online store") still
 * have to match as an adjacent run, so a bare token set is not enough on its own.
 */
function fieldMatches(field: FieldTokens, needleTokens: string[]): boolean {
  if (!needleTokens.length) return false;

  if (needleTokens.length === 1) {
    return stemVariants(needleTokens[0]).some((v) => field.variants.has(v));
  }

  const { tokens } = field;
  for (let i = 0; i + needleTokens.length <= tokens.length; i += 1) {
    let all = true;
    for (let j = 0; j < needleTokens.length; j += 1) {
      const haystackVariants = stemVariants(tokens[i + j]);
      const needleVariants = stemVariants(needleTokens[j]);
      if (!haystackVariants.some((v) => needleVariants.includes(v))) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

/** Chunk text never changes in-process, so tokenise each chunk once. */
type ChunkFields = Record<"content" | "title" | "heading" | "category" | "url", FieldTokens>;
const chunkFieldCache = new WeakMap<VectorDocumentChunk, ChunkFields>();

function chunkFields(chunk: VectorDocumentChunk): ChunkFields {
  let fields = chunkFieldCache.get(chunk);
  if (!fields) {
    fields = {
      content: fieldTokens(chunk.content),
      title: fieldTokens(chunk.metadata.title),
      heading: fieldTokens(chunk.metadata.heading || ""),
      category: fieldTokens(chunk.metadata.category || ""),
      url: fieldTokens(chunk.metadata.url || ""),
    };
    chunkFieldCache.set(chunk, fields);
  }
  return fields;
}

/** Synonym phrases are tokenised once, not per chunk. */
const needleCache = new Map<string, string[]>();

function needleTokens(phrase: string): string[] {
  let tokens = needleCache.get(phrase);
  if (!tokens) {
    tokens = tokenize(phrase);
    needleCache.set(phrase, tokens);
  }
  return tokens;
}

/**
 * Calculates a synonym-aware keyphrase BM25-style term relevance score between
 * query text and chunk content/metadata.
 *
 * Term matching is word-boundary (see `fieldMatches`), so a query token only
 * scores against whole words in the chunk, with simple plural/-ing/-ed stem
 * variants treated as the same word.
 */
function calculateTermRelevance(queryText: string, chunk: VectorDocumentChunk): number {
  const rawTerms = tokenize(queryText).filter((t) => t.length > 2 && !TERM_STOPWORDS.has(t));
  if (!rawTerms.length) return 0;

  const fields = chunkFields(chunk);
  const titleLower = chunk.metadata.title.toLowerCase();
  const headingLower = (chunk.metadata.heading || "").toLowerCase();
  const categoryLower = (chunk.metadata.category || "").toLowerCase();
  const urlLower = (chunk.metadata.url || "").toLowerCase();

  let matches = 0;

  for (const term of rawTerms) {
    // Stemming now covers the plural case the default list used to spell out.
    const synonyms = DOMAIN_SYNONYMS[term] || [term];

    for (const syn of synonyms) {
      const needle = needleTokens(syn);

      if (fieldMatches(fields.url, needle) || fieldMatches(fields.category, needle)) {
        matches += 3.0;
      }
      if (fieldMatches(fields.heading, needle)) {
        matches += 3.5;
        break;
      }
      if (fieldMatches(fields.title, needle)) {
        matches += 3.0;
        break;
      }
      if (fieldMatches(fields.content, needle)) {
        matches += 1.5;
        break;
      }
    }
  }

  // Primary Overview Chunk Boost for main topic queries.
  //
  // Multiplicative, not a flat `+= 4.5`. The overview chunk is a better
  // presentation of relevance the query already found, so it amplifies that
  // relevance and cannot manufacture it. A constant could: with only three
  // content words the budget is 6, so "Can you fix my washing machine?" earned
  // 1.5 for the word "machine" (from "machine learning") + 4.5 = 6.0/6 and
  // saturated the keyword score at 1.0, taking rank 1 at 0.5756 for a question
  // the corpus does not answer. Scaling the 1.5 to 2.25 instead leaves it at
  // 0.26, while a genuine capabilities query still saturates on its own merits.
  const isOverviewChunk = chunk.id.endsWith("-chunk-1") || headingLower === titleLower;
  if (isOverviewChunk && (urlLower === "/services" || categoryLower === "capabilities" || titleLower.includes("capabilities"))) {
    matches *= OVERVIEW_CHUNK_BOOST;
  }

  return Math.min(1.0, matches / (rawTerms.length * 2.0));
}

/**
 * Finds top-K similar chunks using hybrid search (cosine similarity + synonym
 * keyphrase boost).
 *
 * A `null` `queryEmbedding` means the embeddings API was unreachable, so the
 * vector half of the score is unavailable. Rather than scoring every chunk at 0,
 * retrieval degrades to keyword-only and says so in the log — the degradation is
 * then visible instead of looking like a healthy search returning poor hits.
 */
export function findSimilarChunks(
  queryEmbedding: number[] | null,
  topK = 5,
  minScore = 0.02,
  queryText = ""
): SimilaritySearchResult[] {
  const index = loadVectorIndex();
  if (!index.chunks.length) return [];

  const keywordOnly = queryEmbedding === null;
  if (keywordOnly) {
    console.warn("[vectorStore] No query embedding available — ranking on keyword relevance only.");
  }

  const results: SimilaritySearchResult[] = [];

  for (const chunk of index.chunks) {
    if (!chunk.embedding || !chunk.embedding.length) continue;
    const termScore = queryText ? calculateTermRelevance(queryText, chunk) : 0;

    let finalScore: number;
    if (keywordOnly) {
      finalScore = termScore;
    } else if (queryText) {
      // Hybrid Score: 50% Vector Cosine Similarity + 50% Keyphrase & Synonym Match
      finalScore = 0.5 * cosineSimilarity(queryEmbedding, chunk.embedding) + 0.5 * termScore;
    } else {
      finalScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    }

    if (finalScore >= minScore) {
      results.push({ chunk, score: finalScore });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
