import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import { LLMMessage } from "./llm";

/**
 * The two most frequently seen canned replies, so they are written as an
 * assistant speaking rather than as form validation ("Please enter a clear,
 * relevant question…"). Both still do the same job — no progress, and a nudge
 * back to the project — and both use the one identity wording this module and
 * the UI share: "Aceva Pulse, ACEVA's AI assistant".
 */
export const GREETING_REJECTION =
  "Hello! I'm Aceva Pulse, ACEVA's AI assistant. Tell me what you'd like to build or improve, or ask about ACEVA's services, and I'll help map out your project direction.";

export const OUT_OF_SCOPE_REJECTION =
  "That one is outside what I can help with — I cover ACEVA's services and your own project. Tell me what you'd like to build, improve, or automate, and I'll help map out a direction.";

// Helper function to normalize stretched characters (e.g. "heelooo" -> "helo", "hyyyyyyyyyyyyyyyy" -> "hy", "heyyyyyyyy" -> "hey", "salaaaam" -> "salam")
function normalizeStretchedText(text: string): string {
  return text.toLowerCase().replace(/(.)\1+/g, "$1");
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
  /^(hi|hii|hiii|hello|helo|heelo|heloo|heeloo|heelooo|hey|heyy|heyyy|greetings|good morning|good afternoon|good evening|yo|sup|hola|hallo|halo|hy|hyy|hyyy|salam|salaam|assalamu?\s*alaikum|assalam?\s*o?\s*alaikum|asalam\s*o?\s*alaikum|aoa)[\s!.]*$/i,
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
// Every term here promises that a question about it is answerable, so each one
// must have a knowledge/ file behind it. "seva" was removed: nothing under
// knowledge/ documents it, so it admitted questions Pulse could only guess at.
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
  // "mobile application" was removed as a dead entry: matching is substring-based,
  // so "mobile app" already matches it in any user message.
  "mobile app",
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
  // The literal word does not appear in knowledge/, but careers.md is what
  // answers "are you hiring?" and does so correctly, so the topic is covered.
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
  // Client work. Each of these is answerable from knowledge/client-projects.md,
  // which documents the two publicly credited client sites. "angel" is not a
  // term on its own: matching is substring-based, so it would also fire on
  // "Los Angeles".
  "portfolio",
  "case study",
  "case studies",
  "client work",
  "angel indian",
  "angel restaurant",
  "amrit",
  "chefamritpalsingh",
  // Delivery, security and AI topics the knowledge base now answers (knowledge
  // expansion, 31 October 2026). Without them a paraphrase such as "How do you
  // handle scope changes?" or "Which vector database do you use?" carried no
  // ACEVA term and depended on the vector floor. Matching is substring-based,
  // so each term is long enough not to fire inside an unrelated word ("rag"
  // would match "storage").
  "legacy",
  "moderniz",
  "modernis",
  "migration",
  "vector database",
  "vector db",
  "pgvector",
  "pinecone",
  "qdrant",
  "knowledge assistant",
  "retrieval",
  "owasp",
  "sql injection",
  "xss",
  "csrf",
  "gdpr",
  "ccpa",
  "hipaa",
  "hotfix",
  "app store",
  "play store",
  "offline",
  "sprint",
  "audit",
  "warranty",
  "maintenance",
  "scope change",
  "feature request",
  "change order",
  "repository",
  "repositories",
  "source code",
  "handover",
  "human resources",
  "hr email",
  "recruit",
];

/** Terms of business a visitor may ask ACEVA about. Used only with ADDRESSED_TO_ACEVA. */
const COMMERCIAL_POLICY_TERMS =
  /\b(refunds?|cancel(?:s|led|ling|lation)?|payments?|pay|invoices?|invoicing|deposits?|warrant(?:y|ies)|contracts?|discounts?|prices?|pricing|costs?|charges?|fees?|quotes?|budgets?|hosts?|hosting|hosted|maintenance|support|confidential(?:ity)?|retention|retain|intellectual property|ownership|privacy|terms)\b/i;

