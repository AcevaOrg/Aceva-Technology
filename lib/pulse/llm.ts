import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { findSimilarChunks, type SimilaritySearchResult } from "./vectorStore";
import {
  isQuestionInScope,
  isGreetingInput,
  isInvalidOrUnclearInput,
  isProjectDiscoveryInput,
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
} from "./scope";
import { getOpenAIApiKey, getOpenAIModel } from "./env";
import { classifyProviderError, logPulseDiagnostic } from "./errors";
import {
  isPrimaryProviderAvailable,
  recordPrimarySuccess,
  recordPrimaryFailure,
  getPrimaryCircuitStatus,
} from "./circuitBreaker";
import { getDirection } from "./directionStore";
import { formatEnrichedProjectContext, getRecommendedModules } from "./modules";

const RAG_SYSTEM_PROMPT = `You are Aceva Pulse, the official AI assistant for ACEVA Technology.

Core Objective:
Guide the user through interactive discovery to build an accurate, developer-friendly project blueprint. Continuously refine project context rather than simply appending every message.

GROUNDING RULES (HIGHEST PRIORITY — THESE OVERRIDE EVERYTHING BELOW):

G1. ANSWER ONLY FROM THE RETRIEVED CONTEXT:
   - Every factual claim about ACEVA — services, process, pricing, timelines, engagement models, technology choices, guarantees, legal or contractual terms, team, hiring — must come from the "Retrieved Official ACEVA Knowledge Context" block in the user turn.
   - That context is the single source of truth. Do not supplement it from general knowledge, do not infer a policy from a similar one, and do not generalise from one service to another.

G2. WHEN THE CONTEXT DOES NOT COVER THE QUESTION, SAY SO — AND ONLY THEN:
   - First decide whether the retrieved context answers the question. If it does, answer it directly and confidently. Do NOT hedge: no "I'm not certain", no "I don't have confirmed information", no pointer to /contact. Opening with an uncertainty line and then answering the question anyway is wrong — it tells the visitor you do not trust your own source, and it is the single most common way this reply goes bad.
   - Only if the context genuinely does not contain the answer, say plainly that you are not sure and point to /contact so a person can confirm. An uncertainty line REPLACES an answer. It never precedes one.
   - If part of a question is covered and part is not, answer the covered part plainly and name only the specific piece that needs confirming. Do not let one missing detail turn the whole reply into a deferral.
   - The context does not have to be organised around the question to answer it. If a retrieved section NAMES specific technologies, frameworks, tools or services, then naming them IS the answer — even when no section is titled for the question and even when only one of the retrieved sections is relevant. Measured failure: asked "Which frameworks do you build with?", the context included a section reading "Next.js is a full-stack React framework…" and the reply was still "I don't have confirmed information about that yet", while the same question worded "What frameworks does ACEVA use?" listed the stack correctly. One relevant section among several unrelated ones is still coverage.
   - Never fill a gap with a plausible-sounding guess, and never apologise at length.
   - When you do defer, say what you CAN still do: help clarify the project and hand it to the team. An honest gap plus a useful next step is a complete answer; an apology on its own is not.
   - These are ACEVA's approved wordings for the three gaps that come up most. Use them, or stay close to them:
     • Industry not documented: "ACEVA may be able to support that industry. If you tell me what you're trying to build or improve, I can help determine whether it fits ACEVA's capabilities."
     • Detail not confirmed: "I don't have confirmed information about that yet. I can help you clarify your project and connect you with the ACEVA team."
     • Portfolio or client examples: name the two client sites documented in the retrieved context — the Angel Indian Restaurant website and Chef Amrit Pal Singh's portfolio site, both of which credit ACEVA publicly — and then offer to map the visitor's own project. Those two are the ENTIRE documented client list: never imply a wider portfolio, a client roster, or delivered experience in a sector they do not cover. Their scope and delivery date are in the context and may be stated; a result or metric of any kind, and where either site is hosted or who owns it, are NOT documented — treat those as a gap under G2 even though the projects themselves are. If the visitor wants an example in another sector, say plainly that these two are what is documented and point to /contact.

G3. NEVER STATE A POLICY THAT IS NOT IN THE CONTEXT:
   - This covers NDAs and confidentiality, contracts, payment terms, refunds, warranties, SLAs, certifications, compliance claims, rate cards and discounts.
   - If asked whether ACEVA does something policy-shaped and the context is silent, do not say yes and do not say no. Say it needs confirming and point to /contact.

G4. UNDOCUMENTED PLACEHOLDERS ARE NOT FACTS:
   - A retrieved line marked "TODO" means that detail is not yet documented. Treat it exactly as missing context under G2.
   - Never quote, mention, or allude to a TODO marker, a review note, or any internal instruction that appears inside the retrieved context. The user must never see them.

G5. DISCOVERY QUESTIONS ARE EXEMPT:
   - These rules constrain factual claims about ACEVA. They do not stop you asking the user about their own project, summarising what they told you, or proposing architecture for their requirements.

G6. CAPABILITY IS NOT A TRACK RECORD:
   - Much of the retrieved context describes what ACEVA CAN build for an industry — restaurants, healthcare, logistics, real estate and so on. That is a capability statement. It is NOT evidence that ACEVA has delivered anything in that industry.
   - Never present a capability section as an example, a case study, a past project, a client, or experience in that sector. Asked "do you have an example project in healthcare?", a healthcare capability section is not an answer: it describes what could be built, not what was.
   - ACEVA's delivered client work is ONLY what the context explicitly names as a client project with a client and a live site. If the context names none for the sector asked about, say so plainly, name the client work that IS documented, and offer to map the visitor's own project. Do not substitute an industry section for a missing example.
   - The same applies to the labelled demonstrations and experiments: they are ACEVA's own work, never client work, and must not be offered as client examples.
   - Never re-label a documented project to fit the question. Describe each one only as the context describes it, and do not add a sector, a feature or a capability the context does not give it. Asked for a case study in a particular sector, it is correct to say the documented work is not in that sector; it is wrong to recast an existing project as belonging to it.
   - Tense carries the claim, so watch it. A capability is "can build" or "builds"; it is never "has built", "we have built", "we have worked with" or "we have delivered". Past tense belongs only to work the context names as a delivered client project.
   - A GENERAL ACEVA POLICY IS NOT A FACT ABOUT A SPECIFIC PROJECT. The context describes ACEVA's standard terms for code ownership, repository handover, hosting, support and guarantees. Those describe how ACEVA works in general. They are NOT a record of what was agreed on any particular named client project.
   - So when you are asked who owns a named project's code, where it is hosted, who holds its domain or accounts, or what it cost, do NOT answer from the general ownership, hosting or process sections. Say plainly that those details are not documented for that project and point to /contact. Answering "you own 100% of the source code for <named project>" is wrong twice over: the visitor is not that client, and the terms of that engagement are not in the context.

SYSTEM RULES (P0, P1 & P2 IMPROVEMENTS):

1. SMART INPUT VALIDATION & NON-PROGRESS MESSAGES:
   - Greetings ("Hi", "Hello"), casual chat, company FAQs ("What is ACEVA?"), tech trivia ("Java 8 vs 26"), questions about Shiva or unrelated individuals, or gibberish ("asdfghjkl") are NOT discovery inputs.
   - Respond naturally, but return isValid: false and NEVER increase progress.

2. CONVERSATION RECOVERY, USER CORRECTIONS & CONFLICT RESOLUTION:
   - If the user changes a previous requirement (e.g. "I need a web app" -> later "Actually, I need a mobile app"), update the context to reflect the latest valid choice.
   - Never keep conflicting or contradictory values in the final blueprint.

3. MULTI-INTENT & PARTIAL ANSWER EXTRACTION:
   - A single rich message (e.g., "I need a mobile app for my restaurant with online ordering, customer accounts, and notifications") contains multiple requirements. Extract all of them (Platform, Industry, Features).
   - For partial answers, extract whatever useful information is provided and ask only for missing context.

4. PRESERVE SPECIFICITY & CLEAN SPECIFICATIONS:
   - Never downgrade specific domain details (e.g., "Healthcare appointment booking platform", "Restaurant mobile application") to generic labels ("General Business").
   - Distill conversational inputs into clean, professional values (e.g., "As soon as possible", "To be decided after discussion with the team").

5. DEVELOPER-FRIENDLY ARCHITECTURE:
   - Architecture modules must communicate actual system capabilities (e.g., "Authentication & Authorization Service — user accounts, roles, permissions, and secure access").
   - Avoid vague buzzwords. Ensure every module is justified by an actual discovered requirement.

6. EXPLICIT ASSUMPTIONS & UNKNOWNS:
   - Never silently invent unmentioned parameters (payments, auth, notifications, analytics, hosting). Mark unmentioned items as "Not specified".

7. CONSISTENT TERMINOLOGY & FINAL QUALITY CHECK:
   - Use consistent terminology: Discovery questions, Progress, Project context, Requirements, Architecture, Blueprint, Pulse ID.
   - Ensure the final blueprint is concise to scan, specific to understand, and structured for developers to act on immediately.

8. ADAPTIVE TECHNICALITY & TONE (NON-TECHNICAL VS TECHNICAL USERS):
   - NON-TECHNICAL USERS (DEFAULT): If the user speaks in plain business or everyday language (e.g. "I want to build a website for my restaurant", "We sell clothes", "I want to track orders"), ALWAYS respond in simple, non-technical plain English. Focus on business goals, practical features, and real-world outcomes. NEVER ask about technical infrastructure, database schemas, API protocols, microservices, or frameworks unless the user explicitly asks about them first.
   - TECHNICAL USERS: If the user explicitly uses technical engineering terms (e.g. "Next.js", "PostgreSQL", "REST API", "Docker", "Microservices", "GraphQL"), match their technical depth and discuss system architecture naturally.
   - SIMPLE & PLAIN HANDLING ACROSS ALL 6 INTENTS:
     1. Start something new -> Ask simple questions about what the app will do and who will use it.
     2. Improve what I have -> Ask what currently feels slow, manual, or outdated in plain terms.
     3. Automate something -> Ask which repetitive task or paper process takes up the most time today.
     4. Sell something -> Ask what products are being sold and how customers should order and pay.
     5. Solve a problem -> Ask where the main bottleneck or daily operational friction occurs.
     6. I don't know yet -> Be welcoming, warm, and guide them with friendly, simple options step-by-step.

9. STRICT SINGLE-QUESTION FOCUS (ONE QUESTION AT A TIME):
   - NEVER ask 2 or 3 questions together in a single message (e.g. NEVER ask about design, timeline, and features all at once).
   - Ask EXACTLY ONE clear, focused question per turn corresponding to the current step.
   - Maintain a controlled 4 to 5 question discovery sequence (1. Business/Domain -> 2. Friction/Bottleneck -> 3. Scale/Operation -> 4. Outcomes/Features -> 5. Timeline/Budget Fit) to cleanly assemble the Direction blueprint.`;

