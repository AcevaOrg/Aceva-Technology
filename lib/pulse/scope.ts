import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import { LLMMessage } from "./llm";

export const GREETING_REJECTION =
  "Hello! Please enter a specific question about ACEVA's services or describe your project so I can help map out your project direction.";

export const OUT_OF_SCOPE_REJECTION =
  "Please enter a clear, relevant question about your project or ACEVA's software development services.";

// Helper function to normalize stretched characters (e.g. "hyyyyyyyyyyyyyyyy" -> "hy", "heyyyyyyyy" -> "hey", "salaaaam" -> "salam")
function normalizeStretchedText(text: string): string {
  return text.toLowerCase().replace(/(.)\1{2,}/g, "$1");
}

// Helper to detect incoherent / meaningless WH-questions consisting entirely of WH-words, auxiliaries, and pronouns
export function isIncoherentQuestion(cleanMessage: string): boolean {
  const normalized = normalizeStretchedText(cleanMessage).replace(/[^\w\s]/g, "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const INCOHERENT_WORDS = new Set([
    "who", "what", "why", "how", "when", "where", "which",
    "can", "could", "does", "do", "did", "is", "are", "am", "was", "were",
    "you", "your", "it", "that", "this", "then", "be", "happen"
  ]);

  // If every single word in the message belongs to INCOHERENT_WORDS, it's a meaningless question chain
  return words.every((w) => INCOHERENT_WORDS.has(w));
}