/** The question is put to ACEVA ("do you", "your terms"), not about the world in general. */
const ADDRESSED_TO_ACEVA = /\b(you|your|yours|u)\b/i;

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
  /\b(what|explain|how)\s+(is|to|does)\s+(python|java|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql(?!\s+injection)|html|css|bash|regex)\b/i,
  /\bwrite\s+(a|an)?\s*(python|java|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|script|program|code|function|class|loop)/i,
  /\bhow\s+to\s+(write|code|implement|sort|reverse|solve|zip)\s+(in|a)\s*(python|java|javascript|c\+\+|leetcode|bash)/i,
  /\b(write|create)\s+a\s+snake\s+game/i,
  /\b(solve|debug|fix)\s+this\s+(code|error|leetcode|syntax)/i,

  // General Knowledge Trivia, Geography, History, People, Science
  /\b(capital|president|prime minister|governor|king|queen|emperor|ceo|founder)\s+of\b/i,
  // The subject is required. It was optional, so this reduced to "who" plus a
  // verb and matched every "Who is …" question ever asked — including "Who is
  // Amrit?", the chef ACEVA built two websites for, whose name is a documented
  // domain term. Trivia subjects are still caught, and questions about a person
  // at ACEVA are handled by ACEVA_FAQ_PATTERNS and the "ceo|founder of" pattern
  // above, which are unchanged.
  /\bwho\s+(won|is|was|played|scored|painted|wrote|invented|created|founded)\s+(the|a)?\s*(cricket|football|match|world cup|super bowl|oscar|election|game|mona lisa|romeo|telephone|apple|bitcoin)\b/i,
  /\b(weather|temperature|forecast|rain|snow)\s+(today|tomorrow|in|this)\b/i,
  /\b(tell|give)\s+me\s+a\s+(joke|riddle|story|poem|song|recipe|quote|movie|film|bedtime story)\b/i,
  // A recipe request, not any mention of food.
  //
  // This was one pattern — `(recipe|ingredients|cook|bake|kitchen|tea|coffee|
  // cake|pizza)\s+(for|how|to)?` — whose trailing group was fully optional, so
  // it reduced to "a food word followed by a space" and matched the ordinary
  // vocabulary of the industry this product uses as its own example:
  // "kitchen staff", "coffee shop", "pizza place", "staff bake fresh bread".
  // Pulse's own suggested answer for discovery step 4 — "Customers can order
  // online directly, and kitchen staff see orders on one simple screen" — was
  // rejected as out-of-scope, so a visitor who typed the placeholder they were
  // shown got a "please enter a clear, relevant question" refusal and no
  // progress. Actual recipe requests are still caught: they are question-shaped
  // ("how do I bake…", "tell me a recipe", "what's the recipe for…"), which the
  // patterns above and below already cover, and which `isProjectDiscoveryInput`
  // rejects on its own question-format rule. A bare verb like "cook the food"
  // or "brew the coffee" is not a recipe request — it is how a restaurant
  // describes its own operation — so it is deliberately not matched here.
  /\b(recipes?|ingredients)\s+(for|to)\b/i,
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

  // Homework & Math Tasks & Unit Conversions.
  //
  // The subject is now required. Both trailing groups used to be optional, so
  // this reduced to "solve|calculate|compute|convert followed by a space" and
  // swallowed everyday product language: "the app should calculate delivery
  // fees", "convert more visitors into customers", and the intent menu's own
  // opener "I want to solve a business problem." ("problem" has also left the
  // subject list for that reason — solving a business problem is the entire
  // point of the product.) Bare arithmetic like "Calculate 25*25" names no
  // subject, so it is matched on the expression instead — and the expression
  // has to follow the verb directly, or "calculate delivery fees for 2-3
  // locations" would read as arithmetic on the "2-3".
  /\b(solve|calculate|compute|convert)\s+(this|the)?\s*[\d.,]*\s*(math|equation|integral|derivative|algebra|calculus|square root|cube root|kilograms?|kilos?|grams?|pounds?|meters?|metres?|miles|celsius|fahrenheit)\b/i,
  /\b(solve|calculate|compute)\s+(this\s+)?[\d\s().]*\d\s*[-+*/x×÷^]\s*\d/i,
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

/**
 * A question put to ACEVA about itself: its name, people, location, services or
 * the assistant. Such a question is always in scope and never junk, because
 * company.md, contact.md and faq.md say what may be answered and what must be
 * deferred. The trivia patterns are still applied to everything else.
 */
