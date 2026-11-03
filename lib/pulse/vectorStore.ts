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
  // "Just give me a ballpark quote" retrieved nothing from the pricing files:
  // only "pricing" was a key, so a visitor who said quote, cost, price, rate
  // or budget never reached the chunks that say no figure is published.
  quote: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  cost: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  costs: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  price: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  prices: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  rate: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  rates: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  budget: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  charge: ["pricing", "price", "cost", "quote", "rate", "fee", "budget"],
  // "Why should I pick you over Toptal?" is a question about how ACEVA
  // competes, which website-content.md answers under "What ACEVA Competes On".
  compare: ["competes", "compete", "positioning"],
  comparison: ["competes", "compete", "positioning"],
  versus: ["competes", "compete", "positioning"],
  competitor: ["competes", "compete", "positioning"],
  competitors: ["competes", "compete", "positioning"],
  alternative: ["competes", "compete", "positioning"],
  alternatives: ["competes", "compete", "positioning"],
  freelancer: ["competes", "compete", "positioning"],
  freelancers: ["competes", "compete", "positioning"],
  agency: ["competes", "compete", "positioning"],
  agencies: ["competes", "compete", "positioning"],
  choose: ["competes", "compete", "positioning"],
  choosing: ["competes", "compete", "positioning"],
  toptal: ["competes", "compete", "positioning"],
  fiverr: ["competes", "compete", "positioning"],
  upwork: ["competes", "compete", "positioning"],
  // "Where do you host the apps you build?" ranked how-aceva-helps first on the
  // words "apps" and "build", the stack guide's "Cloud Hosting & DevOps
  // Infrastructure" section never reached the model, and Pulse said it had no
  // confirmed information about a documented fact (P3 evaluation, 30 October
  // 2026). That section's heading is "Vercel & AWS / Railway", and expansion
  // stops at the first synonym found anywhere, so the heading words lead.
  host: ["vercel", "aws", "railway", "hosting", "deployment", "cloud"],
  hosts: ["vercel", "aws", "railway", "hosting", "deployment", "cloud"],
  hosted: ["vercel", "aws", "railway", "hosting", "deployment", "cloud"],
  hosting: ["vercel", "aws", "railway", "hosting", "deployment", "cloud"],
  deploy: ["deployment", "hosting", "vercel", "aws", "railway", "cloud"],
  deployed: ["deployment", "hosting", "vercel", "aws", "railway", "cloud"],
  deployment: ["deployment", "hosting", "vercel", "aws", "railway", "cloud"],
  // No "hosting" here: "Which servers do you use?" is about the stack, and the
  // hosting-fee and third-party-cost headings would otherwise tie with it.
  server: ["vercel", "aws", "railway", "deployment", "cloud"],
  servers: ["vercel", "aws", "railway", "deployment", "cloud"],
  // The approved refund position (2 November 2026) sits under the heading
  // "Refunds and cancellation" in pricing-approach.md. "payment" used to lead
  // here, for a heading that no longer exists, and since expansion stops at
  // the first synonym found anywhere, "can I get my money back if I cancel"
  // reached the general pricing chunks instead of the refund answer.
  refund: ["refund", "cancellation", "payment", "pricing"],
  refunds: ["refund", "cancellation", "payment", "pricing"],
  cancel: ["refund", "cancellation", "payment", "pricing"],
  cancellation: ["cancellation", "refund", "payment", "pricing"],
  // Visitor words for the approved payment terms (heading "Payment schedule and
  // advance payment"); none of them is used in the knowledge text itself.
  upfront: ["advance", "payment", "schedule"],
  deposit: ["advance", "payment", "schedule"],
  advance: ["advance", "payment", "schedule"],
  installment: ["payment", "schedule", "advance"],
  installments: ["payment", "schedule", "advance"],
  instalment: ["payment", "schedule", "advance"],
  instalments: ["payment", "schedule", "advance"],
  // ".NET" tokenises to "net", which the heading "Laravel and .NET
  // applications" already matches. "net" itself is deliberately not a key: it
  // would pull that heading into "are your invoices net 30?".
  dotnet: ["net", "dotnet", "technology", "technologies"],
  // "Which programming languages do you use?" names no technology, so it missed
  // the stack overview that lists TypeScript (3 November 2026). The word itself
  // is left out: it matches the "large language models" heading first.
  language: ["typescript", "technologies"],
  // A country or region in a question means where ACEVA works, not an
  // industry: "can you work with someone in Canada?" retrieved no location
  // context and drew the industry deferral (3 November 2026). Limited to the
  // markets company.md names.
  canada: ["international clients", "countries", "worldwide"],
  america: ["international clients", "countries", "worldwide"],
  american: ["international clients", "countries", "worldwide"],
  usa: ["international clients", "countries", "worldwide"],
  europe: ["international clients", "countries", "worldwide"],
  european: ["international clients", "countries", "worldwide"],
  britain: ["international clients", "countries", "worldwide"],
  england: ["international clients", "countries", "worldwide"],
  australia: ["international clients", "countries", "worldwide"],
  dubai: ["international clients", "countries", "worldwide"],
  uae: ["international clients", "countries", "worldwide"],
  saudi: ["international clients", "countries", "worldwide"],
  germany: ["international clients", "countries", "worldwide"],
  // "Are you an official Microsoft partner?" (CSV row 50).
  partner: ["partnerships", "partner"],
  partners: ["partnerships", "partners"],
  languages: ["typescript", "technologies"],
  programming: ["typescript", "technologies"],
  // Location questions ("Where is ACEVA based?") meet the company heading
  // "Office, headquarters and where ACEVA is based".
  based: ["based", "office", "headquarters"],
  located: ["based", "office", "headquarters", "location"],
  headquarters: ["headquarters", "office", "based"],
  hq: ["headquarters", "office", "based"],
  // "Who is the chief executive?" names neither "CEO" nor "leadership".
  executive: ["leadership", "ceo", "executive"],
  chief: ["leadership", "ceo", "chief"],
  // "Do I get the IP rights?" — "IP" is too short to score, so "rights" carries
  // the question to the ownership sections.
  rights: ["ownership", "intellectual property", "own"],
  // Provider names a visitor uses for "can you integrate my preferred AI?";
  // the answer sits under "Integrating your preferred AI service or model".
  claude: ["ai service", "ai model", "model"],
  openai: ["ai service", "ai model", "model"],
  gemini: ["ai service", "ai model", "model"],
  anthropic: ["ai service", "ai model", "model"],
  chatgpt: ["ai service", "ai model", "model"],
  // Browser names a visitor uses; the answer sits under "Browser and device support".
  chrome: ["browser", "browsers", "device"],
  safari: ["browser", "browsers", "device"],
  firefox: ["browser", "browsers", "device"],
  rescue: ["rescue", "recovery", "unstable", "audit", "legacy", "fix", "broken", "stuck"],
  career: ["career", "careers", "job", "jobs", "hiring", "openings", "team"],
  restaurant: ["restaurant", "food", "kitchen", "cafe", "menu", "ordering", "dining", "reservation"],
  // "Which database would you recommend for a booking system?" retrieved five
  // industry chunks and never the PostgreSQL section: "booking" and "system"
  // matched the industry catalogue everywhere, while "database" only ever met
  // body text. The stack guide names the products rather than the word, so the
  // visitor's word has to reach those headings.
  //
  // Order matters: expansion stops at the first synonym that matches any
  // field, and the heading check outranks body text. The product names come
  // first so "database" meets the heading "PostgreSQL & Prisma ORM" rather
  // than stopping at the word "database" in some other chunk's body.
  database: ["postgresql", "postgres", "prisma", "database", "databases", "data"],
  databases: ["postgresql", "postgres", "prisma", "database", "databases", "data"],
  // "What would you recommend?" is a question about ACEVA's defaults, which is
  // the word the stack guide uses ("relational data by default", "Expo by
  // default"), so the visitor's verb has to meet the corpus's noun.
  recommend: ["default", "defaults", "recommend", "recommended"],
  recommended: ["default", "defaults", "recommend", "recommended"],
  suggest: ["default", "defaults", "suggest", "recommend"],
  // A platform the website never names is still a stack question. "Do you
  // work with WordPress?" ranked the three client-work chunks first, purely
  // because "work" met the heading "ACEVA Client Work", and the stack guide —
  // which says those platforms are undocumented — never reached the model.
  // "technology" leads so the stack guide's category and title both count.
  wordpress: ["technology", "technologies", "stack", "framework", "wordpress"],
  shopify: ["technology", "technologies", "stack", "framework", "shopify"],
  wix: ["technology", "technologies", "stack", "framework", "wix"],
  webflow: ["technology", "technologies", "stack", "framework", "webflow"],
  laravel: ["technology", "technologies", "stack", "framework", "laravel"],
  django: ["technology", "technologies", "stack", "framework", "django"],
  rails: ["technology", "technologies", "stack", "framework", "rails"],
  php: ["technology", "technologies", "stack", "framework", "php"],
  squarespace: ["technology", "technologies", "stack", "framework", "squarespace"],
  redis: ["technology", "technologies", "stack", "framework", "redis"],
  lambda: ["technology", "technologies", "stack", "framework", "lambda"],
  docker: ["technology", "technologies", "stack", "framework", "docker"],
  kubernetes: ["technology", "technologies", "stack", "framework", "kubernetes"],
  firebase: ["technology", "technologies", "stack", "framework", "firebase"],
  mongodb: ["technology", "technologies", "stack", "framework", "mongodb"],
  // Knowledge expansion (31 October 2026). Each key is a visitor's word that
  // the answering section does not use itself; words that already appear in a
  // heading ("hotfix", "offline", "severity", "OWASP") need no entry. The
  // section's own heading word leads, for the same first-match reason as above.
  old: ["legacy", "old", "outdated"],
  outdated: ["legacy", "outdated", "old"],
  upgrade: ["legacy", "migration", "upgrade", "modernization"],
  upgrades: ["legacy", "migration", "upgrade", "modernization"],
  upgrading: ["legacy", "migration", "upgrade", "modernization"],
  assessment: ["audit", "assessment", "rescue"],
  semantic: ["retrieval", "rag", "vector", "knowledge assistant"],
  embedding: ["vector", "retrieval", "rag", "embedding"],
  embeddings: ["vector", "retrieval", "rag", "embedding"],
  warranty: ["warranty", "maintenance", "support", "post-launch"],
  emergency: ["hotfix", "emergency"],
  handover: ["handing over", "handover", "repositories", "ownership"],
  handoff: ["handing over", "handover", "repositories", "ownership"],
  credentials: ["credentials", "handing over"],
  repo: ["repository", "repositories"],
  repos: ["repository", "repositories"],
  vulnerability: ["vulnerabilities", "security", "owasp"],
  vulnerabilities: ["vulnerabilities", "security", "owasp"],
  vulnerable: ["vulnerable", "vulnerabilities", "security"],
  insecure: ["security", "vulnerabilities", "insecure"],
  compliance: ["gdpr", "hipaa", "privacy regulations", "compliance"],
  compliant: ["gdpr", "hipaa", "privacy regulations", "compliance"],
  scale: ["scaling", "scale"],
  feasible: ["feasibility", "feasible"],
  train: ["maintain", "team", "train"],
  training: ["maintain", "team", "training"],
  onboard: ["maintain", "team", "onboard"],
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
 *
 * The score is uncapped. Callers cap it at 1.0 for the hybrid score and keep
 * the uncapped value to break ties among capped scores.
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

  return matches / (rawTerms.length * 2.0);
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
  const tieBreak = new Map<VectorDocumentChunk, number>();

  for (const chunk of index.chunks) {
    if (!chunk.embedding || !chunk.embedding.length) continue;
    const rawTermScore = queryText ? calculateTermRelevance(queryText, chunk) : 0;
    const termScore = Math.min(1.0, rawTermScore);

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
      tieBreak.set(chunk, rawTermScore);
    }
  }

  // Capped keyword scores tie often, and a tie used to fall back to file order.
  // The uncapped keyword strength decides between equals instead.
  results.sort((a, b) => b.score - a.score || (tieBreak.get(b.chunk) ?? 0) - (tieBreak.get(a.chunk) ?? 0));
  return results.slice(0, topK);
}
