import { NextResponse } from "next/server";
import { generatePulseCompletion } from "@/lib/pulse/llm";
import { logPulseDiagnostic } from "@/lib/pulse/errors";
import {
  isGreetingInput,
  isCasualOrFAQOrGeneralQuery,
  getCasualOrFAQResponse,
  isGibberishInput,
  getGibberishOrNonsenseResponse,
  isInvalidOrUnclearInput,
  isExplicitProjectScopeInput,
  isProjectDiscoveryInput,
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
} from "@/lib/pulse/scope";
import {
  detectActiveQuestionTarget,
  validateAnswerAgainstQuestion,
} from "@/lib/pulse/answerValidator";
import {
  withRouteErrorHandling,
  ApiError,
  methodNotAllowedHandler,
  optionsHandler,
  readString,
} from "@/lib/api/response";
import {
  getClientIp,
  checkRateLimit,
  cleanupRateLimitStore,
} from "@/lib/rateLimit";

const MAX_MESSAGE_CHARS = 1_000;

const CLOSING_STATEMENT_FALLBACK =
  "Noted — that completes the discovery phase. Pulse now has the full picture of your project and is assembling your recommended direction.";

/**
 * The response that ends discovery must be a statement: drop any sentence that
 * asks a question, falling back to a fixed closing line if nothing remains.
 */
function enforceClosingStatement(answer: string): string {
  if (!answer.includes("?")) return answer;
  const kept = answer
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.trim().endsWith("?"))
    .join(" ")
    .replace(/\?/g, ".")
    .trim();
  return kept.length >= 20 ? kept : CLOSING_STATEMENT_FALLBACK;
}

export const POST = withRouteErrorHandling("chat", async (request, requestId) => {
  // 1. Rate limiting
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    const seconds = Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    logPulseDiagnostic(requestId, "api_rate_limited", { seconds });
    throw new ApiError("RATE_LIMITED", { retryAfterSeconds: seconds }, { ip });
  }
  if (Math.random() < 0.05) cleanupRateLimitStore();

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logPulseDiagnostic(requestId, "api_invalid_json");
    return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
  }

  const reqBody = body as Record<string, unknown>;

  if (!("message" in reqBody) || typeof reqBody.message !== "string") {
    logPulseDiagnostic(requestId, "api_invalid_payload");
    return NextResponse.json({ ok: false, error: "Missing or invalid 'message' field in payload." }, { status: 400 });
  }

  const rawMessage = reqBody.message;
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

  if (!message) {
    logPulseDiagnostic(requestId, "api_empty_message");
    return NextResponse.json({ ok: false, error: "'message' cannot be empty." }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    logPulseDiagnostic(requestId, "api_message_too_long", { length: message.length });
    return NextResponse.json({ ok: false, error: "'message' exceeds maximum length of 1000 characters." }, { status: 400 });
  }

  const history = Array.isArray(reqBody.history)
    ? (reqBody.history as { role: "user" | "assistant"; content: string }[])
    : undefined;
  const context =
    reqBody.context && typeof reqBody.context === "object"
      ? (reqBody.context as Record<string, unknown>)
      : undefined;

  // Check gibberish, nonsense, or random characters first
  if (isGibberishInput(message)) {
    return NextResponse.json(
      {
        answer: getGibberishOrNonsenseResponse(),
        isValid: false, // Does NOT increase progress percentage
      },
      { status: 200 }
    );
  }

  // Check direct casual/FAQ response (greeting, company inquiry, casual chat, general tech trivia)
  const casualResponse = getCasualOrFAQResponse(message);
  if (casualResponse) {
    return NextResponse.json(
      {
        answer: casualResponse,
        isValid: false, // Does NOT increase progress percentage
      },
      { status: 200 }
    );
  }

  // 3. Validate answer against the CURRENT discovery question independently of LLM response
  const targetField = detectActiveQuestionTarget(history, context);
  const answerValidation = validateAnswerAgainstQuestion(message, targetField);
  // The timeline/budget question is the 5th and final discovery step; a valid
  // answer to it ends questioning, so Pulse must close with a statement.
  const isFinalDiscoveryAnswer =
    answerValidation.isValid && (targetField === "timeline" || targetField === "budget");

  // 4. Process LLM Response via Primary LLM Provider Orchestration
  const answer = await generatePulseCompletion(message, history, context, requestId, {
    closingStatement: isFinalDiscoveryAnswer,
  });

  const isValid = answerValidation.isValid && answer !== GREETING_REJECTION && answer !== OUT_OF_SCOPE_REJECTION;

  return NextResponse.json(
    {
      answer: isFinalDiscoveryAnswer && isValid ? enforceClosingStatement(answer) : answer,
      isValid,
    },
    { status: 200 }
  );
});

export const GET  = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
