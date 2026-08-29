import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import { LLMMessage } from "./llm";

export const GREETING_REJECTION =
  "Hello! Please enter a specific question about ACEVA's services or describe your project so I can help map out your project direction.";

export const OUT_OF_SCOPE_REJECTION =
  "Please enter a clear, relevant question about your project or ACEVA's software development services.";

// Standalone greeting patterns
const GREETING_PATTERNS = [
  /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hola)(\s+pulse)?[\s!.]*$/i,
  /^(hey|hello|hi)\s+there[\s!.]*$/i,
];

// Explicit ACEVA domain keywords & intent indicators
const ACEVA_DOMAIN_TERMS = [
  "aceva",
  "pulse",
  "proof sprint",
  "rescue sprint",
  "product rescue",
  "custom software",
  "digital experience",
  "digital experiences",
  "mobile product",
  "mobile products",
  "mobile app",
  "mobile application",
  "intelligence",
  "automation",
  "engagement",
  "pricing",
  "dedicated team",
  "fixed scope",
  "hourly",
  "contact",
  "career",
  "job",
  "hiring",
  "process",
  "understand",
  "design",
  "build",
  "launch",
  "improve",
  "tech stack",
  "technology",
  "capabilities",
  "services",
  "company",
  "industry",
  "industries",
  "guarantee",
  "ownership",
  "code review",
  "next.js",
  "react",
  "typescript",
  "node",
  "postgresql",
  "llm",
  "cloud",
  "database",
  "databases",
  "nda",
  "ndas",
  "deployment",
  "staging",
  "rollback",
  "discovery",
];

// Specific Software & Agency Project Service Intent
const SOFTWARE_SERVICE_INTENT = [
  "custom software",
  "build app",
  "build software",
  "build website",
  "web application",
  "mobile app",
  "system audit",
  "code audit",
  "legacy system",
  "software project",
  "consulting",
  "rebuild app",
  "hire team",
  "engineering team",
  "project cost",
  "hourly rate",
  "delivery timeline",
  "estimate cost",
  "website",
  "app",
  "restaurant",
  "ordering",
  "menu",
  "portal",
  "dashboard",
  "features",
  "delivery",
  "booking",
  "checkout",
  "algorithm",
  "camera",
];

// Out-of-scope trigger patterns (Trivia, general programming, math, recipes, sports, astronomy, general trivia, etc.)
const OUT_OF_SCOPE_PATTERNS = [
  // General programming & coding exercises unrelated to ACEVA
  /\b(what|explain|how)\s+(is|to|does)\s+(python|java|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|regex)\b/i,
  /\bwrite\s+(a|an)?\s*(python|java|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|script|program|code|function|class|loop)/i,
  /\bhow\s+to\s+(write|code|implement|sort|reverse|solve|zip)\s+(in|a)\s*(python|java|javascript|c\+\+|leetcode|bash)/i,
  /\b(write|create)\s+a\s+snake\s+game/i,
  /\b(solve|debug|fix)\s+this\s+(code|error|leetcode|syntax)/i,

  // General Knowledge Trivia, Geography, History, People, Science
  /\b(capital|president|prime minister|governor|king|queen|emperor|ceo|founder)\s+of\b/i,
  /\bwho\s+(won|is|was|played|scored|painted|wrote|invented|created|founded)\s+(the|a)?\s*(cricket|football|match|world cup|super bowl|oscar|election|game|mona lisa|romeo|telephone|apple)?\b/i,
  /\b(weather|temperature|forecast|rain|snow)\s+(today|tomorrow|in|this)\b/i,
  /\b(tell|give)\s+me\s+a\s+(joke|riddle|story|poem|song|recipe|quote|movie|film|bedtime story)\b/i,
  /\b(recipe|ingredients|cook|bake|kitchen|tea|coffee|cake|pizza)\s+(for|how|to)?\b/i,
  /\b(planet|planets|solar system|galaxy|universe|space|star|stars|astronomy|physics|biology|chemistry|moon|everest|ocean|trench|photosynthesis|airplane|airplanes)\b/i,

  // General Questions & Trivia
  /\bwhat\s+is\s+the\s+(distance|height|speed|population|currency|boiling point|chemical formula|capital|rule|offside)\b/i,
  /\bhow\s+(many|much|far|deep|tall|high)\s+(continents|planets|ocean|mountains|distance|people)\b/i,
  /\bhow\s+do\s+i\s+(train|clean|make|cook|bake|fix a flat|fly)\b/i,

  // Homework & Math
  /\b(solve|calculate|compute)\s+(this|the)?\s*(math|equation|integral|derivative|algebra|calculus|problem)\b/i,
  /\bwhat\s+is\s+\d+\s*[\+\-\*\/\s\w]*\d+/i,
  /\bpythagorean\s+theorem\b/i,
];