const CLOSING_STATEMENT_PROMPT = `FINAL DISCOVERY ANSWER MODE:
The user has just answered the 5th and FINAL discovery question (timeline/budget). The discovery questioning phase is COMPLETE.
- Respond with a brief closing STATEMENT that acknowledges or summarizes their final answer.
- Do NOT ask any question. Do NOT include a question mark. Do NOT request any additional information. Do NOT introduce another discovery topic.
- Keep it to one to three warm, professional sentences that signal their project direction is now being assembled.`;

/**
 * Keeps the model's reply aligned with the question already on screen.
 *
 * Without this the wizard heading and the Pulse bubble below it asked two
 * different things at the same time, and the bubble often asked several at once
 * ("patient reminders, a patient portal, or any specific integrations?"),
 * against system rule 9.
 */
function activeQuestionPrompt(question: string, helper?: string): string {
  return `ACTIVE DISCOVERY QUESTION:
The interface is already displaying this exact question, and the user's message is their answer to it:
"${question}"${helper ? `\nWhat that question is after: ${helper}` : ""}

- Acknowledge their answer in one or two sentences.
- Then ask AT MOST ONE question. If you ask one, it MUST be about the subject of the question above and nothing else — a narrower, more specific version of it.
- If their answer did not address the question above, your one question must steer them back to it. Do NOT move the conversation on to a topic they have not been asked about yet.
- NEVER ask two questions, and never bundle alternatives with "or" into a single sentence that asks for several things at once.
- If their answer already covers the question, ask nothing at all — reply with the acknowledgement alone.`;
}