// Standalone greeting & casual conversational patterns (should NOT increase question/progress percentage)
const GREETING_PATTERNS = [
  /^(hi|hii|hiii|hello|helo|heloo|hey|heyy|heyyy|greetings|good morning|good afternoon|good evening|yo|sup|hola|hallo|halo|hy|hyy|hyyy|salam|salaam|assalamu?\s*alaikum|assalam?\s*o?\s*alaikum|asalam\s*o?\s*alaikum|aoa)[\s!.]*$/i,
  /^(hey|hello|hi|hy)\s+(there|\d+|bro|friend|team)[\s!.]*$/i,
  /^how\s+(are|r)\s+(you|u)(\s+doing)?[\s?!.]*$/i,
  /^how\s+is\s+it\s+going[\s?!.]*$/i,
  /^what('?s|\s+is)\s+up[\s?!.]*$/i,
  /^(who|what)\s+are\s+you[\s?!.]*$/i,
  /^(ok|okay|cool|nice|thanks|thank you|great|awesome|got it|understood)[\s!.]*$/i,
  /^(good to see you|nice to meet you|hope you'?re doing well|let'?s talk|listen to this|can we talk|can we chat|are you there|are you available|are you okay|what can you do|i'?m bored|make me laugh|tell me something|guess what|nothing|random)[\s!.]*$/i,
  /^(blah\s+){1,}blah[\s!.]*$/i,
  /^(test\s+){1,}test[\s!.]*$/i,
];

// Explicit ACEVA domain keywords & intent indicators
const ACEVA_DOMAIN_TERMS = [
  "aceva",
  "pulse",
  "seva",
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
  /\bwho\s+(won|is|was|played|scored|painted|wrote|invented|created|founded)\s+(the|a)?\s*(cricket|football|match|world cup|super bowl|oscar|election|game|mona lisa|romeo|telephone|apple|bitcoin)?\b/i,
  /\b(weather|temperature|forecast|rain|snow)\s+(today|tomorrow|in|this)\b/i,
  /\b(tell|give)\s+me\s+a\s+(joke|riddle|story|poem|song|recipe|quote|movie|film|bedtime story)\b/i,
  /\b(recipe|ingredients|cook|bake|kitchen|tea|coffee|cake|pizza)\s+(for|how|to)?\b/i,
  /\b(planet|planets|solar system|galaxy|universe|space|star|stars|astronomy|physics|biology|chemistry|moon|everest|ocean|trench|photosynthesis|airplane|airplanes|sky|evolution)\b/i,
  /\bwhy\s+is\s+the\s+(sky|ocean|sea|sun|grass)\s+(blue|green|yellow|red)\b/i,
  /\b(news|happened)\s+(today|in the news)\b/i,

  // Development, origins, history topics ("How did X develop?", "Where did X originate?")
  /\bhow\s+did\s+.*?\s+(develop|originate|start|begin|become)\b/i,
  /\bwhere\s+did\s+.*?\s+(originate|start|begin)\b/i,

  // General Questions & Trivia
  /\bwhat\s+is\s+the\s+(distance|height|speed|population|currency|boiling point|chemical formula|capital|rule|offside)\b/i,
  /\bhow\s+(many|much|far|deep|tall|high)\s+(continents|planets|ocean|mountains|distance|people)\b/i,
  /\bhow\s+do\s+i\s+(train|clean|make|cook|bake|fix a flat|fly)\b/i,

  // Homework & Math Tasks & Unit Conversions
  /\b(solve|calculate|compute|convert)\s+(this|the)?\s*(math|equation|integral|derivative|algebra|calculus|problem|square root|cube root|kilograms|meters|miles)?\b/i,
  /\bwhat\s+is\s+\d+\s*[\+\-\*\/\s\w]*\d+/i,
  /\bsolve\s+[x-z0-9\+\-\*\/\=\s]+/i,
  /\bpythagorean\s+theorem\b/i,
];

// Company & FAQ Questions about ACEVA, SEVA, Pulse (MUST NOT advance project progress)
const ACEVA_FAQ_PATTERNS = [
  /what('?s|\s+is)\s+(aceva|seva|pulse)(\s+technologies)?/i,
  /what\s+does\s+(aceva|seva|pulse)(\s+technologies)?\s+(do|build|offer|provide|work)/i,
  /who\s+(is|are|created|leads?)\s+(aceva|seva|pulse|you)/i,
  /tell\s+me\s+about\s+(aceva|seva|pulse)/i,
  /where\s+are\s+you\s+(located|based)/i,
  /what\s+(services|capabilities)\s+do\s+(you|aceva|seva|pulse)\s+(offer|provide)/i,
  /how\s+(does|is|do|can|did)\s+(aceva|seva|pulse)\b/i,
  /how\s+(aceva|seva|pulse)\s+(works?|operates?|functions?|builds?)/i,
  /how\s+much\s+does\s+(aceva|seva|pulse)\s+cost/i,
  /\b(aceva|seva|pulse)'?s?\s*(internal|mechanism|workers?|staff|leads?|founders?|ceo|process|operation|technology)/i,
  /\bwho\s+(works?\s+at|leads?)\s+(aceva|seva|pulse)\b/i,
  /\bwhy\s+does\s+pulse\s+ask\s+questions\b/i,
  /\b(how|what|who|why|where)\b.*?\b(aceva|seva|pulse)\b/i,
];

// General Tech History, Trivia, Comparison, Meta, or Educational Questions (MUST NOT advance project progress)
const GENERAL_TECH_TRIVIA_PATTERNS = [
  /\b(java\s*\d*|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|react|angular|vue|node|perl|pascal|cobol)\s+(is|vs|versus|better|faster|older|newer|worse|compared|famous|popular)\b/i,
  /\bwhat\s+(is|does|did)\s+(java|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|react|node|javascript|typescript|perl|pascal|cobol|an? operating system|a database|a server|an api|a compiler)\s*(do|mean|used)?/i,
  /\b(explain|difference|comparison)\s+(between|of)?\s+(java|python|react|node|sql|ruby|php|c\+\+|rust|operating systems|databases)/i,
  /\bwhy\s+(was|is|did|were)\s+(ruby|python|java|php|javascript|c\+\+|perl|pascal|cobol|scala|haskell|rust|go|swift|kotlin)\b/i,
  /\bwhy\s+(was|is)\s+.*?\s+(famous|popular|used|created)\b/i,
  /\b(famous|popular)\s+in\s+the\s+(\d{4}s|\d{2}s)\b/i,
  /\bwhich\s+(operating system|database|social media|programming language|language|framework|cloud provider)\s+is\s+(better|best)\b/i,
  /\bwhy\s+do\s+you\s+(need|ask)\b/i,
  /\bwhy\s+do\s+(websites|apps|systems)\s+(need|use)\b/i,
  /\bhow\s+does\s+this\s+system\s+work\b/i,
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

  // 1. Gibberish, keyboard smash, or noise check -> INVALID
  if (isGibberishInput(clean)) return false;

  // 2. Incoherent / meaningless WH-questions check -> INVALID
  if (isIncoherentQuestion(clean)) return false;

  const lower = clean.toLowerCase();
  const normalized = normalizeStretchedText(clean);

  // Explicit non-discovery meta/question checks FIRST
  if (/\bwhy\s+do\s+you\s+(need|ask)\b/i.test(lower)) return false;
  if (/\bwhy\s+do\s+(websites|apps|systems)\s+(need|use)\b/i.test(lower)) return false;

  // Check for explicit project discovery intent (including mixed intent statements)
  const hasExplicitProjectIntent =
    /\b(build|we need|i need|need (an?|to|a)|we want|i want|want (an?|to|a)|create (an?|a)|develop (an?|a)|refactor|migrate|redesign|modernize|start a (new )?project|budget|timeline|asap|flexible|discuss (with|\w+)|booking system|ordering system|admin dashboard|e-commerce|web app|mobile app|java to kotlin|target users|target audience|business owners|customer accounts|staff accounts|platform to work|both web and mobile|managed through|managed via|our current process|handled via)\b/i.test(
      lower
    ) ||
    (/\b(app|website|platform|portal|dashboard|software|system)\b/i.test(lower) &&
      /\b(restaurant|food|dairy|farm|clinic|telehealth|real estate|logistics|fleet|delivery|inventory|checkout|booking|cart|store|shop|business)\b/i.test(lower));

  // If the message contains explicit project intent (even if mixed with trivia or greetings), it is valid!
  if (hasExplicitProjectIntent) {
    return true;
  }

  // Additional casual noise / meta / trivia patterns
  if (/\b(nothing|nan|bored|make me laugh|random|nice to meet you|tell me a joke)\b/i.test(lower)) return false;

  // Check stretched or standard Greetings / Casual Check-ins
  if (isGreetingInput(clean)) return false;
  if (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;
  if (OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;

  // Question format without explicit project intent -> INVALID
  const isQuestionFormat =
    /^(who|what|why|how|when|where|which|can you|could you|tell me|explain)\b/i.test(lower) || /\?$/.test(clean);
  if (isQuestionFormat) return false;

  return true;
}

/**
 * Check if the input is a standalone greeting or casual check-in (including stretched/misspelled greetings).
 */
export function isGreetingInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;

  if (GREETING_PATTERNS.some((pattern) => pattern.test(clean))) {
    return true;
  }

  const normalized = normalizeStretchedText(clean).replace(/[^\w\s]/g, "").trim();

  // Match stretched/misspelled greetings: hiya, hy, hyy, hyyyy, heyy, heyyyy, helloo, haloo, halo, salam, salaam, salam alaikum, assalamu alaikum, aoa, etc.
  const GREETING_WORDS = /^(hi|hii|hiya|hello|helo|heloo|helllo|hey|heyy|greetings|good morning|good afternoon|good evening|yo|sup|hola|hallo|halo|haloo|hy|hyy|hyyy|salam|salaam|salam\s+alaikum|salaam\s+alaikum|assalamu?\s*alaikum|assalam?\s*o?\s*alaikum|asalam\s*o?\s*alaikum|salam\s*o?\s*alaikum|aoa)(\s+pulse|\s+there|\s+bro|\s+friend|\s+team)?$/i;

  return GREETING_WORDS.test(normalized) || GREETING_WORDS.test(clean.toLowerCase().replace(/[^\w\s]/g, "").trim());
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

  // If the message contains explicit project discovery intent (e.g. mixed intent statement), return null to process discovery completion
  if (isProjectDiscoveryInput(userMessage)) {
    return null;
  }

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
  if (/^(how\s+are\s+you|how\s+r\s+u|how\s+is\s+it\s+going|what'?s\s+up)[\s?!.]*$/i.test(clean)) {
    return "I'm doing great, thank you! I'm PULSE, ACEVA's AI System Architect. What software project or digital direction can I help map out for you today?";
  }

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hola|hy|hallo|halo|salam|salaam|assalamu?\s*alaikum|aoa)(\s+pulse|\s+there|\s+bro|\s+friend|\s+team)?[\s!.]*$/i.test(clean)) {
    return "Hello! I'm PULSE, ACEVA's AI System Architect. Tell me what you'd like to build or improve, and I'll help map out your project direction.";
  }

  if (/^(ok|okay|cool|nice|thanks|thank you|great|awesome|got it|understood)[\s!.]*$/i.test(clean)) {
    return "You're welcome! Whenever you're ready, tell me a bit about your project or business goals, and we will map out your system architecture.";
  }

  // General Tech History, Science, Geography, History, Stock Market & General Knowledge Questions
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean)) || OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean))) {
    return "That's an interesting question! However, PULSE is specifically designed to help map out your software project, refactoring needs, or application requirements with ACEVA. Tell me what software product or digital system you'd like to build!";
  }

  // Fallback for any non-discovery query
  return "I'm here to help map out your software project direction with ACEVA. Please tell me a bit about what software product, web platform, or mobile app you would like to build!";
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

  // Pure symbol/punctuation noise (e.g. "!!! ???", "@#$%^&*", "...")
  if (/^[\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]+$/.test(clean)) return true;

  // Repeated single character noise (e.g. "00000000", "11111111", "aaaaa")
  if (/^(.)\1{3,}$/.test(clean)) return true;

  // Unformatted random 7+ digit sequence without currency formatting (e.g. "123456789")
  if (/^\d{7,}$/.test(clean)) return true;

  // Realistic monetary / numeric values exception (e.g. "$5,000", "5000", "$10k", "5k", "2500")
  if (/^\$?\d{1,3}(,\d{3})*(\.\d{2})?\s*k?$/i.test(clean) || /^\d{1,6}\s*k?$/i.test(clean)) {
    return false;
  }

  // Number-only or repetitive digit sequences (e.g. "123456789", "000000000")
  if (/^\d+$/.test(clean.replace(/\s+/g, ""))) return true;

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

  // Keyboard smashes & random string patterns
  if (
    /asdf|ghjk|qwert|yuiop|zxcv|123abc|abc123|hdgjs|vjvd|sdah|fghj|qazx|qazw|plmo|q1w2|qweqwe|asdasd|qwepoi|xvbnm|mnbvc|lkjhg|zxcmnb|jshdf|xczvbn|zzxxcc|asdkjh/i.test(
      lower
    ) &&
    clean.length < 50
  ) {
    return true;
  }

  // 5+ consecutive consonants in a clean single token for unpronounceable text
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    const cleanToken = token.replace(/[^\w]/g, "");
    if (cleanToken.length > 4 && /[^aeiouy0-9]{5,}/.test(cleanToken)) {
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
  return isProjectDiscoveryInput(userMessage);
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
  if (isIncoherentQuestion(clean)) return true;

  // Out of scope pattern match (general knowledge trivia, math, recipes, etc.)
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
