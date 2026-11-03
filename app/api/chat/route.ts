import { generatePulseCompletion, type LLMMessage } from "@/lib/pulse/llm";
import { logPulseDiagnostic } from "@/lib/pulse/errors";
import {
  getDiscoveryQuestion,
  getDiscoveryHelper,
  getDiscoveryField,
  DISCOVERY_STEP_COUNT,
} from "@/lib/pulse/discoverySteps";
import {
  MAX_DISCOVERY_REASKS,
  coveredDiscoverySteps,
  nextOpenDiscoveryStep,
  readCoveredSteps,
} from "@/lib/pulse/discoveryCoverage";
import { API_ERROR_MESSAGES, type ApiErrorCode } from "@/lib/api/errorCodes";
import { logChatTurn } from "@/lib/pulse/turnLog";
import {
  getCasualOrFAQResponse,
  isGibberishInput,
  isGreetingInput,
  isInvalidOrUnclearInput,
  isProjectDiscoveryInput,
  isAssistantIdentityQuery,
  getGibberishOrNonsenseResponse,
  GREETING_REJECTION,
  isFollowUpReference,
  isVisitorQuestion,
} from "@/lib/pulse/scope";
import {
  detectActiveQuestionTarget,
  validateAnswerAgainstQuestion,
  isSubstantiveAnswer,
} from "@/lib/pulse/answerValidator";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  readString,
  readStringArray,
  logRouteError,
  methodNotAllowedHandler,
  optionsHandler,
} from "@/lib/api/response";
import {
  getClientIp,
  checkRateLimit,
  cleanupRateLimitStore,
} from "@/lib/rateLimit";
import { PULSE_ID_MENTION } from "@/lib/pulse/pulseId";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { enforceRateLimits, MINUTE_MS } from "@/lib/security/sharedRateLimit";

/**
 * PULSE ID lookups get their own limit, shared across instances, per trusted
 * client address and per browser session. The reply is fixed text today, but
 * this is the brake on enumeration if lookup details are ever switched on. A
 * store outage falls back to a stricter in-process limit rather than refusing
 * chat outright.
 */
const LOOKUP_LIMIT = { limit: 10, windowMs: 10 * MINUTE_MS };

const MAX_BODY_BYTES = 16_384;
const MAX_MESSAGE_CHARS = 1_000;

/** Mirrors the window `llm.ts` actually forwards upstream. */
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT_CHARS = 2_000;

/** The only context keys that reach the model, with the cap applied to each. */
const CONTEXT_STRING_FIELDS: readonly (readonly [string, number])[] = [
  ["intent", 500],
  ["industry", 200],
  ["business", 500],
  ["current", 500],
  ["scale", 200],
  ["market", 200],
  ["timeline", 200],
  ["budget", 200],
];
const CONTEXT_ARRAY_FIELDS = ["friction", "goals"] as const;

const CLOSING_STATEMENT_FALLBACK =
  "Noted — that completes the discovery phase. Pulse now has the full picture of your project and is assembling your recommended direction.";

/** Raised for any malformed `history` entry, so one shape of 400 covers them all. */
function historyError(logContext: Record<string, unknown>): ApiError {
  return new ApiError(
    "VALIDATION_FAILED",
    { message: "'history' must be an array of { role, content } messages." },
    { field: "history", ...logContext },
  );
}

/**
 * Coerces untrusted history into the shape the LLM layer expects.
 *
 * Every entry is checked before any is used: a `null` or a non-string `content`
 * used to reach `msg.content.trim()` deeper in the stack and surface as an
 * opaque 500, when it is really a client mistake that deserves a 400. Only the
 * most recent `MAX_HISTORY_MESSAGES` are forwarded, so a long transcript is
 * trimmed rather than refused.
 */
function readHistory(value: unknown): LLMMessage[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw historyError({ reason: "not-an-array" });

  const messages: LLMMessage[] = [];

  for (let index = 0; index < value.length; index++) {
    const entry = value[index];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw historyError({ reason: "entry-not-an-object", index });
    }

    const { role, content } = entry as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") {
      throw historyError({ reason: "unsupported-role", index });
    }
    if (typeof content !== "string") {
      throw historyError({ reason: "content-not-a-string", index });
    }

    const trimmed = content.trim();
    if (trimmed) {
      messages.push({ role, content: trimmed.slice(0, MAX_HISTORY_CONTENT_CHARS) });
    }
  }

  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  return recent.length > 0 ? recent : undefined;
}