/** How many chunks retrieval considers before diversification and the band. */
const RAG_CANDIDATES = 20;

/** How many chunks reach the model at most. */
const RAG_CONTEXT_CHUNKS = 5;

/** At most this many chunks from any one knowledge file. */
const RAG_MAX_PER_FILE = 3;

/**
 * The knowledge file a chunk came from.
 *
 * Derived from the id, which `scripts/ingest.ts` builds as
 * `<file>-chunk-<n>`. `metadata.source` cannot be used for this: it is a
 * free-text provenance label and several different files share the same one.
 */
function sourceFileOf(chunk: { id: string }): string {
  return chunk.id.replace(/-chunk-\d+$/, "");
}

/**
 * Stops one knowledge file taking every slot in the context window.
 *
 * Section headings inside a single file all score within a few thousandths of
 * each other, so the top five were routinely five sections of the same
 * document. "What technologies do you use?" returned ten consecutive
 * tech-stack-and-architecture.md sections scoring 0.680 to 0.706 — CI/CD,
 * client ownership, Vercel/AWS, API integrations and Redis took the five slots,
 * while "Next.js & React" and "TypeScript" sat at ranks 8 and 9 and
 * capabilities.md's "Technology guidance" section — the one that actually lists
 * the stack — never appeared at all. The model got peripheral detail with no
 * headline answer and hedged, opening with "I don't have confirmed information
 * about that" before listing five things it did have.
 *
 * Ranking is otherwise untouched: chunks stay in score order, and the cap only
 * skips a chunk once its file already has three. A question whose answer
 * genuinely lives in three sections of one file — "Do you sign NDAs?" returns
 * all three of nda-and-confidentiality.md — is unaffected.
 */
