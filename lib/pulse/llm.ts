import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { findSimilarChunks } from "./vectorStore";
import { isQuestionInScope, OUT_OF_SCOPE_REJECTION } from "./scope";
import { getOpenAIApiKey, getOpenAIModel } from "./env";
import { classifyProviderError, logPulseDiagnostic } from "./errors";
import { getDirection } from "./directionStore";

const RAG_SYSTEM_PROMPT = `You are PULSE, the official AI assistant for ACEVA Technology.

Core Objective:
Guide the user through a 5-step interactive discovery to build a complete project blueprint. Ask relevant, focused questions tailored to their selected section and previous answers.

CRITICAL RULES:

1. ABSOLUTE BAN ON GUESSING OR SUGGESTING BUDGET NUMBERS:
   - NEVER suggest, invent, or output round monetary figures (such as $5,000, $10,000, $15,000, etc.).
   - The user will specify their budget themselves. When asking about budget, ask open-endedly: "What budget or financial allocation do you have in mind for this project?"
   - ONLY include budget figures in project summaries if the user explicitly provided the exact number.

2. SECTION-RELEVANT & CONTEXT-AWARE QUESTIONING:
   - Always tailor your question directly to the section the user selected AND their previous response:
     • "Start something new": Focus on target platform (web, mobile app, camera algorithm) and core features.
     • "Improve what I have": Focus on existing system bottlenecks, desired upgrades, and legacy integrations.
     • "Automate something": Focus on manual workflows, triggers, scale, and operational automation.
     • "Sell something": Focus on products/services sold, checkout channels, and payment/logistics.
     • "Solve a problem": Focus on the specific business bottleneck, desired outcome, and operational impact.
     • "I don't know yet": Ask about their industry/business domain first, then guide them to the right platform solution.
   - DYNAMICALLY FOLLOW UP ON SPECIFIC USER INPUTS:
     • If the user mentions building a camera algorithm, video feed tool, AI model, or hardware device—ASK SPECIFIC QUESTIONS about camera feeds, target devices (iOS/Android/CCTV), and detection requirements. DO NOT ask generic website or e-commerce questions!

3. 5-STEP SEQUENTIAL DISCOVERY (1 QUESTION PER TURN):
   - Ask EXACTLY 1 clear, relevant question per response to collect the 5 key blueprint parameters:
     Step 1: Platform Type & Core Idea
     Step 2: Key Functional Features / Algorithm Requirements
     Step 3: Target Users, Scale & Operating Environment
     Step 4: Target Delivery Timeline
     Step 5: Project Budget Allocation (Open-ended ask)
   - On Turn 5: Summarize the complete 5-point project blueprint in bullet points and confirm that context is 100% complete so they can save their project direction.

4. ABSOLUTE BAN ON TECHNICAL JARGON:
   Speak in plain, simple business terms. NEVER use code framework names (React, Next.js, Node, PostgreSQL), DevOps jargon (CI/CD, unit tests, staging previews), or acronyms (CRM, SDLC, API, OAuth) UNLESS explicitly requested.

5. DIRECT ANSWER FIRST:
   Address the user's specific response in your very first sentence before asking the next step's question.

6. STRICT NON-REPETITION:
   NEVER ask a question that has already been answered in previous messages.`;

const DEFAULT_TIMEOUT_MS = 15000;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generatePulseCompletion(
  userMessage: string,
  history?: LLMMessage[],
  projectContext?: Record<string, unknown>,
  requestIdInput?: string
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
      const modules = savedDir.recommendedModules?.map((m) => `  • ${m}`).join("\n") || "  • Custom ACEVA Digital System";
      const friction = savedDir.context?.friction?.join(", ") || "None specified";
      const goals = savedDir.context?.goals?.join(", ") || "None specified";
      const timeline = savedDir.context?.timeline || savedDir.answers?.[4] || savedDir.answers?.[3] || "Not specified";
      const scale = savedDir.context?.scale || "Not specified";
      const answersFormatted =
        savedDir.answers && savedDir.answers.length > 0
          ? savedDir.answers.map((ans, idx) => `  ${idx + 1}. "${ans}"`).join("\n")
          : "  • No individual Q&A logged";

      return `**Found Saved Project Direction [${savedDir.pulseId}]**

• **Client Name:** ${savedDir.lead.name}
• **Contact Info:** ${savedDir.lead.contact} (Preferred: ${savedDir.lead.method})
• **Industry Focus:** ${savedDir.context?.industry || "General Business"}
• **Primary Intent:** ${savedDir.context?.intent || "Custom Solution"}
• **Target Timeline:** ${timeline}
• **Project Scale & Operating Environment:** ${scale}
• **Key Goals:** ${goals}
• **Friction Points:** ${friction}

**Recorded Project Q&A Answers:**
${answersFormatted}

**Recommended Solution Architecture:**
${modules}

How can I help you move this project direction forward today?`;
    } else {
      logPulseDiagnostic(requestId, "pulse_id_not_found", { pulseId });
      return `I searched for PULSE ID **${pulseId}**, but couldn't find a saved direction under that reference code.

Please check the ID or feel free to describe your project directly, and I'll help map it out for you!`;
    }
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
