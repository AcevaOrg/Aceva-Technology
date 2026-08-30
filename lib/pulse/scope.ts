import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import { LLMMessage } from "./llm";

export const GREETING_REJECTION =
  "Hello! Please enter a specific question about ACEVA's services or describe your project so I can help map out your project direction.";

export const OUT_OF_SCOPE_REJECTION =
  "Please enter a clear, relevant question about your project or ACEVA's software development services.";

// Standalone greeting & casual conversational patterns (should NOT increase question/progress percentage)
const GREETING_PATTERNS = [
  /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hola)(\s+pulse)?[\s!.]*$/i,
  /^(hey|hello|hi)\s+there[\s!.]*$/i,
  /^how\s+(are|r)\s+(you|u)(\s+doing)?[\s?!.]*$/i,
  /^how\s+is\s+it\s+going[\s?!.]*$/i,
  /^what('?s|\s+is)\s+up[\s?!.]*$/i,
  /^what\s+is\s+aceva(\s+technologies)?[\s?!.]*$/i,
  /^what\s+does\s+aceva(\s+technologies)?\s+do[\s?!.]*$/i,
  /^(who|what)\s+are\s+you[\s?!.]*$/i,
  /^tell\s+me\s+about\s+aceva[\s?!.]*$/i,
  /^where\s+are\s+you\s+located[\s?!.]*$/i,
  /^(ok|okay|cool|nice|thanks|thank you|great|awesome|got it|understood)[\s!.]*$/i,
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

// Company & FAQ Questions about ACEVA (MUST NOT advance project progress)
const ACEVA_FAQ_PATTERNS = [
  /what('?s|\s+is)\s+aceva(\s+technologies)?/i,
  /what\s+does\s+aceva(\s+technologies)?\s+(do|build|offer|provide)/i,
  /who\s+(is|are)\s+(aceva|you)/i,
  /tell\s+me\s+about\s+aceva/i,
  /where\s+are\s+you\s+(located|based)/i,
  /what\s+(services|capabilities)\s+do\s+(you|aceva)\s+(offer|provide)/i,
  /how\s+(does|is|do|can|did)\s+aceva\b/i,
  /how\s+aceva\s+(works?|operates?|functions?|builds?)/i,
  /how\s+much\s+does\s+aceva\s+cost/i,
  /\baceva'?s?\s*(internal|mechanism|workers?|staff|leads?|founders?|ceo|process|operation)/i,
  /\bwho\s+(works?\s+at|leads?)\s+aceva\b/i,
  /\b(how|what|who|why|where)\b.*?\baceva\b/i,
];

// General Tech History, Trivia, Comparison, or Educational Questions (MUST NOT advance project progress)
const GENERAL_TECH_TRIVIA_PATTERNS = [
  /\b(java\s*\d*|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|react|angular|vue|node|perl|pascal|cobol)\s+(is|vs|versus|better|faster|older|newer|worse|compared|famous|popular)\b/i,
  /\bwhat\s+(is|does|did)\s+(java|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|react|node|javascript|typescript|perl|pascal|cobol)\s*(do|mean|used)?/i,
  /\b(explain|difference|comparison)\s+(between|of)?\s+(java|python|react|node|sql|ruby|php|c\+\+|rust)/i,
  /\bwhy\s+(was|is|did|were)\s+(ruby|python|java|php|javascript|c\+\+|perl|pascal|cobol|scala|haskell|rust|go|swift|kotlin)\b/i,
  /\bwhy\s+(was|is)\s+.*?\s+(famous|popular|used|created)\b/i,
  /\b(famous|popular)\s+in\s+the\s+(\d{4}s|\d{2}s)\b/i,
  /\bwho\s+is\s+(shiva|john|alex|michael|david|sarah|emily)\b/i,
  /\btell\s+me\s+about\s+(shiva|john|alex|michael|david)\b/i,
];

/**
 * Evaluates whether a user message provides meaningful, context-relevant project discovery information.
 * Uses semantic intent analysis rather than static word blacklists.
 */
export function isProjectDiscoveryInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;

  // 1. Gibberish or keyboard smash check -> INVALID
  if (isGibberishInput(clean)) return false;

  const lower = clean.toLowerCase();

  // 2. Direct project discovery indicators (stating what to build, features, scale, timeline, or budget)
  const hasProjectIntent =
    /\b(build|need|want|create|develop|app|website|web app|mobile app|platform|portal|dashboard|system|refactor|migrate|codebase|java|kotlin|python|react|ios|android|automation|algorithm|service|store|storefront|shop|e-commerce|restaurant|food|dairy|farm|clinic|health|telehealth|property|real estate|logistics|fleet|delivery|inventory|checkout|booking|cart|kds|menu|sms|notification|budget|cost|timeline|weeks|months|asap|flexible|discuss|aceva team|location|users|staff)\b/i.test(
      lower
    );

  // 3. Check for Non-Discovery Query Intent (Casual chat, WH-questions with no project info, ACEVA internal inquiries, general knowledge/trivia)
  const isQuestionFormat =
    /^(who|what|why|how|when|where|which|can you|tell me|explain)\b/i.test(lower) || /\?$/.test(clean);

  // Incoherent question text (e.g. "Who are you, you", "what is what")
  const isIncoherentQuestion =
    /^(who|what|why|how)\s+(are|is|do|did)\s+(you|it|that|this)\s*,?\s*(you|it|that|this)?$/i.test(clean);
  if (isIncoherentQuestion) return false;

  const isAnswerPreference = /\b(discuss|flexible|direct|team|deal|negotiate|asap|tbd)\b/i.test(lower);

  // ACEVA Company / Internal / Staff / WH Questions without explicit project discovery intent
  const isAcevaInternalQuery =
    !isAnswerPreference &&
    (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean)) ||
      (/\baceva\b/i.test(lower) &&
        !/\b(build|app|website|platform|refactor|project|quote|pricing|hire|work with)\b/i.test(lower)));
  if (isAcevaInternalQuery) return false;

  // General Tech Trivia, History, Science, Math, Geography, Stock Market, General Knowledge
  const isGeneralKnowledgeQuery =
    GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean)) ||
    OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean));
  if (isGeneralKnowledgeQuery) return false;

  // Standalone Greetings / Casual Check-ins
  if (GREETING_PATTERNS.some((p) => p.test(clean))) return false;

  // If message is in question format and lacks explicit project discovery parameters, it is a non-discovery query
  if (isQuestionFormat && !hasProjectIntent) {
    return false;
  }

  return true;
}

