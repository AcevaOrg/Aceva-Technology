import { Resend } from "resend";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  readString,
  sanitizeHeaderValue,
  logRouteError,
  methodNotAllowedHandler,
  optionsHandler,
} from "@/lib/api/response";
import { getClientIp, checkRateLimit, cleanupRateLimitStore } from "@/lib/rateLimit";
import { getDirection, type SavedDirection } from "@/lib/pulse/directionStore";
import { renderBlueprintEmail } from "@/lib/pulse/blueprintEmail";

const MAX_BODY_BYTES = 4_096;

/** A PULSE reference code: PLS-YYMMDD-NNN. */
const PULSE_ID_PATTERN = /^PLS-\d{6}-\d{3}$/;

/** The single generic refusal. See the note on ownership below. */
const GENERIC_REFUSAL =
  "We could not send that blueprint. Please check the reference ID and the email address you saved it with.";

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST = withRouteErrorHandling("pulse-email-blueprint", async (request, requestId) => {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit("pulse-email-blueprint", ip);
  if (!rateLimit.allowed) {
    throw new ApiError("RATE_LIMITED", { retryAfter: rateLimit.retryAfter }, { ip });
  }
  if (Math.random() < 0.05) cleanupRateLimitStore();

  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });

  const pulseId = readString(body.pulseId, 100).toUpperCase();
  const contact = readString(body.contact, 200);

  if (!PULSE_ID_PATTERN.test(pulseId) || !contact) {
    throw new ApiError("VALIDATION_FAILED", { message: GENERIC_REFUSAL }, { requestId, reason: "bad-input" });
  }

  let direction: SavedDirection | null;
  try {
    direction = await getDirection(pulseId);
  } catch (error) {
    logRouteError("pulse-email-blueprint", requestId, error, { pulseId });
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      { message: "We could not reach your saved direction just now. Please try again in a moment." },
      { pulseId, reason: "direction-store-read-failed" },
    );
  }

  // Ownership. A PULSE ID is short and guessable, so without proof that the
  // caller already knows the address the direction was saved under, this
  // endpoint would be a way to mail an arbitrary stranger on demand. The
  // refusal is identical whether the id is unknown or the address is wrong, so
  // it cannot be used to discover which ids exist or who owns them.
  const owner = direction?.lead.contact.trim().toLowerCase() ?? "";
  if (!direction || owner !== contact.trim().toLowerCase()) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: GENERIC_REFUSAL },
      { pulseId, reason: direction ? "contact-mismatch" : "unknown-pulse-id" },
    );
  }

  // The direction may have been saved against a phone number.
  if (!isEmailAddress(owner)) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "This direction was saved with a phone number, so there is no address to email it to." },
      { pulseId, reason: "contact-not-an-email" },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "ACEVA PULSE <onboarding@resend.dev>";

  if (!apiKey) {
    console.error(`[pulse-email-blueprint][${requestId}] RESEND_API_KEY not set`);
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      { message: "Email delivery is not configured right now. Please try again later." },
      { pulseId, reason: "missing-resend-key" },
    );
  }

  const { subject, text } = renderBlueprintEmail(direction);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: direction.lead.contact,
      subject: sanitizeHeaderValue(subject),
      text,
    });

    if (error) {
      // Only the provider's error name is logged; its message can carry detail.
      console.error(`[pulse-email-blueprint][${requestId}] Resend rejection`, { name: error.name });
      throw new ApiError(
        "UPSTREAM_ERROR",
        { message: "We could not send that email just now. Please try again in a moment." },
        { pulseId, reason: "resend-rejected" },
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logRouteError("pulse-email-blueprint", requestId, error, { pulseId });
    throw new ApiError(
      "UPSTREAM_ERROR",
      { message: "We could not send that email just now. Please try again in a moment." },
      { pulseId, reason: "resend-threw" },
    );
  }

  // The address is deliberately not echoed back: the caller already knows it,
  // and a response that confirmed it would turn a guessed id into a disclosure.
  return apiSuccess({ pulseId });
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