/**
 * Check if the input is a standalone greeting.
 */
export function isGreetingInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;
  return GREETING_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Check if the input is raw, unclear, or gibberish.
 */
export function isInvalidOrUnclearInput(
  userMessage: string,
  history?: LLMMessage[],
  projectContext?: Record<string, unknown>
): boolean {
  const clean = userMessage.trim();
  if (!clean) return true;

  // Pulse ID reference code (e.g. PLS-260829-123)
  if (/PLS-\d{6}-\d{3}/i.test(clean)) return false;

  // Very short non-alphanumeric noise (e.g. "?", "a", "1", "..")
  if (clean.length < 2) return true;
  if (!/[a-zA-Z0-9]/.test(clean)) return true;

  // Check repeating characters / keyboard smashes (e.g. "aaaaaaa", "asdfghjkl", "qwertyuiop")
  if (/^(.)\1{4,}$/i.test(clean)) return true;
  if (/^(asdfghjkl|qwertyuiop|zxcvbnm){1,}/i.test(clean.toLowerCase()) && clean.length > 5) return true;

  // Out of scope pattern match
  const isOOS = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(clean));
  if (isOOS) return true;

  return false;
}

/**
 * Robust server-side check to determine if a user question is relevant to ACEVA Technology.
 */
export async function isQuestionInScope(
  userMessage: string,
  history?: LLMMessage[],
  projectContext?: Record<string, unknown>
): Promise<boolean> {
  const clean = userMessage.trim();
  if (!clean) return false;

  const lower = clean.toLowerCase();

  // 0. Pulse ID reference pattern check (e.g. PLS-260826-883)
  if (/PLS-\d{6}-\d{3}/i.test(clean) || lower.includes("pls-")) {
    return true;
  }

  // 1. Explicit Out-of-Scope Pattern Match -> High confidence IRRELEVANT
  const matchesOOS = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(clean));
  if (matchesOOS) {
    return false;
  }

  // 2. Direct ACEVA keyword match -> High confidence RELEVANT
  const hasAcevaTerm = ACEVA_DOMAIN_TERMS.some((term) => lower.includes(term));
  if (hasAcevaTerm) {
    return true;
  }

  // 3. Software/Agency Service Intent match
  const hasServiceIntent = SOFTWARE_SERVICE_INTENT.some((term) => lower.includes(term));
  if (hasServiceIntent) {
    return true;
  }

  // 4. Active Multi-Turn Conversation or Project Context
  const isOngoingConversation = Boolean(
    (history && history.length > 0) ||
    (projectContext && Object.keys(projectContext).length > 0)
  );
  if (isOngoingConversation) {
    return true;
  }

  // 5. Vector Knowledge Similarity Check
  const queryEmb = await generateEmbedding(clean);
  const searchResults = findSimilarChunks(queryEmb, 1, 0.0, clean);
  const topScore = searchResults[0]?.score || 0;

  if (topScore >= 0.20) {
    return true;
  }

  return false;
}