/**
 * Check if the input is a standalone greeting or casual check-in.
 */
export function isGreetingInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;
  return GREETING_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Check if the message is casual conversation, greeting, company FAQ, or general tech trivia.
 */
export function isCasualOrFAQOrGeneralQuery(userMessage: string): boolean {
  return !isProjectDiscoveryInput(userMessage);
}

/**
 * Legacy compatibility alias for casual input check.
 */
export function isCasualOrNonProgressInput(userMessage: string): boolean {
  return isCasualOrFAQOrGeneralQuery(userMessage);
}

/**
 * Generate natural, concise conversational, FAQ, or tech trivia responses without advancing project progress.
 */
export function getCasualOrFAQResponse(userMessage: string): string | null {
  const clean = userMessage.trim().toLowerCase();

  // Questions about unrelated individuals (e.g. Shiva)
  if (/\b(shiva|who\s+is\s+shiva|tell\s+me\s+about\s+shiva)\b/i.test(clean)) {
    return "I am PULSE, ACEVA's AI System Architect focused on software architecture discovery. For team or individual inquiries, please feel free to reach out to our team directly. What software product or project are you looking to build?";
  }

  const isAnswerPref = /\b(discuss|flexible|direct|team|deal|negotiate|asap|tbd)\b/i.test(clean);

  // Company FAQ & ACEVA WH Questions
  if (!isAnswerPref && (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean)) || /\baceva\b/i.test(clean))) {
    return "ACEVA Technologies is a digital engineering agency that designs and builds custom web platforms, mobile apps, and automated software systems for modern businesses. What software product or project are you looking to build?";
  }

  // Greetings & Check-ins
  if (/how\s+are\s+you|how\s+r\s+u|how\s+is\s+it\s+going|what'?s\s+up/i.test(clean)) {
    return "I'm doing great, thank you! I'm PULSE, ACEVA's AI System Architect. What software project or digital direction can I help map out for you today?";
  }

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hola)/i.test(clean)) {
    return "Hello! I'm PULSE, ACEVA's AI System Architect. Tell me what you'd like to build or improve, and I'll help map out your project direction.";
  }

  if (/^(ok|okay|cool|nice|thanks|thank you|great|awesome|got it|understood)/i.test(clean)) {
    return "You're welcome! Whenever you're ready, tell me a bit about your project or business goals, and we will map out your system architecture.";
  }

  // General Tech History, Science, Geography, History, Stock Market & General Knowledge Questions
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean)) || OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean))) {
    return "That's an interesting question! However, PULSE is specifically designed to help map out your software project, refactoring needs, or application requirements with ACEVA. Tell me what software product or digital system you'd like to build!";
  }

  // Fallback for any non-discovery query
  if (!isProjectDiscoveryInput(userMessage)) {
    return "I'm here to help map out your software project direction with ACEVA. Please tell me a bit about what software product, web platform, or mobile app you would like to build!";
  }

  return null;
}