/**
 * Rebuilds the project context from a fixed whitelist.
 *
 * The context is interpolated into the prompt, so echoing back whatever keys a
 * caller supplied would hand them a free text channel into the model's
 * instructions. Unknown keys are dropped, every value is length-capped, and
 * empty values are omitted so the prompt stays readable.
 */
function readProjectContext(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;

  const context: Record<string, unknown> = {};

  for (const [key, maxLength] of CONTEXT_STRING_FIELDS) {
    const text = readString(raw[key], maxLength);
    if (text) context[key] = text;
  }

  for (const key of CONTEXT_ARRAY_FIELDS) {
    const items = readStringArray(raw[key], 10, 200);
    if (items.length > 0) context[key] = items;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

/** The discovery step whose answer fills each context field. Unlisted fields are always kept. */
const CONTEXT_FIELD_STEP: Record<string, number> = {
  current: 1,
  friction: 1,
  scale: 2,
  market: 2,
  goals: 3,
  timeline: 4,
  budget: 4,
};

/**
 * Drops context fields for questions the visitor has not answered yet.
 *
 * The browser pre-fills friction and goals with an industry's typical values
 * ("High appointment no-shows") as soon as it recognises the industry. Sent to
 * the model as "what the visitor told the wizard", those guesses were quoted
 * back as if the visitor had said them, and made the question about them look
 * already answered. A field is kept once its step has been asked or the
 * visitor's own words have covered it.
 */
function pruneUnansweredContext(
  context: Record<string, unknown> | undefined,
  step: number,
  covered: ReadonlySet<number>
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const kept = Object.fromEntries(
    Object.entries(context).filter(([key]) => {
      const fieldStep = CONTEXT_FIELD_STEP[key];
      return fieldStep === undefined || fieldStep <= step || covered.has(fieldStep);
    })
  );
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/* ------------------------------------------------------------------ *
 * Server-sent events                                                  *
 * ------------------------------------------------------------------ */

/** One frame of the stream. The client switches on `type`. */
type StreamFrame =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; isValid: boolean; nextStep?: number; reasked?: boolean; sideQuestion?: boolean }
  | { type: "error"; error: string; code: ApiErrorCode };

function sseFrame(frame: StreamFrame): string {
  return `data: ${JSON.stringify(frame)}\n\n`;
}

/**
 * True when the caller asked for a stream.
 *
 * Opt-in by Accept header, so every existing client — and any non-browser
 * caller — keeps getting the buffered JSON response unchanged.
 */
function wantsStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream");
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  // Stops nginx-style proxies buffering the whole body before forwarding it,
  // which would defeat the point of streaming.
  "X-Accel-Buffering": "no",
} as const;

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
  const rateLimit = checkRateLimit("chat", ip);
  if (!rateLimit.allowed) {
    logPulseDiagnostic(requestId, "api_rate_limited", { seconds: rateLimit.retryAfter });
    throw new ApiError("RATE_LIMITED", { retryAfter: rateLimit.retryAfter }, { ip });
  }
  if (Math.random() < 0.05) cleanupRateLimitStore();

  // 2. Reject cross-origin and non-JSON callers before touching the body.
  assertSameOrigin(request);
  assertJsonContentType(request);

  // 3. Read the body under a hard byte ceiling, without trusting Content-Length.
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });

  // 4. Validate the message
  if (typeof body.message !== "string") {
    logPulseDiagnostic(requestId, "api_invalid_payload");
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Missing or invalid 'message' field in payload." },
      { field: "message", reason: "not-a-string" },
    );
  }

  const message = body.message.trim();
  if (!message) {
    logPulseDiagnostic(requestId, "api_empty_message");
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "'message' cannot be empty." },
      { field: "message", reason: "empty" },
    );
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    logPulseDiagnostic(requestId, "api_message_too_long", { length: message.length });
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: `'message' exceeds maximum length of ${MAX_MESSAGE_CHARS} characters.` },
      { field: "message", reason: "too-long", length: message.length },
    );
  }

  // 5. Validate the conversation history and whitelist the project context
  const history = readHistory(body.history);
  const context = readProjectContext(body.context);

  // Which wizard question is on screen. getDiscoveryQuestion returns undefined
  // for anything that is not a valid step index, and an absent or out-of-range
  // step simply means free chat rather than a wizard turn, so the pin is skipped.
  const activeQuestion = getDiscoveryQuestion(body.step);
  const activeQuestionHelper = getDiscoveryHelper(body.step);

  // Opaque, browser-generated, and the only identifier the turn log keeps. It
  // ties a visitor's turns together for drop-off analysis without naming them.
  const sessionId = readString(body.sessionId, 64) || "anonymous";
  const step = typeof body.step === "number" && Number.isInteger(body.step) ? body.step : undefined;

  if (PULSE_ID_MENTION.test(message)) {
    await enforceRateLimits(
      "pulse-lookup",
      [
        { dimension: "ip", value: getTrustedClientIp(request), ...LOOKUP_LIMIT },
        // A missing session id is skipped rather than pooled into one bucket.
        { dimension: "session", value: readString(body.sessionId, 64), ...LOOKUP_LIMIT },
      ],
      { onStoreError: "local" }
    );
  }
  const intent = typeof context?.intent === "string" ? context.intent : undefined;

  const streaming = wantsStream(request);

  /**
   * At most one analytics row per request. The streamed path used to log twice
   * when a visitor disconnected after the answer was settled: sending the final
   * frame then threw, and the error branch logged the same request again as a
   * failure. The turn log is also idempotent per request id in the database.
   */
  let turnLogged = false;
  const logTurnOnce = (turn: Parameters<typeof logChatTurn>[0]) => {
    if (turnLogged) return;
    turnLogged = true;
    logChatTurn(turn);
  };

  /**
   * Answers that are already known in full.
   *
   * Streamed as a single delta plus a done frame so the client parses one
   * protocol regardless of which branch answered. `isValid: false` throughout —
   * none of these is a discovery answer.
   */
  const cannedReply = (answer: string, sideQuestion = false) => {
    logTurnOnce({
      sessionId,
      requestId,
      question: message,
      intent,
      step,
      targetField: "canned",
      isValid: false,
      isFallback: true,
      streamed: streaming,
      latencyMs: 0,
    });

    const done = { answer, isValid: false, ...(sideQuestion ? { sideQuestion: true } : {}) };
    if (!streaming) return apiSuccess(done);

    const body = sseFrame({ type: "delta", text: answer }) + sseFrame({ type: "done", ...done });
    return new Response(body, { status: 200, headers: SSE_HEADERS });
  };

  // Check gibberish, nonsense, or random characters first
  if (isGibberishInput(message)) {
    return cannedReply(getGibberishOrNonsenseResponse());
  }

  // A canned, non-progress reply is now reserved for three narrow cases:
  // greetings and acknowledgements, questions about Pulse's own identity, and
  // clear junk — WH-word chains, general-knowledge trivia, maths, recipes and the
  // like, as classified by `isInvalidOrUnclearInput`. A message carrying real
  // project intent is never treated as junk even when it also wanders off topic
  // ("Hi, I need a mobile app for my restaurant. Also, how does Python work?"),
  // which is what lets the model extract the requirement and ignore the aside.
  //
  // This gate used to be `getCasualOrFAQResponse` on its own, which answers
  // anything `isProjectDiscoveryInput` rejects — and that rejects every
  // question-shaped message. So "What technologies do you use?", "Can you tell me
  // what this would cost?", "CRM" and "Something like Uber but for laundry" all
  // got the same "I'm here to help map out…" deflection and the knowledge base
  // was never consulted. Those now continue to RAG and the LLM.
  // A short back-reference ("Can you do that?") mid-conversation is a
  // follow-up for the model to resolve from the history, not junk.
  const isFollowUp = Boolean(history?.length) && isFollowUpReference(message);
  const isClearJunk = !isProjectDiscoveryInput(message) && isInvalidOrUnclearInput(message) && !isFollowUp;
  if (isGreetingInput(message) || isAssistantIdentityQuery(message) || isClearJunk) {
    // "Who are you?" is the visitor's own question, like "Who is CEO?".
    return cannedReply(
      getCasualOrFAQResponse(message) ?? GREETING_REJECTION,
      getDiscoveryField(step) !== undefined && isAssistantIdentityQuery(message)
    );
  }

  // 6. Validate answer against the CURRENT discovery question independently of LLM response.
  // `step` is passed through so the field comes from the question on screen
  // rather than from keyword-matching Pulse's own last message.
  const targetField = detectActiveQuestionTarget(history, context, step);
  const fieldValidation = validateAnswerAgainstQuestion(message, targetField);

  // 6a. Discovery bookkeeping, only while the wizard is showing a question.
  //
  // Discovery used to have no limit: an answer the field check rejected was
  // re-asked as many times as it took, and a repeated answer stalled the step
  // outright. Now each project gets MAX_DISCOVERY_REASKS clarifications in
  // total; once spent, any genuine reply is accepted and discovery moves on.
  const wizardStep = getDiscoveryField(step) !== undefined ? (step as number) : undefined;
  const reasksUsed =
    typeof body.reasks === "number" && Number.isInteger(body.reasks) && body.reasks > 0 ? body.reasks : 0;
  const reaskSpent = reasksUsed >= MAX_DISCOVERY_REASKS;
  const substantive = isSubstantiveAnswer(message);
  // The browser compares against the answers it has recorded, which the
  // history window may no longer hold.
  const repeatsEarlierAnswer = wizardStep !== undefined && body.repeat === true;

  let answerIsValid = fieldValidation.isValid && !(repeatsEarlierAnswer && !reaskSpent);
  if (!answerIsValid && wizardStep !== undefined && reaskSpent && substantive) answerIsValid = true;
  const answerValidation = { isValid: answerIsValid };
  // A question of the visitor's own ("Who is CEO?") is not a failed answer: it
  // is answered in full, spends no clarification and leaves the step as it is.
  const sideQuestion = wizardStep !== undefined && !answerIsValid && isVisitorQuestion(message);
  // A genuine reply that still missed the question spends the clarification.
  const reask = wizardStep !== undefined && !answerIsValid && substantive && !sideQuestion;

  // Steps the visitor's own words have already answered are skipped, so
  // "we have two branches" in the first answer is never asked for again.
  const covered = new Set([...readCoveredSteps(body.covered), ...coveredDiscoverySteps(message)]);
  const nextStep =
    wizardStep !== undefined && answerIsValid ? nextOpenDiscoveryStep(wizardStep, covered) : undefined;
  // Before the first answer the browser's context holds only guesses from the
  // question itself (an intent of "Start something new" for "Who is CEO?"),
  // which drew project questions into a company answer. They are not sent.
  const modelContext =
    sideQuestion && wizardStep === 0 && covered.size === 0
      ? undefined
      : wizardStep !== undefined
        ? pruneUnansweredContext(context, wizardStep, covered)
        : context;

  // An answer that leaves nothing to ask ends questioning, so Pulse must close
  // with a statement. Usually that is the 5th step (timeline/budget), but it
  // is earlier when the remaining steps were already answered.
  //
  // When the client tells us which step it is showing, that is what decides it.
  // Inferring it from `targetField` alone closed discovery early: the heuristic
  // behind `targetField` reads the last assistant bubble, and an ordinary word
  // like "when" or "cost" in a step-2 question was enough to report the final
  // step. Free chat has no step, so there it still falls back to the field.
  const isFinalDiscoveryAnswer =
    answerValidation.isValid &&
    (wizardStep !== undefined
      ? (nextStep ?? 0) >= DISCOVERY_STEP_COUNT
      : targetField === "timeline" || targetField === "budget");
  const nextQuestion =
    nextStep !== undefined && !isFinalDiscoveryAnswer ? getDiscoveryQuestion(nextStep) : undefined;
  const nextQuestionHelper = nextQuestion ? getDiscoveryHelper(nextStep) : undefined;

  /**
   * A canned fallback — a rejection, a PULSE ID lookup, or a provider failure —
   * is never a discovery answer, so it must not advance progress. This used to
   * be two string comparisons, which covered only the two rejection constants
   * and let the "currently unavailable" and "having trouble responding" replies
   * through as valid answers.
   */
  const settle = (
    completion: { answer: string; isFallback: boolean },
    latencyMs: number,
    errorCode?: string
  ) => {
    const isValid = answerValidation.isValid && !completion.isFallback;
    const answer =
      isFinalDiscoveryAnswer && isValid
        ? enforceClosingStatement(completion.answer)
        : completion.answer;

    logTurnOnce({
      sessionId,
      requestId,
      question: message,
      intent,
      step,
      targetField,
      isValid,
      isFallback: completion.isFallback,
      streamed: streaming,
      latencyMs,
      errorCode,
    });

    // `nextStep` tells the browser which question to show next (it may skip
    // steps already answered); `reasked` tells it the one clarification is spent.
    return {
      answer,
      isValid,
      ...(isValid && nextStep !== undefined ? { nextStep } : {}),
      ...(reask && !completion.isFallback ? { reasked: true } : {}),
      // Lets the panel stop showing the step's "tell us about your project"
      // heading above an answer to the visitor's own question.
      ...(sideQuestion && !completion.isFallback ? { sideQuestion: true } : {}),
    };
  };

  // 7a. Buffered path — the default, and what every non-streaming caller gets.
  if (!streaming) {
    const startedAt = Date.now();
    let completion: Awaited<ReturnType<typeof generatePulseCompletion>>;
    try {
      completion = await generatePulseCompletion(message, history, modelContext, requestId, {
        closingStatement: isFinalDiscoveryAnswer,
        activeQuestion,
        activeQuestionHelper,
        reask,
        nextQuestion,
        nextQuestionHelper,
        sideQuestion,
        discoveryUnderway: (wizardStep ?? 0) > 0 || covered.size > 0,
      });
    } catch (error) {
      // Counted as a failed turn, as the streamed path does, then handled by
      // the route's error wrapper as before.
      logTurnOnce({
        sessionId,
        requestId,
        question: message,
        intent,
        step,
        targetField,
        isValid: false,
        isFallback: true,
        streamed: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "INTERNAL_ERROR",
      });
      throw error;
    }
    return apiSuccess(settle(completion, Date.now() - startedAt));
  }

  // 7b. Streaming path.
  //
  // Note the two-part contract: deltas exist purely so the user sees progress,
  // while the `done` frame carries the authoritative answer. They can differ —
  // `enforceClosingStatement` rewrites the final discovery reply after the fact,
  // and a fallback replaces it entirely — so the client renders deltas live and
  // then reconciles to `done.answer`.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A visitor who closes the tab cancels the stream, and enqueue then
      // throws. The turn is still settled and logged once; there is simply no
      // one left to deliver frames to.
      const send = (frame: StreamFrame) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(frame)));
        } catch {
          // Stream cancelled by the client.
        }
      };

      const startedAt = Date.now();

      try {
        const completion = await generatePulseCompletion(message, history, modelContext, requestId, {
          closingStatement: isFinalDiscoveryAnswer,
          activeQuestion,
          activeQuestionHelper,
          reask,
          nextQuestion,
          nextQuestionHelper,
          sideQuestion,
          discoveryUnderway: (wizardStep ?? 0) > 0 || covered.size > 0,
          signal: request.signal,
          onToken: (delta) => send({ type: "delta", text: delta }),
        });

        const settled = settle(completion, Date.now() - startedAt);
        // A fallback produced no tokens, so emit its text as one delta first.
        if (completion.isFallback) send({ type: "delta", text: settled.answer });
        send({ type: "done", ...settled });
      } catch (error) {
        // The response is already committed with a 200, so a failure here has
        // to travel in-band rather than as an HTTP status.
        logRouteError("chat", requestId, error, { phase: "stream" });
        logTurnOnce({
          sessionId,
          requestId,
          question: message,
          intent,
          step,
          targetField,
          isValid: false,
          isFallback: true,
          streamed: true,
          latencyMs: Date.now() - startedAt,
          errorCode: "INTERNAL_ERROR",
        });
        send({
          type: "error",
          error: API_ERROR_MESSAGES.INTERNAL_ERROR,
          code: "INTERNAL_ERROR",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a client cancel.
        }
      }
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
});

export const GET  = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
