import { Resend } from "resend";
import { CONTACT_EMAIL } from "@/lib/social";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  methodNotAllowedHandler,
  optionsHandler,
  readString,
  readEnum,
  sanitizeHeaderValue,
} from "@/lib/api/response";
import { validateContact, type ContactFormValues } from "@/lib/validateContact";
import { getClientIp, checkRateLimit, createRateLimitResponse, cleanupRateLimitStore } from "@/lib/rateLimit";
import { checkSpamContent, isDisposableEmail } from "@/lib/spamFilter";

const MAX_BODY_BYTES = 16_384;
const TURNSTILE_TIMEOUT_MS = 5_000;

// ─── Turnstile ────────────────────────────────────────────────────────────────

interface TurnstileResult {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

type TurnstileCode =
  | "TURNSTILE_REQUIRED"
  | "TURNSTILE_EXPIRED"
  | "TURNSTILE_INVALID"
  | "TURNSTILE_UNAVAILABLE";

/**
 * Verifies a Turnstile token with Cloudflare's siteverify endpoint.
 * Returns null on success, or the correct ApiErrorCode on failure.
 * All Cloudflare-specific error codes and hostnames stay on the server log.
 */
async function verifyTurnstile(
  token: string,
  ip: string,
  requestId: string,
): Promise<TurnstileCode | null> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const required = process.env.CONTACT_REQUIRE_TURNSTILE === "true";

  // Turnstile not configured — only block if explicitly required.
  if (!secretKey) return required ? "TURNSTILE_UNAVAILABLE" : null;

  if (!token) return "TURNSTILE_REQUIRED";

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
      cache: "no-store",
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Cloudflare's siteverify returned a non-2xx — treat as our outage.
      console.error(`[contact][${requestId}] siteverify HTTP ${res.status}`);
      return "TURNSTILE_UNAVAILABLE";
    }

    const data = (await res.json()) as TurnstileResult;

    if (!data.success) {
      const codes = data["error-codes"] ?? [];
      // Log the raw codes server-side only — never forward to the client.
      console.warn(`[contact][${requestId}] Turnstile rejected`, {
        errorCodes: codes,
        hostname: data.hostname,
      });
      // "timeout-or-duplicate" means the user waited too long or reused a token.
      if (codes.includes("timeout-or-duplicate")) return "TURNSTILE_EXPIRED";
      return "TURNSTILE_INVALID";
    }

    // Optional hostname / action binding — mismatches are our config problem, not the user's.
    const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION;
    if (expectedHostname && data.hostname !== expectedHostname) {
      console.error(`[contact][${requestId}] Turnstile hostname mismatch`, {
        got: data.hostname,
        expected: expectedHostname,
      });
      return "TURNSTILE_INVALID";
    }
    if (expectedAction && data.action !== expectedAction) {
      console.error(`[contact][${requestId}] Turnstile action mismatch`, {
        got: data.action,
        expected: expectedAction,
      });
      return "TURNSTILE_INVALID";
    }

    return null; // All checks passed.
  } catch {
    console.error(`[contact][${requestId}] siteverify fetch failed`);
    return "TURNSTILE_UNAVAILABLE";
  }
}

// ─── Label maps (server-side only, for the email body) ───────────────────────

const SITUATION_LABEL: Record<ContactFormValues["situation"], string> = {
  new: "Starting something new",
  improve: "Improving my business",
  help: "Already built something, needs help",
};

const SERVICE_LABEL: Record<ContactFormValues["service"], string> = {
  unsure: "Not sure yet",
  digital: "Digital Experiences",
  software: "Custom Software",
  mobile: "Mobile Products",
  intelligence: "Intelligence & Automation",
  rescue: "Product Rescue & Reliability",
};

// ─── Route handler ────────────────────────────────────────────────────────────

