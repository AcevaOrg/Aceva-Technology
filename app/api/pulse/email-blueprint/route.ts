import { after } from "next/server";
import { Resend } from "resend";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  sanitizeHeaderValue,
  methodNotAllowedHandler,
  optionsHandler,
} from "@/lib/api/response";
import { getDirection } from "@/lib/pulse/directionStore";
import { renderVerificationEmail, validateRecipient } from "@/lib/pulse/blueprintEmail";
import { getVerificationStore, newVerificationToken, verificationTtlMinutes } from "@/lib/pulse/emailVerification";
import { checkPulseId } from "@/lib/pulse/pulseId";
import { PULSE_FEATURES } from "@/lib/pulse/features";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { enforceRateLimits, HOUR_MS } from "@/lib/security/sharedRateLimit";
import { readTurnstileToken, verifyPulseTurnstile } from "@/lib/security/turnstile";

/**
 * Step 1 of emailing a blueprint: ask for a confirmation link.
 *
 * Still switched off (lib/pulse/features.ts). When enabled, this route never
 * emails the blueprint itself. It emails a single-use link, and only to the
 * address the direction was saved with, never to an address from the request;
 * the blueprint goes out only after that link is opened (./confirm).
 *
 * Anti-enumeration: every well-formed request gets the same answer, whether
 * or not the reference exists and the address matches, and the lookup and the
 * send run after the response, so timing does not tell either.
 *
 * Limits: shared across instances, per client address, per address asked for
 * and per reference; refused if the shared store is down. Turnstile action
 * "pulse_email". Malformed, legacy (guessable), future-dated and expired
 * references are refused before anything else is looked at.
 */

const MAX_BODY_BYTES = 2_048;
const ALLOWED_FIELDS = new Set(["pulseId", "contact", "turnstileToken", "cf-turnstile-response"]);

const REQUEST_LIMITS = {
  perIp: { limit: 5, windowMs: HOUR_MS },
  perEmail: { limit: 3, windowMs: HOUR_MS },
  perReference: { limit: 3, windowMs: HOUR_MS },
};

/** The same words for every accepted request. */
export const VERIFICATION_REQUESTED_MESSAGE =
  "If those details match a saved direction, we've emailed a confirmation link to that address. It expires shortly and works once.";

const BAD_REQUEST = "Please check the reference ID and email address.";

/** Runs after the response where the platform allows it; inline elsewhere (scripts, tests). */
async function afterResponse(work: () => Promise<void>): Promise<void> {
  const task = work().catch((error: unknown) => {
    console.error("[pulse-email-blueprint] background send failed", {
      reason: error instanceof Error ? error.name : "unknown error",
    });
  });
  try {
    after(task);
  } catch {
    await task;
  }
}

export const POST = withRouteErrorHandling("pulse-email-blueprint", async (request, requestId) => {
  // Security containment, 30 October 2026: refused before anything else, so
  // the answer is identical for every request while the feature is off.
  if (!PULSE_FEATURES.blueprintEmail) {
    throw new ApiError("FEATURE_DISABLED", {}, { reason: "blueprint-email-disabled" });
  }

  const ip = getTrustedClientIp(request);
  await enforceRateLimits("pulse-email-request", [{ dimension: "ip", value: ip, ...REQUEST_LIMITS.perIp }], {
    onStoreError: "deny",
  });

  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new ApiError("VALIDATION_FAILED", { message: BAD_REQUEST }, { reason: "unexpected-field" });
  }

  const reference = checkPulseId(body.pulseId);
  const recipient = validateRecipient(body.contact);
  if (!reference.ok || !recipient) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: BAD_REQUEST },
      { reason: reference.ok ? "bad-recipient" : `reference-${reference.reason}` }
    );
  }

  const turnstileFailure = await verifyPulseTurnstile(readTurnstileToken(body), { action: "pulse_email", ip, requestId });
  if (turnstileFailure) throw new ApiError(turnstileFailure, {}, { reason: "turnstile" });

  await enforceRateLimits(
    "pulse-email-request",
    [
      { dimension: "email", value: recipient, ...REQUEST_LIMITS.perEmail },
      { dimension: "pulse-id", value: reference.id, ...REQUEST_LIMITS.perReference },
    ],
    { onStoreError: "deny" }
  );

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  await afterResponse(async () => {
    const direction = await getDirection(reference.id);
    // The stored address, validated again; the request's copy is only used to compare.
    const stored = validateRecipient(direction?.lead.contact);
    if (!direction || !stored || stored !== recipient) return;

    if (!apiKey || !fromEmail) {
      console.error(`[pulse-email-blueprint][${requestId}] email not configured`);
      return;
    }

    const ttlMinutes = verificationTtlMinutes();
    const { token, tokenHash } = newVerificationToken();
    await getVerificationStore().create(tokenHash, reference.id, new Date(Date.now() + ttlMinutes * 60_000));

    const { subject, text } = renderVerificationEmail({ pulseId: reference.id, token, ttlMinutes });
    const { error } = await new Resend(apiKey).emails.send({
      from: fromEmail,
      to: stored,
      subject: sanitizeHeaderValue(subject),
      text,
    });
    if (error) console.error(`[pulse-email-blueprint][${requestId}] Resend rejection`, { name: error.name });
  });

  return apiSuccess({ message: VERIFICATION_REQUESTED_MESSAGE }, { status: 202 });
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