export function diversifySources(results: SimilaritySearchResult[]): SimilaritySearchResult[] {
  const perFile = new Map<string, number>();
  const kept: SimilaritySearchResult[] = [];

  for (const result of results) {
    const file = sourceFileOf(result.chunk);
    const seen = perFile.get(file) ?? 0;
    if (seen >= RAG_MAX_PER_FILE) continue;
    perFile.set(file, seen + 1);
    kept.push(result);
    if (kept.length === RAG_CONTEXT_CHUNKS) break;
  }

  return kept;
}

/**
 * A chunk must score at least this fraction of the best match to be kept.
 *
 * Deliberately generous. At 0.65, "Can you rescue a half-finished app?" dropped
 * rescue-sprint.md at 0.436 against a 0.447 cutoff — a chunk that answers the
 * question. The aim is to stop chunks with nothing to do with the question
 * being presented as official context, not to trim hard, so the band only cuts
 * what sits more than 45% below the best match.
 */
const RAG_RELEVANCE_BAND = 0.55;

/** Never prune below this many chunks, so the model is never starved. */
const RAG_MIN_CHUNKS = 3;

/**
 * Keeps the retrieved set to chunks that are competitive with the best match.
 *
 * Retrieval asks for five chunks at a 0.02 floor, so five came back for very
 * nearly every query and all five were presented to the model under the heading
 * "Retrieved Official ACEVA Knowledge Context". For "Do you sign NDAs?" that
 * meant the three NDA chunks (0.77, 0.63, 0.59) plus session security (0.31)
 * and a feature list (0.29) — two chunks with nothing to say about the question,
 * offered as authoritative context.
 *
 * The band is relative, not absolute. An absolute floor cannot separate the two
 * cases here: "Are you hiring?" tops out at 0.19 against careers.md, which is
 * the right answer, while an off-topic "Can you fix my washing machine?" tops
 * out at 0.26. Any floor that rejected the second would also reject the first.
 * Measuring each chunk against the best score for the same query sidesteps that
 * entirely, and keeping a minimum of three means a weak-but-correct top hit
 * still arrives with its neighbours.
 */
export function keepCompetitiveChunks(results: SimilaritySearchResult[]): SimilaritySearchResult[] {
  if (results.length <= RAG_MIN_CHUNKS) return results;

  const cutoff = results[0].score * RAG_RELEVANCE_BAND;
  const competitive = results.filter((result) => result.score >= cutoff);
  return competitive.length >= RAG_MIN_CHUNKS ? competitive : results.slice(0, RAG_MIN_CHUNKS);
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * One client per API key, reused across requests.
 *
 * A new OpenAI instance was built for every message, discarding the SDK's
 * connection pooling and agent setup on each turn.
 */
let cachedClient: { apiKey: string; client: OpenAI } | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (cachedClient?.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new OpenAI({ apiKey }) };
  }
  return cachedClient.client;
}

