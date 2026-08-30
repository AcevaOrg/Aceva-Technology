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
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
} from "@/lib/pulse/scope";
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
    throw new ApiError("INVALID_JSON", {}, { reason: "parse-failed" });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("INVALID_JSON", {}, { reason: "not-an-object" });
  }

  const reqBody = body as Record<string, unknown>;

  if (!("message" in reqBody) || typeof reqBody.message !== "string") {
    logPulseDiagnostic(requestId, "api_invalid_payload");
    throw new ApiError("VALIDATION_FAILED", {
      message: "Please check your details — some required fields are missing or incorrect.",
    });
  }

  const message = readString(reqBody.message, MAX_MESSAGE_CHARS);

  if (!message) {
    logPulseDiagnostic(requestId, "api_empty_message");
    throw new ApiError("VALIDATION_FAILED", {
      message: "Please check your details — some required fields are missing or incorrect.",
    });
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    logPulseDiagnostic(requestId, "api_message_too_long", { length: message.length });
    throw new ApiError("PAYLOAD_TOO_LARGE", {
      message: "Your message is too long. Please shorten it and try again.",
    });
  }

  const history = Array.isArray(reqBody.history)
    ? (reqBody.history as { role: "user" | "assistant"; content: string }[])
    : undefined;
  const context =
    reqBody.context && typeof reqBody.context === "object"
      ? (reqBody.context as Record<string, unknown>)
      : undefined;

  // 3. Generate LLM response and evaluate scope
  const answer = await generatePulseCompletion(message, history, context, requestId);
  const isGreeting = isGreetingInput(message);
  const isInvalid  = isInvalidOrUnclearInput(message, history, context);
  const isValid    = !isGreeting && !isInvalid && answer !== GREETING_REJECTION && answer !== OUT_OF_SCOPE_REJECTION;
    if (!message) {
      logPulseDiagnostic(requestId, "api_empty_message");
      return NextResponse.json(
        {
          ok: false,
          error: "'message' cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      logPulseDiagnostic(requestId, "api_message_too_long", { length: message.length });
      return NextResponse.json(
        {
          ok: false,
          error: "'message' exceeds maximum length of 1000 characters.",
        },
        { status: 400 }
      );
    }

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

    // 3. Process LLM Response via Primary LLM Provider Orchestration
    const answer = await generatePulseCompletion(message, history, context, requestId);
    const isGreeting = isGreetingInput(message);
    const isCasual = isCasualOrFAQOrGeneralQuery(message);
    const isInvalid = isInvalidOrUnclearInput(message, history, context);
    const isProjectScope = isExplicitProjectScopeInput(message);

    // CORE RULE: Only explicit project scope responses increase progress (isValid: true)!
    const isValid = isProjectScope && !isCasual && !isGreeting && !isInvalid && answer !== GREETING_REJECTION && answer !== OUT_OF_SCOPE_REJECTION;

  return NextResponse.json(
    { answer, isValid },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
});

export const GET  = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