export const POST = withRouteErrorHandling("contact", async (request, requestId) => {
  // 1. Turnstile key-pair sanity check (our config issue, not the user's fault).
  if (
    process.env.CONTACT_REQUIRE_TURNSTILE === "true" &&
    (!process.env.TURNSTILE_SECRET_KEY || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  ) {
    console.error(`[contact][${requestId}] Turnstile required but key pair is incomplete`);
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      {},
      { reason: "turnstile-keypair-incomplete" },
    );
  }

  // 2. Rate limiting — checked before reading the body to minimise work on abuse.
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    // createRateLimitResponse uses the old plain shape; throw ApiError instead
    // so the canonical envelope is always used.
    const seconds = Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    throw new ApiError(
      "RATE_LIMITED",
      { retryAfterSeconds: seconds },
      { ip },
    );
  }
  if (Math.random() < 0.01) cleanupRateLimitStore();

  // 3. Same-origin guard (no-op for non-browser clients that omit Origin).
  assertSameOrigin(request);

  // 4. Content-Type must be application/json.
  assertJsonContentType(request);

  // 5. Read and parse the body (enforces MAX_BODY_BYTES without trusting Content-Length).
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });

  // 6. Honeypot — real users never fill this hidden field; bots usually do.
  //    Return a fake success so bots think they got through.
  const gotcha = readString(body._gotcha, 200);
  if (gotcha.length > 0) {
    return apiSuccess();
  }

  // 7. Coerce all fields to safe types before validation.
  const name = readString(body.name, 100);
  const email = readString(body.email, 254).toLowerCase();
  const company = readString(body.company, 150);
  const details = readString(body.details, 5_000);
  const situation = readEnum<ContactFormValues["situation"]>(
    body.situation,
    ["new", "improve", "help"],
    "new",
  );
  const service = readEnum<ContactFormValues["service"]>(
    body.service,
    ["unsure", "digital", "software", "mobile", "intelligence", "rescue"],
    "unsure",
  );
  const budget = readEnum<ContactFormValues["budget"]>(
    body.budget,
    ["", "sprint", "small", "mid", "ongoing"],
    "",
  );

  // 8. Field validation.
  //    The `errors` map is NOT forwarded to the client — it gives away which fields
  //    were checked. The frontend re-validates client-side, so legitimate users
  //    never reach this path with bad data anyway.
  const fieldErrors = validateContact({ name, email, company, situation, service, budget, details });
  if (Object.keys(fieldErrors).length > 0) {
    console.warn(`[contact][${requestId}] validation failed`, { fields: Object.keys(fieldErrors) });
    throw new ApiError(
      "VALIDATION_FAILED",
      {
        // Generic message — no field names, no hints about what is checked.
        message: "Please check your details — some required fields are missing or incorrect.",
      },
      { fields: Object.keys(fieldErrors) }, // server log only
    );
  }

  // 9. Disposable email guard.
  if (isDisposableEmail(email)) {
    throw new ApiError(
      "DISPOSABLE_EMAIL",
      {},
      { email },
    );
  }

  // 10. Spam content filter.
  const spamCheck = checkSpamContent(details);
  if (spamCheck.isSpam) {
    console.warn(`[contact][${requestId}] spam rejected`, {
      score: spamCheck.score,
      reasons: spamCheck.reasons,
    });
    throw new ApiError("SPAM_REJECTED", {}, { score: spamCheck.score });
  }

  // 11. Turnstile — read the token and verify it.
  //     The field name "cf-turnstile-response" is the Cloudflare widget standard;
  //     we also accept "turnstileResponse" for the legacy frontend key used in Postman tests.
  const turnstileToken =
    readString(body["cf-turnstile-response"], 2_048) ||
    readString(body["turnstileResponse"], 2_048);

  const turnstileError = await verifyTurnstile(turnstileToken, ip, requestId);
  if (turnstileError) {
    throw new ApiError(turnstileError, {}, { ip });
  }

  // 12. Send email via Resend.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[contact][${requestId}] RESEND_API_KEY is not set`);
    throw new ApiError("SERVICE_UNAVAILABLE", {}, { reason: "resend-key-missing" });
  }

  const toEmail = process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Aceva Website <onboarding@resend.dev>";

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: sanitizeHeaderValue(`New project inquiry — ${SITUATION_LABEL[situation]}`),
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || "—"}`,
      `Situation: ${SITUATION_LABEL[situation]}`,
      `Capability of interest: ${SERVICE_LABEL[service]}`,
      `Budget range: ${budget || "Prefer not to say"}`,
      "",
      "What is the problem, in their own words:",
      details,
    ].join("\n"),
  });

  if (error) {
    console.error(`[contact][${requestId}] Resend rejected the request`, {
      name: error.name,
      message: error.message,
    });
    throw new ApiError("UPSTREAM_ERROR", {}, { provider: "resend", errorName: error.name });
  }

  return apiSuccess();
});

// Return proper 405 responses for unsupported methods instead of Next.js's
// empty-body default (which clients can't parse as JSON).
export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