function isAboutAceva(message: string): boolean {
  return /\b(aceva|pulse)\b/i.test(message) || ACEVA_FAQ_PATTERNS.some((pattern) => pattern.test(message));
}

// General Tech History, Trivia, Comparison, Meta, or Educational Questions (MUST NOT advance project progress)
const GENERAL_TECH_TRIVIA_PATTERNS = [
  /\b(java\s*\d*|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|sql|html|css|bash|react|angular|vue|node|perl|pascal|cobol)\s+(is|vs|versus|better|faster|older|newer|worse|compared|famous|popular)\b/i,
  /\bwhat\s+(is|does|did)\s+(java|python|c\+\+|c#|rust|go|php|ruby|swift|kotlin|react|node|javascript|typescript|perl|pascal|cobol|an? operating system|a database|a server|an api|a compiler)\s*(do|mean|used)?/i,
  /\b(explain|difference|comparison)\s+(between|of)?\s+(java|python|react|node|sql(?!\s+injection)|ruby|php|c\+\+|rust|operating systems|databases)/i,
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

  // A question put to ACEVA about its own work or capabilities is not an answer
  // to a discovery question, so it must not advance the progress bar.
  //
  // This has to be decided before `hasExplicitProjectIntent` below, which
  // returns early on a bare "build" or on a platform word beside an industry
  // word. That let three portfolio and capability questions count as discovery
  // answers: "Can you build a mobile app for iOS and Android?", "What did you
  // build for Angel Indian Restaurant?" and "Tell me about the Angel Indian
  // Restaurant website" all moved the progress bar while a visitor was simply
  // reading about past work.
  //
  // A visitor describing their own requirement is still a discovery answer,
  // including when they phrase it politely as a question ("Can you build me an
  // ordering app for my restaurant?"). What separates the two is a first-person
  // reference to their own business, so that is what lifts the veto. "me" is
  // deliberately not one of those words: it appears in "tell me about…".
  const isQuestionAboutAceva =
    /^(can|could|do|does|did|have|has|are|is|will|would)\s+(you|aceva|pulse)\b/i.test(lower) ||
    /^(tell|show)\s+me\s+(about|more)\b/i.test(lower) ||
    /^(what|which|who|when|where|why|how)\b[^?]*\b(you|your|aceva|pulse)\b/i.test(lower);
  const describesOwnBusiness = /\b(i|we|my|our|i'm|i am|we're|we are|i've|we've)\b/i.test(lower);
  if (isQuestionAboutAceva && !describesOwnBusiness) return false;

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
  if (/\b(nothing|nothin|nan|bored|make me laugh|random|nice to meet you|tell me a joke|testing?|whatever|anything|something)\b/i.test(lower)) return false;

  // Check stretched or standard Greetings / Casual Check-ins
  if (isGreetingInput(clean)) return false;
  if (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;
  if (OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean) || p.test(normalized))) return false;

  // Question format without explicit project intent -> INVALID
  const isQuestionFormat =
    /^(who|what|why|how|when|where|which|can you|could you|tell me|explain)\b/i.test(lower) || /\?$/.test(clean);
  if (isQuestionFormat) return false;

  // Single non-domain token check: a single word that is NOT a recognized industry, platform, timeline, or monetary value -> INVALID
  const cleanTokens = lower.replace(/[^\w\s$]/g, "").split(/\s+/).filter(Boolean);
  if (cleanTokens.length === 1 && !hasExplicitProjectIntent) {
    const singleToken = cleanTokens[0];
    const isValidSingleTokenDomain = /^(restaurant|cafe|hotel|clinic|healthcare|education|school|gym|salon|realestate|ecommerce|logistics|dairy|finance|fintech|legal|travel|manufacturing|website|app|web|mobile|saas|portal|dashboard|software|system|rebuild|migrate|refactor|\$?\d+k?|asap|urgent|tbd)$/i.test(singleToken);
    if (!isValidSingleTokenDomain) {
      return false;
    }
  }

  return true;
}

/**
 * Check if the input is a standalone greeting or casual check-in (including stretched/misspelled greetings).
 */
