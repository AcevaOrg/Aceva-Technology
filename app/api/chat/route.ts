import { NextResponse } from "next/server";
import { generatePulseCompletion } from "@/lib/pulse/llm";
import { logPulseDiagnostic } from "@/lib/pulse/errors";
import {
  isGreetingInput,
  isInvalidOrUnclearInput,
  GREETING_REJECTION,
  OUT_OF_SCOPE_REJECTION,
} from "@/lib/pulse/scope";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 15; // 15 requests per minute

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

function checkRateLimit(ip: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    const resetAt = now + WINDOW_MS;
    rateLimitStore.set(ip, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }

  if (record.count >= MAX_REQUESTS) {
    return { allowed: false, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, resetAt: record.resetAt };
}

export async function POST(request: Request) {
  const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;

  try {
    // 1. Rate Limiting Check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      logPulseDiagnostic(requestId, "api_rate_limited", { retryAfterSeconds });

      return NextResponse.json(
        {
          ok: false,
          error: `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    // 2. Body & Content-Type Validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logPulseDiagnostic(requestId, "api_invalid_json");
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("message" in body) ||
      typeof (body as { message: unknown }).message !== "string"
    ) {
      logPulseDiagnostic(requestId, "api_invalid_payload");
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid 'message' field. Expected a string.",
        },
        { status: 400 }
      );
    }

    const reqBody = body as Record<string, unknown>;
    const message = typeof reqBody.message === "string" ? reqBody.message.trim() : "";
    const history = Array.isArray(reqBody.history)
      ? (reqBody.history as { role: "user" | "assistant"; content: string }[])
      : undefined;
    const context = reqBody.context && typeof reqBody.context === "object"
      ? (reqBody.context as Record<string, unknown>)
      : undefined;

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

    // 3. Process LLM Response via Primary LLM Provider Orchestration
    const answer = await generatePulseCompletion(message, history, context, requestId);
    const isGreeting = isGreetingInput(message);
    const isInvalid = isInvalidOrUnclearInput(message, history, context);
    const isValid = !isGreeting && !isInvalid && answer !== GREETING_REJECTION && answer !== OUT_OF_SCOPE_REJECTION;

    return NextResponse.json(
      {
        answer,
        isValid,
      },
      { status: 200 }
    );
  } catch (error) {
    logPulseDiagnostic(requestId, "api_route_exception", { error: String(error) });
    return NextResponse.json(
      {
        ok: false,
        error: "An internal server error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