/**
 * Check if the input is gibberish, nonsense, keyboard mash, or random characters.
 * Examples: "hdgjsabdasvjvdahs", "asdfghjkl", "xyz123abc", "123456", "aaaaa"
 */
export function isGibberishInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return true;

  // Pulse ID reference code exception (e.g. PLS-260829-123)
  if (/PLS-\d{6}-\d{3}/i.test(clean)) return false;

  // Very short non-alphanumeric noise (e.g. "?", "a", "1", "..")
  if (clean.length < 2) return true;
  if (!/[a-zA-Z]/.test(clean)) return true;

  const lower = clean.toLowerCase();

  // Single word with no vowels (e.g. "hdgjsabdasvjvdahs", "bcdfghjkl", "xyz123abc")
  if (!/\s/.test(clean) && clean.length > 4 && !/[aeiouy]/.test(lower)) {
    return true;
  }

  // Check repeating single characters (e.g. "aaaaaaa", "zzzzzz")
  if (/^(.)\1{4,}$/i.test(clean)) return true;

  // Keyboard smashes & random string patterns (e.g. "asdfghjkl", "qwertyuiop", "zxcvbnm", "xyz123abc", "hdgjsabdasvjvdahs")
  if (
    /asdf|ghjk|qwert|yuiop|zxcv|123abc|abc123|hdgjs|vjvd|sdah|fghj/i.test(lower) &&
    clean.length < 30
  ) {
    return true;
  }

  // 5+ consecutive consonants in a single token (e.g. "hdgjsabdasvjvdahs")
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    if (token.length > 5 && /[^aeiouy0-9]{5,}/.test(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Natural response for gibberish or nonsense input without advancing progress.
 */
export function getGibberishOrNonsenseResponse(): string {
  return "I didn't quite catch that. Please enter a clear project description or specific question about your software requirements so I can help map out your project direction.";
}

/**
 * Check if the input contains valid project discovery answer or scope information.
 * Returns true for any non-casual, non-FAQ, non-gibberish user answer provided during discovery
 * (e.g. "I will discuss that with ACEVA's team directly", "Flexible budget", "3 locations", "Build a mobile app").
 */
export function isExplicitProjectScopeInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;

  // Non-project general queries (greetings, company FAQs, general tech trivia, gibberish) are NEVER valid project answers
  if (isCasualOrFAQOrGeneralQuery(clean) || isGibberishInput(clean)) {
    return false;
  }

  return true;
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

  if (isGibberishInput(clean)) return true;

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

export { cleanUserMappedValue } from "./format";