export function isGreetingInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return false;

  const lower = clean.toLowerCase();
  const normalized = normalizeStretchedText(clean).replace(/[^\w\s]/g, "").trim();

  if (GREETING_PATTERNS.some((pattern) => pattern.test(clean) || pattern.test(normalized))) {
    return true;
  }

  // Match stretched/misspelled greetings: hiya, hy, hyy, hyyyy, heyy, heyyyy, helloo, heelo, heelooo, haloo, halo, salam, salaam, salam alaikum, assalamu alaikum, aoa, etc.
  const GREETING_STEMS = /^(hi|hii|hie|hiya|hello|helo|heelo|heloo|heeloo|heelooo|helllo|hey|heyy|heyyy|greetings|good morning|good afternoon|good evening|good day|good night|yo|sup|supp|hola|hallo|halo|haloo|haalo|hy|hyy|hyyy|salam|salaam|slm|slms|salam\s+alaikum|salaam\s+alaikum|assalamu?\s*alaikum|assalam?\s*o?\s*alaikum|asalam\s*o?\s*alaikum|salam\s*o?\s*alaikum|aoa)(\s+pulse|\s+aceva|\s+there|\s+bro|\s+friend|\s+team|\s+buddy)?$/i;

  if (GREETING_STEMS.test(clean) || GREETING_STEMS.test(lower) || GREETING_STEMS.test(normalized)) {
    return true;
  }

  // Single word check against common greeting stems after collapsing repeats
  const cleanNoPunct = lower.replace(/[^\w\s]/g, "").trim();
  if (!/\s/.test(cleanNoPunct)) {
    const collapsed = cleanNoPunct.replace(/(.)\1+/g, "$1");
    if (/^(hi|helo|hello|hey|hy|hie|hola|halo|hallo|yo|sup|salam|salamo|salaam|aoa)$/i.test(collapsed)) {
      return true;
    }
  }

  return false;
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

  // Identity & Persona Questions (who are you, what is your name, who am I talking to, are you pulse, etc.)
  if (
    /\b(who\s+are\s+you|what\s+is\s+your\s+name|who\s+am\s+i\s+talking\s+to|are\s+you\s+pulse|what\s+should\s+i\s+call\s+you|tell\s+me\s+about\s+yourself|are\s+you\s+an?\s+ai\s+assistant)\b/i.test(
      clean
    )
  ) {
    return "I'm Aceva Pulse, ACEVA's AI assistant. I help map out your project direction before you speak to the team.";
  }

  // Questions about unrelated individuals (e.g. Shiva)
  if (/\b(shiva|who\s+is\s+shiva|tell\s+me\s+about\s+shiva)\b/i.test(clean)) {
    return "I'm Aceva Pulse, ACEVA's AI assistant, and I only have information about ACEVA's services and your project. For questions about a specific person or the team, please reach out via /contact. What software product or project are you looking to build?";
  }

  const isAnswerPref = /\b(discuss|flexible|direct|team|deal|negotiate|asap|tbd)\b/i.test(clean);

  // Company FAQ & ACEVA WH Questions
  if (!isAnswerPref && (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean)) || /\baceva\b/i.test(clean))) {
    // Kept in step with knowledge/company.md and knowledge/capabilities.md. The
    // previous wording called the company "ACEVA Technologies" — a name that
    // appears nowhere else in the product — and described it as a "digital
    // engineering agency", which no knowledge source says. No location is
    // claimed here: company.md still has that open for team confirmation, and a
    // location question reaches company.md through retrieval anyway.
    return "ACEVA Technology designs and builds custom software, web platforms, mobile products, and intelligence and automation systems for businesses. What software product or project are you looking to build?";
  }

  // Greetings & Check-ins
  if (/^(how\s+are\s+you|how\s+r\s+u|how\s+is\s+it\s+going|what'?s\s+up)[\s?!.]*$/i.test(clean)) {
    return "I'm doing great, thank you! I'm Aceva Pulse, ACEVA's AI assistant. What software project or digital direction can I help map out for you today?";
  }

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup|hola|hy|hallo|halo|salam|salaam|assalamu?\s*alaikum|aoa)(\s+pulse|\s+there|\s+bro|\s+friend|\s+team)?[\s!.]*$/i.test(clean)) {
    return "Hello! I'm Aceva Pulse, ACEVA's AI assistant. Tell me what you'd like to build or improve, and I'll help map out your project direction.";
  }

  if (/^(ok|okay|cool|nice|thanks|thank you|great|awesome|got it|understood)[\s!.]*$/i.test(clean)) {
    return "You're welcome! Whenever you're ready, tell me a bit about your project or business goals, and we will map out your system architecture.";
  }

  // General Tech History, Science, Geography, History, Stock Market & General Knowledge Questions
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean)) || OUT_OF_SCOPE_PATTERNS.some((p) => p.test(clean))) {
    return "I can't help with that one, but I can with anything about ACEVA or your own project. What are you trying to build, improve or automate?";
  }

  // Fallback for any non-discovery query
  return "I'm here to help map out your software project direction with ACEVA. Please tell me a bit about what software product, web platform, or mobile app you would like to build!";
}

