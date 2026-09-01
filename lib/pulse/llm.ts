import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import {
  isQuestionInScope,
  isGreetingInput,
  isInvalidOrUnclearInput,
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
} from "./scope";
import { getOpenAIApiKey, getOpenAIModel } from "./env";
import { classifyProviderError, logPulseDiagnostic } from "./errors";
import { getDirection } from "./directionStore";
import { formatEnrichedProjectContext, getRecommendedModules } from "./modules";

const RAG_SYSTEM_PROMPT = `You are Aceva Pulse, the official AI assistant for ACEVA Technology.

Core Objective:
Guide the user through interactive discovery to build an accurate, developer-friendly project blueprint. Continuously refine project context rather than simply appending every message.

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

const DEFAULT_TIMEOUT_MS = 15000;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generatePulseCompletion(
  userMessage: string,
  history?: LLMMessage[],
  projectContext?: Record<string, unknown>,
  requestIdInput?: string,
  options?: { closingStatement?: boolean }
): Promise<string> {
  const requestId = requestIdInput || `req_${Math.random().toString(36).slice(2, 10)}`;

  logPulseDiagnostic(requestId, "request_received", { inputLength: userMessage.length });

  // Step 0: PULSE ID Detection & Lookup
  const pulseIdMatch = userMessage.match(/PLS-\d{6}-\d{3}/i);
  if (pulseIdMatch) {
    const pulseId = pulseIdMatch[0].toUpperCase();
    const savedDir = getDirection(pulseId);
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

      return `**Found Saved Project Direction [${savedDir.pulseId}]**

• **Client Name:** ${savedDir.lead.name}
• **Contact Info:** ${savedDir.lead.contact} (Preferred: ${savedDir.lead.method})
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

How can I help you move this project direction forward today?`;
    } else {
      logPulseDiagnostic(requestId, "pulse_id_not_found", { pulseId });
      return `I searched for PULSE ID **${pulseId}**, but couldn't find a saved direction under that reference code.

Please check the ID or feel free to describe your project directly, and I'll help map it out for you!`;
    }
  }

  // Step 0.1: Greeting detection
  if (isGreetingInput(userMessage)) {
    logPulseDiagnostic(requestId, "greeting_detected");
    return GREETING_REJECTION;
  }

  // Step 0.2: Invalid or unclear input check
  if (isInvalidOrUnclearInput(userMessage, history, projectContext)) {
    logPulseDiagnostic(requestId, "invalid_unclear_rejected");
    return OUT_OF_SCOPE_REJECTION;
  }

  // Step 1: Scope check with multi-turn conversation awareness
  const inScope = await isQuestionInScope(userMessage, history, projectContext);
  if (!inScope) {
    logPulseDiagnostic(requestId, "scope_rejected");
    return OUT_OF_SCOPE_REJECTION;
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
  const searchResults = findSimilarChunks(queryEmbedding, 5, 0.02, searchTopic);

  logPulseDiagnostic(requestId, "rag_completed", {
    chunks: searchResults.length,
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
    messages.push({ role: "system", content: CLOSING_STATEMENT_PROMPT });
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
    return "PULSE is currently unavailable. Please try again later.";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    logPulseDiagnostic(requestId, "openai_started", { model });
    const startTime = Date.now();

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const answer = completion.choices[0]?.message?.content?.trim();

    if (answer) {
      logPulseDiagnostic(requestId, "openai_success", { latency });
      return answer;
    }

    logPulseDiagnostic(requestId, "openai_empty_response");
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const errorInfo = classifyProviderError(err);
    logPulseDiagnostic(requestId, "openai_failed", {
      code: errorInfo.code,
      status: errorInfo.status || 500,
    });
  }

  return "I'm having trouble responding right now. Please try again in a moment.";
}