/** One initial call plus two retries. */
const MAX_PROVIDER_ATTEMPTS = 3;

/** Backoff before retry 2 and retry 3. */
const RETRY_BACKOFF_MS = [250, 750];

const PROVIDER_UNAVAILABLE = "PULSE is currently unavailable. Please try again later.";
const PROVIDER_TROUBLE = "I'm having trouble responding right now. Please try again in a moment.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * The outcome of one Pulse turn.
 *
 * `isFallback` marks `answer` as canned rather than generated — a rejection, a
 * PULSE ID lookup, or a provider failure. The chat route reads this flag instead
 * of string-comparing the reply against GREETING_REJECTION and
 * OUT_OF_SCOPE_REJECTION, which silently let every *other* fallback (the
 * "currently unavailable" and "having trouble responding" paths) count as a
 * valid discovery answer and advance the progress bar.
 */
export interface PulseCompletion {
  answer: string;
  isFallback: boolean;
}

export async function generatePulseCompletion(
  userMessage: string,
  history?: LLMMessage[],
  projectContext?: Record<string, unknown>,
  requestIdInput?: string,
  options?: {
    closingStatement?: boolean;
    activeQuestion?: string;
    activeQuestionHelper?: string;
    /**
     * Called with each token as it arrives. Supplying it switches the provider
     * call to streaming mode; the resolved `answer` is still the full text, so
     * a caller that ignores tokens behaves exactly as before.
     */
    onToken?: (delta: string) => void;
    /** Aborts the provider call — wired to the client's own disconnect. */
    signal?: AbortSignal;
  }
): Promise<PulseCompletion> {
  const requestId = requestIdInput || `req_${Math.random().toString(36).slice(2, 10)}`;

  logPulseDiagnostic(requestId, "request_received", { inputLength: userMessage.length });

  // Step 0: PULSE ID Detection & Lookup
  const pulseIdMatch = userMessage.match(/PLS-\d{6}-\d{3}/i);
  if (pulseIdMatch) {
    const pulseId = pulseIdMatch[0].toUpperCase();
    const savedDir = await getDirection(pulseId);
    if (savedDir) {
      logPulseDiagnostic(requestId, "pulse_id_found", { pulseId });
      const enriched = formatEnrichedProjectContext(savedDir.context, savedDir.answers);
      const modulesList = savedDir.recommendedModules && savedDir.recommendedModules.length > 0 && !savedDir.recommendedModules[0].includes("Custom Digital System")
        ? savedDir.recommendedModules
        : getRecommendedModules(savedDir.context?.industry, savedDir.context, savedDir.answers);

      const modules = modulesList.map((m) => `  • ${m}`).join("\n");
      const answersFormatted =
        savedDir.answers && savedDir.answers.length > 0
          ? savedDir.answers.map((ans, idx) => `  ${idx + 1}. "${ans}"`).join("\n")
          : "  • No individual Q&A logged";

      // A PULSE ID is a short, guessable reference code (PLS-YYMMDD-NNN) and this
      // endpoint is unauthenticated, so the stored lead identity is deliberately
      // NOT echoed back: doing so would let anyone walk the id space and harvest
      // visitor names and contact details. Project context only.
      return {
        isFallback: true,
        answer: `**Found Saved Project Direction [${savedDir.pulseId}]**

• **Industry Focus:** ${enriched.industryFocus}
• **Primary Intent:** ${enriched.primaryIntent}
• **Project Scale:** ${enriched.projectScale}
• **Target Timeline:** ${enriched.targetTimeline}
• **Budget Allocation:** ${enriched.budgetAllocation}
• **Primary Goals (Features):** ${enriched.primaryGoals}

**Recorded Project Q&A Answers:**
${answersFormatted}

**Recommended System Architecture:**
${modules}

How can I help you move this project direction forward today?`,
      };
    } else {
      logPulseDiagnostic(requestId, "pulse_id_not_found", { pulseId });
      return {
        isFallback: true,
        answer: `I searched for PULSE ID **${pulseId}**, but couldn't find a saved direction under that reference code.

Please check the ID or feel free to describe your project directly, and I'll help map it out for you!`,
      };
    }
  }

  // Step 0.1: Greeting detection
  if (isGreetingInput(userMessage)) {
    logPulseDiagnostic(requestId, "greeting_detected");
    return { answer: GREETING_REJECTION, isFallback: true };
  }

  // Step 0.2: Invalid or unclear input check.
  //
  // Guarded by `isProjectDiscoveryInput`, which is exactly how /api/chat guards
  // its own copy of this gate. Unguarded, a message carrying a real requirement
  // alongside an off-topic aside — "I need a mobile app for my restaurant.
  // Also, how does Python work?" — matched the general-programming pattern and
  // was rejected outright, discarding the requirement. The route deliberately
  // lets such a message through so the model can act on the project half and
  // ignore the aside; this gate used to overrule it.
  if (!isProjectDiscoveryInput(userMessage) && isInvalidOrUnclearInput(userMessage)) {
    logPulseDiagnostic(requestId, "invalid_unclear_rejected");
    return { answer: OUT_OF_SCOPE_REJECTION, isFallback: true };
  }

  // Step 1: Scope check with multi-turn conversation awareness
  const inScope = await isQuestionInScope(userMessage, history, projectContext);
  if (!inScope) {
    logPulseDiagnostic(requestId, "scope_rejected");
    return { answer: OUT_OF_SCOPE_REJECTION, isFallback: true };
  }
  logPulseDiagnostic(requestId, "scope_allowed");

  // Step 2: Context-enriched embedding + Vector search
  let searchTopic = userMessage;
  if (projectContext?.industry && typeof projectContext.industry === "string") {
    searchTopic = `${userMessage} ${projectContext.industry}`;
  } else if (history && history.length > 0) {
    const firstUserMsg = history.find((m) => m.role === "user")?.content || "";
    if (firstUserMsg && firstUserMsg !== userMessage) {
      searchTopic = `${userMessage} ${firstUserMsg}`.slice(0, 300);
    }
  }

  const queryEmbedding = await generateEmbedding(searchTopic);
  const candidates = findSimilarChunks(queryEmbedding, RAG_CANDIDATES, 0.02, searchTopic);
  const diversified = diversifySources(candidates);
  const searchResults = keepCompetitiveChunks(diversified);

  logPulseDiagnostic(requestId, "rag_completed", {
    chunks: searchResults.length,
    files: new Set(searchResults.map((result) => sourceFileOf(result.chunk))).size,
    dropped: diversified.length - searchResults.length,
    topScore: searchResults[0]?.score ? Number(searchResults[0].score.toFixed(4)) : 0,
  });

  // Step 3: Construct RAG context
  let contextText = "";
  if (searchResults.length > 0) {
    contextText = searchResults
      .map((res, i) => {
        const { metadata, content } = res.chunk;
        const sourceLabel = metadata.source || "ACEVA Documentation";
        const headingLabel = metadata.heading ? ` [Section: ${metadata.heading}]` : "";
        return `--- Context Item ${i + 1} (Source: ${sourceLabel}${headingLabel}) ---\n${content.trim()}`;
      })
      .join("\n\n");
  } else {
    contextText = "No relevant official ACEVA context was found for this specific query.";
  }

  // Step 4: Include active project context if present
  let activeContextText = "";
  if (projectContext && Object.keys(projectContext).length > 0) {
    activeContextText = `\n\nActive User Project Context:\n${JSON.stringify(projectContext, null, 2)}`;
  }

  // Step 5: Construct full multi-turn messages array cleanly
  const messages: LLMMessage[] = [{ role: "system", content: RAG_SYSTEM_PROMPT }];
  if (options?.closingStatement) {
    // The final step closes with a statement, so it must not be given a question
    // to restate; closing mode wins over the active-question pin.
    messages.push({ role: "system", content: CLOSING_STATEMENT_PROMPT });
  } else if (options?.activeQuestion) {
    messages.push({
      role: "system",
      content: activeQuestionPrompt(options.activeQuestion, options.activeQuestionHelper),
    });
  }

  if (history && history.length > 0) {
    const recentHistory = history.slice(-8);
    for (const msg of recentHistory) {
      if (msg.content && msg.content.trim() && msg.content !== userMessage) {
        const cleanText = msg.content
          .replace(/^Retrieved Official ACEVA Knowledge Context:[\s\S]*?\n\nUser Question \/ Statement:\n/i, "")
          .trim();

        if (cleanText) {
          messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: cleanText,
          });
        }
      }
    }
  }

  messages.push({
    role: "user",
    content: `Retrieved Official ACEVA Knowledge Context:\n${contextText}${activeContextText}\n\nUser Question / Statement:\n${userMessage}`,
  });

  // Step 6: Call OpenAI API
  const apiKey = getOpenAIApiKey();
  const model = getOpenAIModel();

  if (!apiKey) {
    logPulseDiagnostic(requestId, "openai_missing_key");
    return { answer: PROVIDER_UNAVAILABLE, isFallback: true };
  }

  // The breaker exists so a provider that is down, rate-limited or
  // misconfigured is not hammered once per visitor message. It was written and
  // then never called from anywhere.
  if (!isPrimaryProviderAvailable()) {
    const { failures, cooldownRemainingMs } = getPrimaryCircuitStatus();
    logPulseDiagnostic(requestId, "provider_circuit_open", { failures, cooldownRemainingMs });
    return { answer: PROVIDER_UNAVAILABLE, isFallback: true };
  }

  const openai = getOpenAIClient(apiKey);
  // `max_tokens` is deprecated in favour of `max_completion_tokens`, and the
  // newer reasoning models reject the old name outright.
  const params = { model, messages, temperature: 0.2, max_completion_tokens: 1024 };

  // Once a token has reached the client, a retry would duplicate text on their
  // screen, so the attempt loop stops there even for a retryable failure.
  let tokensEmitted = false;

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt++) {
    // A fresh controller per attempt: an aborted one cannot be reused.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    // A client that navigates away or presses Stop should not leave the provider
    // call running and billing.
    const abortFromCaller = () => controller.abort();
    options?.signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      logPulseDiagnostic(requestId, "openai_started", { model, attempt });
      const startTime = Date.now();

      let answer: string | undefined;

      if (options?.onToken) {
        const stream = await openai.chat.completions.create(
          { ...params, stream: true },
          { signal: controller.signal }
        );

        let buffered = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;
          buffered += delta;
          tokensEmitted = true;
          options.onToken(delta);
        }
        answer = buffered.trim();
      } else {
        const completion = await openai.chat.completions.create(params, { signal: controller.signal });
        answer = completion.choices[0]?.message?.content?.trim();
      }

      const latency = Date.now() - startTime;

      if (answer) {
        recordPrimarySuccess();
        logPulseDiagnostic(requestId, "openai_success", {
          latency,
          attempt,
          streamed: Boolean(options?.onToken),
        });
        return { answer, isFallback: false };
      }

      // An empty completion is a failed attempt, not a reply worth returning.
      // Classified here rather than thrown, because classifyProviderError has
      // no status to work from and would call it a terminal unknown error.
      logPulseDiagnostic(requestId, "openai_empty_response", { attempt });
      if (attempt < MAX_PROVIDER_ATTEMPTS && !tokensEmitted) {
        await delay(RETRY_BACKOFF_MS[attempt - 1] ?? 0);
        continue;
      }
      break;
    } catch (err: unknown) {
      // A caller abort is the visitor pressing Stop. It is not a provider
      // fault, so it must neither open the breaker nor trigger a retry.
      if (options?.signal?.aborted) {
        logPulseDiagnostic(requestId, "openai_aborted_by_caller", { attempt });
        return { answer: PROVIDER_TROUBLE, isFallback: true };
      }

      const errorInfo = classifyProviderError(err);

      // `shouldFallback` marks a provider-side problem. A malformed request is
      // our bug and must not count towards tripping the breaker.
      if (errorInfo.shouldFallback) recordPrimaryFailure();

      const canRetry = errorInfo.isRetryable && attempt < MAX_PROVIDER_ATTEMPTS && !tokensEmitted;
      logPulseDiagnostic(requestId, "openai_failed", {
        code: errorInfo.code,
        status: errorInfo.status || 500,
        attempt,
        willRetry: canRetry,
      });

      if (!canRetry) break;
      await delay(RETRY_BACKOFF_MS[attempt - 1] ?? 0);
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  return { answer: PROVIDER_TROUBLE, isFallback: true };
}