/** Phrasings that ask who or what Pulse is, rather than asking about a project. */
const ASSISTANT_IDENTITY_PATTERN =
  /\b(who\s+are\s+you|what\s+is\s+your\s+name|who\s+am\s+i\s+talking\s+to|are\s+you\s+pulse|what\s+should\s+i\s+call\s+you|tell\s+me\s+about\s+yourself|are\s+you\s+an?\s+ai\s+assistant)\b/i;

/**
 * Who/what Pulse is, as opposed to a question about the caller's project.
 *
 * Kept on the canned path deliberately: the assistant's own name is a fixed fact
 * and letting the model improvise it is how "Pulse AI Assistant" got shipped once
 * before. Nothing here reaches the knowledge base, so there is nothing to gain
 * from a retrieval round trip.
 */
export function isAssistantIdentityQuery(userMessage: string): boolean {
  return ASSISTANT_IDENTITY_PATTERN.test(userMessage.trim().toLowerCase());
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
    /asdf|ghjk|qwert|yuiop|zxcv|123abc|abc123|abcxyz|xyz123|hdgjs|vjvd|sdah|fghj|qazx|qazw|plmo|q1w2|qweqwe|asdasd|qwepoi|xvbnm|mnbvc|lkjhg|zxcmnb|jshdf|xczvbn|zzxxcc|asdkjh/i.test(
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
  return "I didn't quite catch that. Tell me what you'd like to build, improve or automate — a sentence is enough — or ask me anything about ACEVA.";
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
/**
 * A short message that points back at something said before: "Can you do
 * that?", "How long would it take?". Mid-conversation it is a follow-up, and
 * the model resolves the reference from the history (prompt rule 13). It was
 * classed as an incoherent question and refused as out of scope, even with a
 * conversation under way (P3 evaluation, 30 October 2026).
 */
export function isFollowUpReference(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean || isGibberishInput(clean)) return false;
  const words = clean.split(/\s+/).length;
  return words <= 10 && /\b(that|it|this|those|these|them|one)\b/i.test(clean);
}

/** The reply to a back-reference with nothing to refer back to. */
export const CLARIFY_REFERENCE_REPLY =
  "I'm not sure what you're referring to yet. What would you like ACEVA to build, improve or automate? A sentence about your business and the problem is enough to start.";

export function isInvalidOrUnclearInput(userMessage: string): boolean {
  const clean = userMessage.trim();
  if (!clean) return true;

  if (isGibberishInput(clean)) return true;
  if (isIncoherentQuestion(clean)) return true;

  // A question about ACEVA itself is never junk, whatever shape it takes. "Who
  // is the CEO of ACEVA?" matched the trivia pattern for "<title> of" and was
  // answered with the out-of-scope rejection, although company.md documents
  // exactly what to say (leadership is not published yet).
  if (isAboutAceva(clean)) return false;

  // Out of scope pattern match (general knowledge trivia, math, recipes, etc.)
  const isOOS = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(clean));
  if (isOOS) return true;

  // General tech trivia ("Why was Ruby popular in the 2010s?", "What is Java?").
  // These patterns were previously consulted only once a conversation was under
  // way, so on a first message the trivia reached the model. That was masked by
  // the chat route's blanket casual-reply gate; with that gate narrowed to
  // greetings and noise, the check has to happen here to stay deterministic.
  if (GENERAL_TECH_TRIVIA_PATTERNS.some((pattern) => pattern.test(clean))) return true;

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

  // 1. Explicit Out-of-Scope Pattern Match -> High confidence IRRELEVANT.
  //
  // Unless the same message also carries a genuine project requirement. The
  // aside in "I need a mobile app for my restaurant. Also, how does Python
  // work?" matched the general-programming pattern and vetoed the whole
  // message, so the requirement was thrown away and the visitor got a
  // rejection. A message with real intent stays in scope; the model is told to
  // answer the project half, and the aside simply goes unanswered.
  const matchesOOS = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(clean));
  if (matchesOOS && !isProjectDiscoveryInput(clean) && !isAboutAceva(clean)) {
    return false;
  }

  // 2. Direct ACEVA keyword match, or a question about ACEVA itself -> High
  // confidence RELEVANT. The FAQ shapes ("where are you located?") used to be
  // consulted only once a conversation was under way, so as a first message
  // they fell through to the vector check, which scored company.md below the
  // 0.20 floor and rejected a question the knowledge base answers.
  const hasAcevaTerm = ACEVA_DOMAIN_TERMS.some((term) => lower.includes(term));
  if (hasAcevaTerm || isAboutAceva(clean)) {
    return true;
  }

  // 2b. A commercial-policy question put to ACEVA. "Do you give refunds if I
  // cancel?" carries no ACEVA term and scored under the vector floor, so a
  // question pricing-approach.md exists to answer (by deferring honestly) got
  // the out-of-scope rejection instead (P3 quality evaluation, 30 October
  // 2026). It needs both a policy word and second-person address, so "what's
  // the cost of living in Karachi?" still goes to the vector check.
  if (COMMERCIAL_POLICY_TERMS.test(clean) && ADDRESSED_TO_ACEVA.test(clean)) {
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
    if (isGibberishInput(clean) || (isIncoherentQuestion(clean) && !isFollowUpReference(clean)) || isGreetingInput(clean)) {
      return false;
    }
    if (GENERAL_TECH_TRIVIA_PATTERNS.some((p) => p.test(clean))) {
      return false;
    }
    if (ACEVA_FAQ_PATTERNS.some((p) => p.test(clean))) {
      return true;
    }
    // Inside a conversation that is already under way, anything left is on
    // topic. This used to return `isProjectDiscoveryInput`, which answers a
    // different question: whether the message is an *answer to a discovery
    // question*, and it rejects every message shaped like a question. So once a
    // visitor had said anything at all, every natural follow-up was ruled out
    // of scope and never reached retrieval — "How long did that one take?",
    // "Who hosts it?", "What did the SEO achieve for them?" and "How much would
    // something like that cost me?" all came back with the out-of-scope
    // rejection in a few milliseconds. Follow-ups carry their subject in the
    // history rather than in the words, which is exactly why a keyword test
    // cannot judge them.
    //
    // Nothing is waved through: gibberish, incoherent chains, greetings and
    // tech trivia are rejected immediately above, and the explicit
    // out-of-scope patterns at step 1 run before any of this — so a mid-chat
    // "What is the capital of France?" is still refused.
    return true;
  }

  // 5. Vector Knowledge Similarity Check
  const queryEmb = await generateEmbedding(clean);
  const searchResults = findSimilarChunks(queryEmb, 1, 0.0, clean);
  const topScore = searchResults[0]?.score || 0;

  if (topScore >= 0.20) {
    return true;
  }

  // The hybrid score is half keyword relevance, and a misspelt message has
  // none: "wat servcies do u offr?" scored 0.200 hybrid against 0.399 cosine
  // and was refused as out of scope. The embedding alone reads through typos,
  // so it gets a second look at a higher floor. Measured on this corpus the
  // clearly off-topic messages top out near 0.25 cosine ("Can you fix my
  // washing machine?" 0.241, "best pizza in Karachi" 0.196) while misspelt
  // in-scope ones sit at 0.32-0.42, so 0.30 separates the two.
  if (queryEmb) {
    const cosineOnly = findSimilarChunks(queryEmb, 1, 0.0, "")[0]?.score || 0;
    if (cosineOnly >= 0.30) {
      return true;
    }
  }

  return false;
}

export { cleanUserMappedValue } from "./format";
